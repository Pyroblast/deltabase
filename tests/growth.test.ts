import { beforeEach, afterEach, it, expect } from "vitest";
import { createStore, type Store } from "../server/store";
import { createGrowthStore } from "../server/growth-store";
import { createGrowthSync } from "../server/growth-sync";
import {
  parseYCList,
  parseYCDetail,
  classify,
  YC_LIST_URL,
} from "../server/yc";
import { page, ycJob, detailPage, jobUrl, lead } from "./growth-fixtures";
let s: Store;
beforeEach(() => {
  s = createStore(":memory:");
});
afterEach(() => s.db.close());
it("parses public page data, preserves evidence and rejects changed formats or mismatched IDs", () => {
  const list = parseYCList(page({ jobPostings: [ycJob()] }));
  expect(list).toEqual([{ id: "101", url: jobUrl(101) }]);
  const data = parseYCDetail(detailPage(), list[0]);
  expect(data.company.website).toBe("https://example.com/");
  expect(data.evidence.map((e) => e.channel)).toContain("TikTok");
  expect(() => parseYCList("<h1>Sign in</h1>")).toThrow();
  expect(() => parseYCList(page({ jobPostings: [] }))).toThrow();
  expect(() =>
    parseYCList(page({ jobPostings: [ycJob(), ycJob()] })),
  ).toThrow();
  expect(() => parseYCDetail(detailPage(102), list[0])).toThrow("身份");
  expect(() =>
    parseYCList(
      page({ jobPostings: [ycJob(101, { url: "https://evil.example/job" })] }),
    ),
  ).toThrow();
});
it("classifies specific channel evidence and suppresses negated claims", () => {
  expect(
    classify("Growth opportunity", "Competitive salary and room for growth."),
  ).toEqual([]);
  expect(
    classify(
      "Marketing manager",
      "We do not run paid acquisition. No TikTok campaigns.",
    ),
  ).toEqual([]);
  expect(classify("SEO manager", "Build content marketing.")[0].text).toBe(
    "SEO manager",
  );
});
it("deduplicates repeated content, saves observations separately and records A-B-A changes", () => {
  const g = createGrowthStore(s);
  const a = g.save(lead(), "baseline", "2026-10-01T00:00:00.000Z");
  g.save(
    lead(101, { createdAt: "3 months" }),
    "discovered",
    "2026-10-02T00:00:00.000Z",
  );
  expect(s.all("SELECT * FROM growth_versions")).toHaveLength(1);
  expect(g.rows()[0].lastSeen).toBe("2026-10-02T00:00:00.000Z");
  g.save(
    lead(101, { description: "Recruit TikTok creators in new markets." }),
    "discovered",
  );
  g.save(lead(), "discovered");
  expect(
    s.all("SELECT event FROM growth_versions").map((v) => v.event),
  ).toEqual(["baseline", "changed", "changed"]);
  expect(g.rows()).toHaveLength(1);
  expect(g.detail(a.companyId)?.versions).toHaveLength(3);
});
it("builds a baseline, suppresses duplicate runs, tracks later discovery and preserves failed/absent jobs", async () => {
  let ids = [101, 102];
  let failed: number | null = 102;
  const sync = createGrowthSync(s, {
    interval: 0,
    fetch: async (url) => {
      if (url === YC_LIST_URL)
        return page({ jobPostings: ids.map((id) => ycJob(id)) });
      const id = Number(url.split("-").at(-1));
      if (id === failed) throw new Error("YC HTTP 404");
      return detailPage(id);
    },
  });
  const first = sync.start(true);
  expect(sync.start(true)?.id).toBe(first?.id);
  await sync.idle();
  expect(
    s.one("SELECT status FROM growth_runs WHERE id=?", first?.id)?.status,
  ).toBe("partial");
  failed = null;
  ids = [102, 103];
  sync.start(true);
  await sync.idle();
  expect(
    s.all("SELECT event FROM growth_versions ORDER BY id").map((v) => v.event),
  ).toEqual(["baseline", "baseline", "discovered"]);
  expect(
    s.one("SELECT in_latest_list FROM growth_leads WHERE id='yc:101'")
      ?.in_latest_list,
  ).toBe(0);
  expect(s.all("SELECT * FROM growth_observations")).toHaveLength(5);
  failed = 101;
  sync.start(true);
  await sync.idle();
  expect(s.all("SELECT * FROM growth_leads")).toHaveLength(3);
  expect(
    s.one("SELECT check_error FROM growth_leads WHERE id='yc:101'")
      ?.check_error,
  ).toContain("404");
  await sync.stop();
});
it("keeps existing data on list parsing failure, stops platform blocks and supports shutdown", async () => {
  createGrowthStore(s).save(lead(), "baseline");
  const sync = createGrowthSync(s, {
    interval: 0,
    fetch: async () => "<html>Blocked</html>",
  });
  sync.start(true);
  await sync.idle();
  expect(s.one("SELECT status FROM growth_source_state")?.status).toBe(
    "failed",
  );
  expect(s.all("SELECT * FROM growth_leads")).toHaveLength(1);
  let reads = 0;
  const blocked = createGrowthSync(s, {
    interval: 0,
    fetch: async (url) => {
      reads++;
      if (url === YC_LIST_URL)
        return page({ jobPostings: [ycJob(), ycJob(102)] });
      throw new Error("YC HTTP 403");
    },
  });
  blocked.start(true);
  await blocked.idle();
  expect(reads).toBe(2);
  const slow = createGrowthSync(s, {
    interval: 10000,
    fetch: async () => page({ jobPostings: [ycJob()] }),
  });
  slow.start(true);
  await slow.stop();
  expect(s.one("SELECT status FROM growth_source_state")?.status).toBe(
    "interrupted",
  );
});
