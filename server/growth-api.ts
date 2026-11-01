import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Store } from "./store.js";
import { createGrowthStore } from "./growth-store.js";
import { createGrowthSync } from "./growth-sync.js";
import { classify, safeWebsite, YC_LIST_URL } from "./yc.js";
import type { GrowthLead } from "../shared/growth.js";
const text = (max = 1000) => z.string().trim().max(max).default("");
const idParam = z.object({ id: z.string().min(1).max(150) });
const manualSchema = z
  .object({
    source: z.enum(["sideshift", "wellfound"]),
    url: z.string().url().max(2000),
    companyId: z.string().max(150).optional(),
    companyName: z.string().trim().min(1).max(200),
    website: text(2000).refine(
      (s) => !s || !!safeWebsite(s),
      "官网须为 http 或 https 地址",
    ),
    title: z.string().trim().min(1).max(500),
    publisher: text(200),
    kind: z.enum(["job", "campaign"]),
    description: z.string().trim().min(1).max(30000),
    location: text(),
    targetMarket: text(),
    compensation: text(),
    compensationUnit: text(200),
    publishedLabel: text(200),
    employmentType: text(200),
  })
  .superRefine((b, ctx) => {
    const u = new URL(b.url);
    const domain = b.source === "sideshift" ? "sideshift.app" : "wellfound.com";
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      !(u.hostname === domain || u.hostname.endsWith(`.${domain}`))
    )
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: `请输入 ${domain} 的 HTTPS 原始链接`,
      });
  });
