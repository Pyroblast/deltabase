import { beforeEach, afterEach, it, expect } from "vitest";
import { createStore, type Store } from "../server/store";
import { createApp } from "../server/app";
import { feed } from "./fixtures";
import type { Source } from "../server/apple";
let s: Store;
let app: Awaited<ReturnType<typeof createApp>>;
beforeEach(async () => {
  s = createStore(":memory:");
  s.saveFeed(
    s.one<Source>("SELECT * FROM sources WHERE id='us:6007:free'")!,
    feed(["1"]),
  );
  app = await createApp(s);
});
afterEach(async () => {
  await app.close();
  s.db.close();
});
it("reads filtered products, follows and tags them", async () => {
  expect((await app.inject("/api/apps?market=us&kind=free")).json().total).toBe(
    1,
  );
  await app.inject({
    method: "PATCH",
    url: "/api/apps/1",
    payload: { watch: true, tags: "待验证" },
  });
  expect((await app.inject("/api/watchlist?market=us")).json()[0].tags).toBe(
    "待验证",
  );
});
it("validates notes, supports create edit delete and rejects unsafe links", async () => {
  let res = await app.inject({
    method: "POST",
    url: "/api/apps/1/notes",
    payload: { hypothesis: "小众需求", links: "javascript:alert(1)" },
  });
  expect(res.statusCode).toBe(400);
  res = await app.inject({
    method: "POST",
    url: "/api/apps/1/notes",
    payload: {
      hypothesis: "小众需求",
      evidence: "排名持续稳定",
      links: "https://example.com",
    },
  });
  const id = res.json().id;
  expect(id).toBeGreaterThan(0);
  await app.inject({
    method: "PUT",
    url: `/api/notes/${id}`,
    payload: { hypothesis: "修订假设", nextStep: "访谈" },
  });
  expect(s.one("SELECT hypothesis FROM notes WHERE id=?", id).hypothesis).toBe(
    "修订假设",
  );
  await app.inject({ method: "DELETE", url: `/api/notes/${id}` });
  expect(s.all("SELECT * FROM notes")).toHaveLength(0);
});
it("rejects invalid filters and cross-origin mutations", async () => {
  expect((await app.inject("/api/apps?market=invalid")).statusCode).toBe(400);
  expect(
    (
      await app.inject({
        method: "PATCH",
        url: "/api/apps/1",
        headers: { origin: "https://evil.example" },
        payload: { watch: true },
      })
    ).statusCode,
  ).toBe(403);
});
it("returns a parsed original evidence snapshot", async () => {
  const id = s.one("SELECT id FROM snapshots").id;
  const res = await app.inject(`/api/snapshots/${id}`);
  expect(res.statusCode).toBe(200);
  expect(res.json().feed.entry[0].id.attributes["im:id"]).toBe("1");
});
it("changes collection settings and marks ignored products without deleting history", async () => {
  await app.inject({
    method: "PATCH",
    url: "/api/sources",
    payload: { kind: "grossing", enabled: false },
  });
  expect(
    s.one(
      "SELECT COUNT(*) AS n FROM sources WHERE kind='grossing' AND enabled=1",
    ).n,
  ).toBe(0);
  await app.inject({
    method: "PATCH",
    url: "/api/apps/1",
    payload: { ignored: true },
  });
  expect((await app.inject("/api/apps?market=us")).json().total).toBe(0);
  expect((await app.inject("/api/apps?market=us&ignored=1")).json().total).toBe(
    1,
  );
});
