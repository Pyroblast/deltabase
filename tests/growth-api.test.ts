import { beforeEach, afterEach, it, expect } from "vitest";
import { createStore, type Store } from "../server/store";
import { createApp } from "../server/app";
import { createGrowthStore } from "../server/growth-store";
import { manual, lead } from "./growth-fixtures";
import { feed } from "./fixtures";
let s: Store;
let app: Awaited<ReturnType<typeof createApp>>;
beforeEach(async () => {
  s = createStore(":memory:");
  app = await createApp(s);
});
afterEach(async () => {
  await app.close();
  s.db.close();
});
it("creates manual clues, rejects duplicate/unsafe URLs and stores edits as history", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/growth/leads",
    payload: manual,
  });
  expect(res.statusCode).toBe(201);
  const { id, companyId } = res.json();
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/growth/leads",
        payload: { ...manual, url: manual.url + "?utm_source=test#hash" },
      })
    ).statusCode,
  ).toBe(409);
  for (const url of [
    "https://sideshift.app.evil.example/jobs/1",
    "javascript:alert(1)",
    "http://app.sideshift.app/jobs/1",
  ]) {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/growth/leads",
          payload: { ...manual, url },
        })
      ).statusCode,
    ).toBe(400);
  }
  expect(
    (
      await app.inject({
        method: "PUT",
        url: `/api/growth/leads/${id}`,
        payload: { ...manual, title: "修订后的线索" },
      })
    ).statusCode,
  ).toBe(200);
  const detail = (
    await app.inject(`/api/growth/companies/${companyId}`)
  ).json();
  expect(detail.versions).toHaveLength(2);
  expect(detail.leads[0].publisher).toBe("测试代理商");
  expect(detail.leads[0].title).toBe("修订后的线索");
});
it("adds Wellfound to an existing company, filters, follows, ignores and saves notes", async () => {
  const { companyId } = createGrowthStore(s).save(lead(), "baseline");
  const res = await app.inject({
    method: "POST",
    url: "/api/growth/leads",
    payload: {
      ...manual,
      source: "wellfound",
      url: "https://wellfound.com/jobs/123",
      kind: "job",
      companyId,
    },
  });
  expect(res.statusCode).toBe(201);
  expect((await app.inject("/api/growth")).json().totals.companies).toBe(1);
  expect(
    (await app.inject("/api/growth?source=wellfound&channel=TikTok")).json()
      .leads,
  ).toHaveLength(1);
  await app.inject({
    method: "PATCH",
    url: `/api/growth/companies/${companyId}`,
    payload: { watch: true, notes: "有待验证", ignored: true },
  });
  expect((await app.inject("/api/growth")).json().leads).toHaveLength(0);
  expect(
    (await app.inject("/api/growth?view=ignored")).json().leads,
  ).toHaveLength(2);
  expect(
    (await app.inject(`/api/growth/companies/${companyId}`)).json().company
      .notes,
  ).toBe("有待验证");
});
it("confirms and removes company-App links without changing App data", async () => {
  const { companyId } = createGrowthStore(s).save(lead(), "baseline");
  s.saveFeed(
    s.one("SELECT * FROM sources WHERE id='us:6007:free'")!,
    feed(["1"]),
  );
  const path = `/api/growth/companies/${companyId}/apps`;
  expect(
    (await app.inject({ method: "POST", url: path, payload: { appId: "1" } }))
      .statusCode,
  ).toBe(200);
  expect(
    (await app.inject(`/api/growth/companies/${companyId}`)).json().links,
  ).toHaveLength(1);
  await app.inject({ method: "DELETE", url: path + "/1" });
  expect(
    (await app.inject(`/api/growth/companies/${companyId}`)).json().links,
  ).toHaveLength(0);
  expect(s.all("SELECT * FROM ranks")).toHaveLength(1);
  expect(
    (
      await app.inject({
        method: "POST",
        url: path,
        payload: { appId: "9999" },
      })
    ).statusCode,
  ).toBe(404);
});

it("retains manual sources, notes and App links after closing and reopening the database", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "deltabase-growth-"));
  let disk = createStore(join(dir, "test.sqlite"));
  let server = await createApp(disk);
  try {
    const created = (
      await server.inject({
        method: "POST",
        url: "/api/growth/leads",
        payload: manual,
      })
    ).json();
    await server.inject({
      method: "POST",
      url: "/api/growth/leads",
      payload: {
        ...manual,
        source: "wellfound",
        url: "https://wellfound.com/jobs/persistence",
        companyId: created.companyId,
      },
    });
    await server.inject({
      method: "PATCH",
      url: `/api/growth/companies/${created.companyId}`,
      payload: { watch: true, notes: "重启后仍保留的研究笔记" },
    });
    disk.saveFeed(
      disk.one("SELECT * FROM sources WHERE id='us:6007:free'")!,
      feed(["1"]),
    );
    await server.inject({
      method: "POST",
      url: `/api/growth/companies/${created.companyId}/apps`,
      payload: { appId: "1" },
    });
    await server.close();
    disk.db.close();
    disk = createStore(join(dir, "test.sqlite"));
    server = await createApp(disk);
    const restored = (
      await server.inject(`/api/growth/companies/${created.companyId}`)
    ).json();
    expect(restored.company.notes).toBe("重启后仍保留的研究笔记");
    expect(restored.company.watch).toBe(1);
    expect(restored.leads.map((l: any) => l.source).sort()).toEqual([
      "sideshift",
      "wellfound",
    ]);
    expect(restored.links[0].id).toBe("1");
    expect(restored.versions).toHaveLength(2);
  } finally {
    await server.close();
    if (disk.db.open) disk.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