function canonical(input: string) {
  const u = new URL(input);
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (key.startsWith("utm_") || ["ref", "referral"].includes(key))
      u.searchParams.delete(key);
  u.pathname = u.pathname.replace(/\/$/, "") || "/";
  return u.href;
}
export function registerGrowth(
  app: FastifyInstance,
  s: Store,
  autoSync = false,
) {
  const growth = createGrowthStore(s);
  const sync = createGrowthSync(s);
  app.get("/api/growth", async (req) => {
    const q = z
      .object({
        q: text(200),
        source: z.enum(["", "yc", "sideshift", "wellfound"]).default(""),
        channel: text(100),
        view: z.enum(["all", "watch", "ignored", "changes"]).default("all"),
      })
      .parse(req.query);
    const allLeads = growth.rows();
    const companyMap = new Map(growth.companies().map((c) => [c.id, c]));
    const leads = allLeads.filter((l) => {
      const c = companyMap.get(l.companyId)!;
      return (
        (q.view === "ignored" ? c.ignored : !c.ignored) &&
        (q.view !== "watch" || c.watch) &&
        (q.view !== "changes" || ["discovered", "changed"].includes(l.event)) &&
        (!q.source || l.source === q.source) &&
        (!q.channel || l.evidence.some((e) => e.channel === q.channel)) &&
        (!q.q ||
          [c.name, c.summary, l.title, l.description, l.publisher]
            .join(" ")
            .toLowerCase()
            .includes(q.q.toLowerCase()))
      );
    });
    return {
      leads,
      companies: [...companyMap.values()].filter((c) =>
        leads.some((l) => l.companyId === c.id),
      ),
      totals: {
        leads: allLeads.length,
        companies: companyMap.size,
        watched: [...companyMap.values()].filter((c) => c.watch).length,
      },
    };
  });
  app.get("/api/growth/companies", async () => growth.companies());
  app.get("/api/growth/status", async () => ({
    source: {
      ...s.one("SELECT * FROM growth_source_state WHERE id='yc'"),
      baseline_ids: undefined,
      url: YC_LIST_URL,
    },
    runs: s.all("SELECT * FROM growth_runs ORDER BY started_at DESC LIMIT 10"),
    failures: s.all(
      "SELECT url,error FROM growth_observations WHERE run_id=(SELECT id FROM growth_runs ORDER BY started_at DESC LIMIT 1) AND error IS NOT NULL",
    ),
  }));
  app.post("/api/growth/sync", async (_, reply) =>
    reply.code(202).send({ run: sync.start(true) }),
  );
  app.get("/api/growth/companies/:id", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    return growth.detail(id) ?? reply.code(404).send({ error: "公司不存在" });
  });
  app.patch("/api/growth/companies/:id", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const b = z
      .object({
        watch: z.boolean().optional(),
        ignored: z.boolean().optional(),
        notes: z.string().max(30000).optional(),
      })
      .parse(req.body);
    if (!growth.detail(id))
      return reply.code(404).send({ error: "公司不存在" });
    for (const key of ["watch", "ignored", "notes"] as const)
      if (b[key] !== undefined)
        s.run(
          `UPDATE growth_companies SET ${key}=? WHERE id=?`,
          key === "notes" ? b[key] : Number(b[key]),
          id,
        );
    return { ok: true };
  });
  async function manual(req: any, reply: any, edit = false) {
    const b = manualSchema.parse(req.body);
    const id = edit ? idParam.parse(req.params).id : null;
    const previous = id
      ? s.one("SELECT * FROM growth_leads WHERE id=?", id)
      : null;
    if (edit && (!previous || previous.source === "yc"))
      return reply.code(404).send({ error: "手动线索不存在" });
    if (previous && previous.source !== b.source)
      return reply.code(400).send({ error: "编辑时不能更换来源" });
    const url = canonical(b.url);
    const duplicate = s.one(
      "SELECT id FROM growth_leads WHERE source=? AND url=? AND id<>?",
      b.source,
      url,
      id ?? "",
    );
    if (duplicate)
      return reply
        .code(409)
        .send({ error: "这条链接已经录入，请打开原线索编辑" });
    const companyId = previous?.company_id ?? b.companyId;
    const company = companyId
      ? s.one("SELECT * FROM growth_companies WHERE id=?", companyId)
      : null;
    if (companyId && !company)
      return reply.code(400).send({ error: "所选公司不存在" });
    const lead: GrowthLead = {
      ...b,
      externalId: previous
        ? JSON.parse(previous.payload).externalId
        : randomUUID(),
      url,
      company: {
        name: company?.name ?? b.companyName,
        website: company?.website ?? b.website,
        summary: company?.summary ?? "",
        batch: company?.batch ?? "",
      },
      evidence: classify(b.title, b.description),
    };
    const result = growth.save(lead, "manual", s.now(), companyId);
    return reply.code(edit ? 200 : 201).send(result);
  }
  app.post("/api/growth/leads", (req, reply) => manual(req, reply));
  app.put("/api/growth/leads/:id", (req, reply) => manual(req, reply, true));
  app.get("/api/growth/versions/:id", async (req, reply) => {
    const { id } = z
      .object({ id: z.coerce.number().int().positive() })
      .parse(req.params);
    const row = s.one("SELECT * FROM growth_versions WHERE id=?", id);
    return row
      ? { ...row, payload: JSON.parse(row.payload) }
      : reply.code(404).send({ error: "证据版本不存在" });
  });
  app.get("/api/growth/app-candidates", async (req) => {
    const { q } = z
      .object({ q: z.string().trim().min(1).max(200) })
      .parse(req.query);
    return s.all(
      "SELECT app_id AS id,name,developer,market,icon FROM listings WHERE app_id=? OR name LIKE ? OR developer LIKE ? ORDER BY name LIMIT 30",
      q,
      `%${q}%`,
      `%${q}%`,
    );
  });
  app.post("/api/growth/companies/:id/apps", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { appId } = z
      .object({ appId: z.string().regex(/^\d+$/).max(20) })
      .parse(req.body);
    if (!growth.detail(id) || !s.one("SELECT id FROM apps WHERE id=?", appId))
      return reply
        .code(404)
        .send({ error: "公司或本地 App 不存在，请先在观察名单添加 App" });
    s.run(
      "INSERT OR IGNORE INTO growth_app_links (company_id,app_id,confirmed_at) VALUES (?,?,?)",
      id,
      appId,
      s.now(),
    );
    return { ok: true };
  });
  app.delete("/api/growth/companies/:id/apps/:appId", async (req) => {
    const { id, appId } = z
      .object({ id: z.string(), appId: z.string().regex(/^\d+$/) })
      .parse(req.params);
    s.run(
      "DELETE FROM growth_app_links WHERE company_id=? AND app_id=?",
      id,
      appId,
    );
    return { ok: true };
  });
  app.addHook("onClose", async () => {
    await sync.stop();
  });
  if (autoSync)
    app.addHook("onListen", async () => {
      sync.start();
    });
}
