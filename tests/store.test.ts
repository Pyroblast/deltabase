import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createStore, type Store } from "../server/store";
import { parseFeed, type Source } from "../server/apple";
import { createSync } from "../server/sync";
import { feed, metadata } from "./fixtures";
let s: Store;
const source = (id = "us:6007:free") =>
  s.one<Source>("SELECT * FROM sources WHERE id=?", id)!;
beforeEach(() => {
  s = createStore(":memory:");
});
afterEach(() => s.db.close());
describe("Apple feed parsing", () => {
  it("accepts 98 entries without inventing missing ranks", () => {
    const result = parseFeed(
      feed(Array.from({ length: 98 }, (_, i) => String(i + 1))),
      source(),
    );
    expect(result.entries).toHaveLength(98);
    expect(result.entries.at(-1)?.rank).toBe(98);
  });
  it("accepts a singleton and an empty valid feed", () => {
    const f = feed(["1"]);
    expect(
      parseFeed({ feed: { ...f.feed, entry: f.feed.entry[0] } }, source())
        .entries,
    ).toHaveLength(1);
    expect(parseFeed({ feed: {} }, source()).entries).toEqual([]);
  });
  it("rejects wrong categories, duplicate IDs and malformed responses", () => {
    expect(() =>
      parseFeed(feed(["1"], "2026-10-31", 6017), source()),
    ).toThrow();
    expect(() => parseFeed(feed(["1", "1"]), source())).toThrow();
    expect(() => parseFeed({ error: "rate limited" }, source())).toThrow();
  });
});
describe("evidence and comparison", () => {
  it("seeds 156 distinct sources, three kinds in two markets", () => {
    expect(s.one("SELECT count(*) AS n FROM sources").n).toBe(156);
  });
  it("first observation is a baseline, duplicates do not add snapshots or events", () => {
    s.saveFeed(source(), feed(["1", "2"]));
    s.saveFeed(source(), feed(["1", "2"]));
    expect(s.one("SELECT count(*) AS n FROM snapshots").n).toBe(1);
    expect(s.all("SELECT * FROM events")).toHaveLength(0);
    expect(s.ranked({ market: "us", kind: "free" }).items[0]).toMatchObject({
      previousRank: null,
      previousAt: null,
    });
  });
  it("generates only newly observed and >=10 place rising events with evidence", () => {
    s.saveFeed(
      source(),
      feed(Array.from({ length: 30 }, (_, i) => String(i + 1))),
      "2026-10-31T00:00:00Z",
    );
    s.saveFeed(
      source(),
      feed(["30", "99", "1"], "2026-11-01T00:00:00Z"),
      "2026-11-01T00:00:00Z",
    );
    const ev = s.signals({ market: "us" });
    expect(ev).toHaveLength(2);
    expect(ev.find((e) => e.app_id === "30")?.details).toMatchObject({
      previousRank: 30,
      rank: 1,
    });
    expect(ev.find((e) => e.app_id === "99")?.type).toBe("entered");
    expect(ev.every((e) => e.snapshot_id)).toBe(true);
    const ranked = s.ranked({ market: "us", kind: "free" }).items;
    expect(ranked.find((a) => a.id === "99")).toMatchObject({
      previousRank: null,
      previousAt: "2026-10-31T00:00:00Z",
    });
    expect(ranked.find((a) => a.id === "30")).toMatchObject({
      previousRank: 30,
      previousAt: "2026-10-31T00:00:00Z",
      snapshotId: ev.find((e) => e.app_id === "30")?.snapshot_id,
    });
  });
  it("empty or malformed responses retain baseline and never create mass exits", () => {
    s.saveFeed(source(), feed(["1", "2"]));
    s.saveFeed(source(), { feed: {} });
    expect(source().status).toBe("empty");
    expect(s.ranked({ market: "us", kind: "free" }).total).toBe(2);
    expect(s.all("SELECT * FROM events")).toHaveLength(0);
    expect(() => s.saveFeed(source(), { bad: true })).toThrow();
    expect(s.one("SELECT count(*) AS n FROM snapshots").n).toBe(1);
  });
  it("rejects stale source timestamps", () => {
    s.saveFeed(source(), feed(["1"], "2026-11-01T00:00:00Z"));
    expect(() =>
      s.saveFeed(source(), feed(["2"], "2026-10-31T00:00:00Z")),
    ).toThrow("早于");
    expect(s.one("SELECT count(*) AS n FROM apps").n).toBe(1);
  });
  it("keeps market-specific metadata without merging different IDs", () => {
    s.saveMetadata("1", "us", metadata("1", "English"));
    s.saveMetadata("1", "cn", metadata("1", "中文"));
    s.saveMetadata("2", "us", metadata("2", "English"));
    expect(s.detail("1", "us").name).toBe("English");
    expect(s.detail("1", "cn").name).toBe("中文");
    expect(s.one("SELECT count(*) AS n FROM apps").n).toBe(2);
  });
  it("cross chart view is a union, not just apps present in both charts", () => {
    s.saveFeed(source(), feed(["1", "2"]));
    s.saveFeed(source("us:6007:grossing"), feed(["2", "3"]));
    const result = s.ranked({ market: "us", kind: "cross" });
    expect(result.total).toBe(3);
    expect(result.items.find((a) => a.id === "3")).toMatchObject({
      freeRank: null,
      grossingRank: 2,
    });
    expect(result.items.find((a) => a.id === "2")).toMatchObject({
      freeRank: 2,
      grossingRank: 1,
    });
  });
  it("cross focus keeps missing-free entries but excludes paid downloads and high free ranks", () => {
    s.saveFeed(source(), feed(["1", "2"]));
    const f = feed(["1", "3", "4"]);
    f.feed.entry[2]["im:price"].attributes.amount = "4.99";
    s.saveFeed(source("us:6007:grossing"), f);
    const result = s.ranked({ market: "us", kind: "cross", focus: true });
    expect(result.items.map((a) => a.id)).toEqual(["3"]);
  });
  it("paid ranks are independently compared and retain fractional prices", () => {
    const f = feed(["1"]);
    f.feed.entry[0]["im:price"].attributes.amount = "9.99";
    s.saveFeed(source("us:6007:paid"), f);
    expect(s.ranked({ market: "us", kind: "free" }).total).toBe(0);
    expect(s.ranked({ market: "us", kind: "paid" }).items[0].price).toBe(9.99);
  });
  it("stores verifiable compressed originals", () => {
    const f = feed(["1"]);
    s.saveFeed(source(), f);
    expect(
      JSON.parse(gunzipSync(s.one("SELECT raw FROM snapshots").raw).toString()),
    ).toEqual(f);
  });
  it("lookup version events require a previous observation and a watched product", () => {
    s.saveMetadata("1", "us", metadata("1"));
    s.run("UPDATE apps SET watch=1 WHERE id=?", "1");
    s.saveMetadata("1", "us", metadata("1", "测试产品 1", "2.0"));
    s.saveMetadata("1", "us", metadata("1", "测试产品 1", "2.0"));
    expect(s.signals({ market: "us" })).toHaveLength(1);
    expect(s.signals({ market: "us" })[0].type).toBe("version");
  });
  it("interrupted runs recover without changing personal data", () => {
    s.saveFeed(source(), feed(["1"]));
    s.run("UPDATE apps SET watch=1,tags='待研究' WHERE id='1'");
    s.run(
      "INSERT INTO runs(id,status,started_at,total) VALUES ('run','running','2026-10-31',1)",
    );
    s.run(
      "INSERT INTO run_items(run_id,source_id,status) VALUES ('run','us:6007:free','running')",
    );
    createSync(s);
    expect(s.one("SELECT status FROM runs WHERE id='run'").status).toBe(
      "interrupted",
    );
    expect(
      s.one("SELECT status FROM run_items WHERE run_id='run'").status,
    ).toBe("interrupted");
    expect(s.detail("1", "us")).toMatchObject({ watch: 1, tags: "待研究" });
  });
  it("reopen and online backup preserve saved research", async () => {
    const dir = mkdtempSync(join(tmpdir(), "deltabase-test-"));
    try {
      const path = join(dir, "db.sqlite");
      let disk = createStore(path);
      disk.saveMetadata("1", "us", metadata("1"));
      disk.run("UPDATE apps SET watch=1,tags='长期观察' WHERE id='1'");
      await disk.db.backup(join(dir, "backup.sqlite"));
      disk.db.close();
      disk = createStore(path);
      expect(disk.detail("1", "us").tags).toBe("长期观察");
      disk.db.close();
      const backup = createStore(join(dir, "backup.sqlite"));
      expect(backup.detail("1", "us").watch).toBe(1);
      backup.db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
