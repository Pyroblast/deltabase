import { beforeEach, afterEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createStore, type Store } from "../server/store";
import { createApp } from "../server/app";
import { createGrowthStore } from "../server/growth-store";
import {
  fundingDraft,
  fundingEvidence,
  unknownFundingDate,
} from "./funding-fixtures";
import { lead } from "./growth-fixtures";
import type { FundingDraft, FundingDetail } from "../shared/funding";
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
const key = () => randomUUID();
async function create(
  data = fundingDraft(),
  extra: Record<string, unknown> = {},
) {
  return app.inject({
    method: "POST",
    url: "/api/funding",
    payload: { idempotencyKey: key(), data, ...extra },
  });
}
async function detail(id: string): Promise<FundingDetail> {
  return (await app.inject(`/api/funding/${id}`)).json();
}
async function update(
  id: string,
  data: FundingDraft,
  version: number,
  extra: Record<string, unknown> = {},
) {
  return app.inject({
    method: "PUT",
    url: `/api/funding/${id}`,
    payload: {
      idempotencyKey: key(),
      expectedVersion: version,
      data,
      reason: "测试修改",
      ...extra,
    },
  });
}
it("creates an independent funding company without inflating growth coverage", async () => {
  const g = createGrowthStore(s).save(lead(), "baseline");
  const res = await create();
  expect(res.statusCode).toBe(201);
  const d = await detail(res.json().id);
  expect(d.event.companyId).toMatch(/^company:/);
  expect(d.event.data.occurred.value).toBeNull();
  expect(d.event.data.published.value).toBe("2026-07-07");
  expect(d.event.firstSeenAt).not.toBe("2026-07-07");
  await app.inject({
    method: "PATCH",
    url: `/api/growth/companies/${d.event.companyId}`,
    payload: { watch: true, notes: "融资公司笔记" },
  });
  expect((await app.inject("/api/growth")).json().totals).toEqual({
    leads: 1,
    companies: 1,
    watched: 0,
  });
  expect((await app.inject("/api/funding/companies")).json()).toHaveLength(2);
  expect((await app.inject("/api/growth/companies")).json()).toHaveLength(2);
  expect(
    (await app.inject(`/api/growth/companies/${g.companyId}`)).statusCode,
  ).toBe(200);
  expect(d.appLinks).toEqual([]);
});
it("uses existing company identity without overwriting company notes and permits incomplete leads", async () => {
  const g = createGrowthStore(s).save(lead(), "baseline");
  s.run(
    "UPDATE growth_companies SET notes='existing notes',watch=1 WHERE id=?",
    g.companyId,
  );
  const res = await create(
    fundingDraft({
      company: { id: g.companyId },
      companyReason: "根据官网链接人工核对",
    }),
  );
  expect(res.statusCode).toBe(201);
  expect((await detail(res.json().id)).event.company.notes).toBe(
    "existing notes",
  );
  const incomplete = fundingDraft({
    company: { name: "测试证据不足", website: "" },
    recordKind: "lead",
    roundRaw: "",
    roundNormalized: "",
    amount: {
      raw: "",
      scope: "round",
      kind: "undisclosed",
      currency: null,
      value: null,
      upper: null,
    },
    published: unknownFundingDate(),
    investors: [],
    evidence: [
      {
        ...fundingEvidence("background", "https://other.example/background"),
        supports: ["company"],
      },
    ],
  });
  expect((await create(incomplete)).statusCode).toBe(201);
  expect((await app.inject("/api/funding?recordKind=event")).json().total).toBe(
    1,
  );
  expect(
    (await app.inject("/api/funding?recordKind=lead")).json().items[0].data
      .amount.value,
  ).toBeNull();
});
it("makes retry idempotent globally and rejects same-key changed payload even after a later edit", async () => {
  const request = { idempotencyKey: key(), data: fundingDraft() };
  const send = (payload: unknown) =>
    app.inject({
      method: "POST",
      url: "/api/funding",
      payload: payload as any,
    });
  const first = (await send(request)).json();
  expect((await send(request)).json()).toMatchObject({
    ...first,
    replayed: true,
  });
  const d = await detail(first.id);
  await update(first.id, { ...d.event.data, notes: "later edit" }, 1);
  expect((await send(request)).json()).toMatchObject({
    id: first.id,
    version: 1,
    replayed: true,
  });
  const changed = await send({
    ...request,
    data: { ...request.data, title: "different" },
  });
  expect(changed.statusCode).toBe(409);
  expect(changed.json().code).toBe("IDEMPOTENCY_CONFLICT");
  const otherPath = await update(first.id, d.event.data, 2, {
    idempotencyKey: request.idempotencyKey,
  });
  expect(otherPath.json().code).toBe("IDEMPOTENCY_CONFLICT");
  expect(s.one("SELECT COUNT(*) n FROM funding_events")!.n).toBe(1);
});
it("checks optimistic versions, ignores equivalent ordering and preserves A-B-A revisions", async () => {
  const id = (await create()).json().id;
  const a = (await detail(id)).event.data;
  const noChange = await update(
    id,
    {
      ...a,
      evidence: a.evidence.map((e) => ({
        ...e,
        supports: [...e.supports].reverse(),
      })),
    },
    1,
  );
  expect(noChange.json()).toMatchObject({ version: 1, changed: false });
  expect(
    (
      await update(
        id,
        { ...a, amount: { ...a.amount, raw: "约200万美元", value: "2000000" } },
        1,
      )
    ).json().version,
  ).toBe(2);
  const stale = await update(id, a, 1);
  expect(stale.statusCode).toBe(409);
  expect(stale.json()).toMatchObject({
    code: "VERSION_CONFLICT",
    currentVersion: 2,
  });
  expect((await update(id, a, 2)).json().version).toBe(3);
  const d = await detail(id);
  expect(d.revisions.map((v) => v.snapshot.data.amount.value)).toEqual([
    "1000000",
    "2000000",
    "1000000",
  ]);
  expect(d.event.firstSeenAt).toBe(d.revisions.at(-1)!.createdAt);
});
it("reuses documents across events without mutating another event's evidence or historical snapshots", async () => {
  const id = (await create()).json().id;
  const original = await detail(id);
  const second = await create(
    {
      ...original.event.data,
      roundRaw: "Series B",
      roundNormalized: "series_b",
      title: "测试 B 轮",
      evidence: original.event.data.evidence.map((e) => ({
        ...e,
        summary: "同文档用于另一轮的摘录",
      })),
    },
    { separateReason: "同一篇文章回顾两轮融资" },
  );
  expect(second.statusCode).toBe(201);
  const otherId = second.json().id;
  const other = await detail(otherId);
  expect(original.documents[0].documentId).toBe(other.documents[0].documentId);
  const edited = await update(
    otherId,
    {
      ...other.event.data,
      evidence: other.event.data.evidence.map((e) => ({
        ...e,
        summary: "修订 B 轮的字段解释",
      })),
    },
    1,
  );
  expect(edited.statusCode).toBe(200);
  expect((await detail(id)).event.data.evidence[0].summary).toBe(
    original.event.data.evidence[0].summary,
  );
  expect(
    (await detail(otherId)).revisions.at(-1)!.snapshot.data.evidence[0].summary,
  ).toBe("同文档用于另一轮的摘录");
  const appended = await app.inject({
    method: "POST",
    url: `/api/funding/${id}/evidence`,
    payload: {
      idempotencyKey: key(),
      expectedVersion: 1,
      evidence: {
        ...fundingEvidence("investor", "https://investor.example/round"),
        role: "investor",
        supports: ["investors"],
      },
      reason: "补充投资方公告",
    },
  });
  expect(appended.statusCode).toBe(200);
  expect((await detail(id)).documents).toHaveLength(2);
  expect((await detail(otherId)).documents).toHaveLength(1);
});
it("prompts for possible rounds without merging names and allows an explained separate event", async () => {
  const id = (await create()).json().id;
  const existing = await detail(id);
  const sameName = fundingDraft({
    company: { name: "测试融资公司", website: "https://different.example" },
    evidence: [fundingEvidence("source-one", "https://different.example/news")],
  });
  const candidates = await app.inject({
    method: "POST",
    url: "/api/funding/duplicates",
    payload: { data: sameName },
  });
  expect(candidates.json().candidates[0].id).toBe(id);
  const blocked = await create(sameName);
  expect(blocked.statusCode).toBe(409);
  expect(blocked.json().code).toBe("DUPLICATE_CANDIDATES");
  expect(s.one("SELECT COUNT(*) n FROM growth_companies")!.n).toBe(1);
  const allowed = await create(sameName, {
    separateReason: "同名但不同法律主体，经官网核对",
  });
  expect(allowed.statusCode).toBe(201);
  const second = await detail(allowed.json().id);
  expect(second.event.companyId).not.toBe(existing.event.companyId);
  expect(second.revisions[0].reason).toContain("不同法律主体");
});
it("retains event content on failed verification and snapshots observation evidence", async () => {
  const id = (await create()).json().id;
  const original = await detail(id);
  const payload = {
    idempotencyKey: key(),
    expectedVersion: 1,
    evidenceKey: "source-one",
    outcome: "unavailable",
    note: "登录墙，未能核验原文",
  };
  const submit = () =>
    app.inject({
      method: "POST",
      url: `/api/funding/${id}/observations`,
      payload,
    });
  expect((await submit()).statusCode).toBe(201);
  expect((await submit()).json().replayed).toBe(true);
  const d = await detail(id);
  expect(d.event.version).toBe(1);
  expect(d.event.data).toEqual(original.event.data);
  expect(d.observations).toHaveLength(1);
  await update(
    id,
    {
      ...d.event.data,
      evidence: d.event.data.evidence.map((e) => ({
        ...e,
        summary: "later revised source interpretation",
      })),
    },
    1,
  );
  expect((await detail(id)).observations[0].evidence.summary).toBe(
    original.event.data.evidence[0].summary,
  );
  const bad = await app.inject({
    method: "POST",
    url: `/api/funding/${id}/observations`,
    payload: {
      ...payload,
      idempotencyKey: key(),
      expectedVersion: 2,
      evidenceKey: "missing",
    },
  });
  expect(bad.statusCode).toBe(404);
});
it("archives duplicate records with an audit path, rejects cycles and permits restoration", async () => {
  const id = (await create()).json().id;
  const first = await detail(id);
  const second = (
    await create(
      { ...first.event.data, title: "重复收录" },
      { separateReason: "测试明确另建" },
    )
  ).json().id;
  const archive = (
    eventId: string,
    version: number,
    archived: boolean,
    duplicateOf: string | null = null,
  ) =>
    app.inject({
      method: "POST",
      url: `/api/funding/${eventId}/archive`,
      payload: {
        idempotencyKey: key(),
        expectedVersion: version,
        archived,
        duplicateOf,
        reason: "人工核对重复",
      },
    });
  expect((await archive(second, 1, true, id)).statusCode).toBe(200);
  expect((await app.inject("/api/funding")).json().total).toBe(1);
  expect(
    (await app.inject("/api/funding?archived=1")).json().items[0].duplicateOf,
  ).toBe(id);
  expect(
    (await update(second, (await detail(second)).event.data, 2)).json().code,
  ).toBe("ARCHIVED");
  expect((await archive(id, 1, true, second)).statusCode).toBe(409);
  expect((await archive(second, 2, false)).statusCode).toBe(200);
  expect((await detail(second)).revisions).toHaveLength(3);
  expect((await archive(second, 3, true, second)).statusCode).toBe(400);
});
it("separates publication and discovery filters, supports month precision and unknown dates", async () => {
  const id = (await create()).json().id;
  const initial = (await detail(id)).event.data;
  s.run(
    "UPDATE funding_events SET first_seen_at='2026-11-01T01:00:00.000Z' WHERE id=?",
    id,
  );
  expect(
    (await app.inject("/api/funding?dateType=published&from=2026-11-01")).json()
      .total,
  ).toBe(0);
  expect(
    (
      await app.inject(
        "/api/funding?dateType=discovered&from=2026-11-01&to=2026-11-01",
      )
    ).json().total,
  ).toBe(1);
  await update(
    id,
    {
      ...initial,
      published: { raw: "July 2026", value: "2026-07", precision: "month" },
    },
    1,
  );
  expect(
    (
      await app.inject(
        "/api/funding?dateType=published&from=2026-07-20&to=2026-07-21",
      )
    ).json().total,
  ).toBe(1);
  await update(id, { ...initial, published: unknownFundingDate() }, 2);
  expect(
    (await app.inject("/api/funding?dateType=published&unknownDate=1")).json()
      .total,
  ).toBe(1);
  expect(
    (await app.inject("/api/funding?dateType=published&from=2026-01-01")).json()
      .total,
  ).toBe(0);
});
it("rolls back all company, document, event and idempotency writes on a persistence failure", async () => {
  s.db.exec(
    "CREATE TRIGGER reject_revision BEFORE INSERT ON funding_revisions BEGIN SELECT RAISE(ABORT, 'simulated persistence failure'); END",
  );
  const request = { idempotencyKey: key(), data: fundingDraft() };
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/funding",
        payload: request,
      })
    ).statusCode,
  ).toBe(500);
  for (const table of [
    "growth_companies",
    "funding_events",
    "funding_documents",
    "funding_revisions",
    "funding_idempotency",
  ])
    expect(s.one(`SELECT COUNT(*) n FROM ${table}`)!.n).toBe(0);
  s.db.exec("DROP TRIGGER reject_revision");
  const success = await app.inject({
    method: "POST",
    url: "/api/funding",
    payload: request,
  });
  expect(success.statusCode).toBe(201);
  const d = await detail(success.json().id);
  s.db.exec(
    "CREATE TRIGGER reject_revision BEFORE INSERT ON funding_revisions BEGIN SELECT RAISE(ABORT, 'simulated persistence failure'); END",
  );
  expect(
    (
      await update(
        d.event.id,
        { ...d.event.data, notes: "must not persist" },
        1,
      )
    ).statusCode,
  ).toBe(500);
  expect((await detail(d.event.id)).event.data.notes).toBe("");
  expect((await detail(d.event.id)).event.version).toBe(1);
});

it("serializes competing writes and preserves company reassignment history", async () => {
  const id = (await create()).json().id;
  const original = await detail(id);
  const results = await Promise.all([
    update(id, { ...original.event.data, notes: "writer A" }, 1),
    update(id, { ...original.event.data, notes: "writer B" }, 1),
  ]);
  expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  expect((await detail(id)).revisions).toHaveLength(2);
  const current = await detail(id);
  const reassigned = await update(
    id,
    {
      ...current.event.data,
      company: {
        name: "人工更正后的公司",
        website: "https://corrected.example",
      },
      companyReason: "原记录误选，核对公告主体后更正",
    },
    2,
  );
  expect(reassigned.statusCode).toBe(200);
  const d = await detail(id);
  expect(d.event.companyId).not.toBe(original.event.companyId);
  expect(d.revisions[0].snapshot.company.name).toBe("人工更正后的公司");
  expect(d.revisions.at(-1)!.snapshot.company.name).toBe("测试融资公司");
  expect(s.one("SELECT COUNT(*) n FROM growth_app_links")!.n).toBe(0);
});
