import Fastify from "fastify";
import { registerGrowth } from "./growth-api.js";
import staticPlugin from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { z } from "zod";
import { categories } from "../shared/catalog.js";
import { feedUrl, type Source } from "./apple.js";
import { createSync } from "./sync.js";
import type { Store } from "./store.js";

const marketSchema = z.enum(["us", "cn"]);
const kindSchema = z.enum(["free", "paid", "grossing"]);
const idSchema = z.string().regex(/^\d+$/).max(20);
const noteSchema = z
  .object({
    audience: z.string().max(3000).default(""),
    hypothesis: z.string().trim().min(1).max(10000),
    evidence: z.string().max(20000).default(""),
    nextStep: z.string().max(10000).default(""),
    links: z.string().max(10000).default(""),
  })
  .superRefine((n, ctx) => {
    for (const link of n.links
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)) {
      try {
        if (!["http:", "https:"].includes(new URL(link).protocol))
          throw new Error();
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "来源链接须为 http 或 https 地址",
          path: ["links"],
        });
      }
    }
  });
export async function createApp(
  store: Store,
  opts: { autoSync?: boolean; staticDir?: string; logger?: boolean } = {},
) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 100_000 });
  const sync = createSync(store);
  app.addHook("onRequest", async (req, reply) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      const allowed = new Set(
        ["3000", "5173", process.env.PORT ?? "3000"].flatMap((port) => [
          `http://127.0.0.1:${port}`,
          `http://localhost:${port}`,
        ]),
      );
      if (
        req.headers["sec-fetch-site"] === "cross-site" ||
        (origin && !allowed.has(origin))
      )
        return reply.code(403).send({ error: "只接受本地工作台请求" });
    }
  });
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof z.ZodError)
      return reply
        .code(400)
        .send({ error: err.issues.map((x) => x.message).join("；") });
    req.log.error(err);
    return reply
      .code((err as any).statusCode ?? 500)
      .send({ error: err instanceof Error ? err.message : "请求失败" });
  });
  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/catalog", async () => ({
    categories,
    markets: ["us", "cn"],
    kinds: ["free", "paid", "grossing"],
  }));
  app.get("/api/stats", async () => ({
    apps: store.one("SELECT COUNT(*) AS n FROM apps").n,
    watched: store.one("SELECT COUNT(*) AS n FROM apps WHERE watch=1").n,
    signals: store.one(
      "SELECT COUNT(*) AS n FROM events e JOIN apps a ON a.id=e.app_id WHERE a.ignored=0 AND e.observed_at>=?",
      new Date(Date.now() - 86400000).toISOString(),
    ).n,
    snapshots: store.one("SELECT COUNT(*) AS n FROM snapshots").n,
    covered: store.one(
      "SELECT COUNT(*) AS n FROM sources WHERE enabled=1 AND status='success'",
    ).n,
    enabled: store.one("SELECT COUNT(*) AS n FROM sources WHERE enabled=1").n,
    lastSuccess: store.one("SELECT MAX(last_success) AS t FROM sources").t,
    run:
      store.one("SELECT * FROM runs ORDER BY started_at DESC LIMIT 1") ?? null,
  }));
  app.get("/api/apps", async (req) => {
    const q = z
      .object({
        market: marketSchema.default("us"),
        kind: z.enum(["free", "paid", "grossing", "cross"]).default("free"),
        category: z.coerce.number().int().default(0),
        q: z.string().max(200).default(""),
        ignored: z.enum(["0", "1"]).default("0"),
        focus: z.enum(["0", "1"]).default("0"),
        page: z.coerce.number().int().min(1).default(1),
      })
      .parse(req.query);
    return store.ranked({
      ...q,
      ignored: q.ignored === "1",
      focus: q.focus === "1",
    });
  });
  app.get("/api/watchlist", async (req) => {
    const q = z
      .object({ market: marketSchema.default("us"), q: z.string().default("") })
      .parse(req.query);
    return store.watchlist(q.market, q.q);
  });
  app.get("/api/signals", async (req) => {
    const q = z
      .object({
        market: marketSchema.default("us"),
        kind: kindSchema.optional(),
        category: z.coerce.number().int().default(0),
        day: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(req.query);
    return store.signals(q);
  });
  app.get("/api/apps/:id", async (req, reply) => {
    const { id } = z.object({ id: idSchema }).parse(req.params);
    const { market } = z
      .object({ market: marketSchema.default("us") })
      .parse(req.query);
    const result = store.detail(id, market);
    return (
      result ??
      reply
        .code(404)
        .send({ error: "这个地区尚无该产品资料，请切换地区或手动添加" })
    );
  });
  app.post("/api/apps/:id/metadata", async (req, reply) => {
    const { id } = z.object({ id: idSchema }).parse(req.params);
    const { market } = z.object({ market: marketSchema }).parse(req.body);
    try {
      await sync.metadata(id, market);
      return { ok: true };
    } catch (err) {
      return reply
        .code(502)
        .send({ error: String(err instanceof Error ? err.message : err) });
    }
  });
  app.post("/api/apps", async (req, reply) => {
    const { input, market } = z
      .object({ input: z.string().trim().max(2000), market: marketSchema })
      .parse(req.body);
    let id = input;
    if (!/^\d+$/.test(id)) {
      try {
        const url = new URL(input);
        if (url.hostname !== "apps.apple.com") throw new Error();
        id = url.pathname.match(/\/id(\d+)/)?.[1] ?? "";
      } catch {
        return reply
          .code(400)
          .send({ error: "请输入 App ID 或 apps.apple.com 链接" });
      }
    }
    id = idSchema.parse(id);
    try {
      await sync.metadata(id, market);
      store.run("UPDATE apps SET watch=1 WHERE id=?", id);
      return { id, market };
    } catch (err) {
      return reply
        .code(502)
        .send({ error: String(err instanceof Error ? err.message : err) });
    }
  });
  app.patch("/api/apps/:id", async (req, reply) => {
    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = z
      .object({
        watch: z.boolean().optional(),
        ignored: z.boolean().optional(),
        tags: z.string().max(500).optional(),
      })
      .parse(req.body);
    if (!store.one("SELECT id FROM apps WHERE id=?", id))
      return reply.code(404).send({ error: "产品不存在" });
    for (const key of ["watch", "ignored", "tags"] as const)
      if (body[key] !== undefined)
        store.run(
          `UPDATE apps SET ${key}=? WHERE id=?`,
          key === "tags" ? body[key] : Number(body[key]),
          id,
        );
    return { ok: true };
  });
  app.post("/api/apps/:id/notes", async (req, reply) => {
    const { id } = z.object({ id: idSchema }).parse(req.params);
    const n = noteSchema.parse(req.body);
    if (!store.one("SELECT id FROM apps WHERE id=?", id))
      return reply.code(404).send({ error: "产品不存在" });
    const at = store.now();
    const result = store.run(
      "INSERT INTO notes (app_id,audience,hypothesis,evidence,next_step,links,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
      id,
      n.audience,
      n.hypothesis,
      n.evidence,
      n.nextStep,
      n.links,
      at,
      at,
    );
    return { id: Number(result.lastInsertRowid) };
  });
  app.put("/api/notes/:id", async (req, reply) => {
    const { id } = z
      .object({ id: z.coerce.number().int().positive() })
      .parse(req.params);
    const n = noteSchema.parse(req.body);
    const result = store.run(
      "UPDATE notes SET audience=?,hypothesis=?,evidence=?,next_step=?,links=?,updated_at=? WHERE id=?",
      n.audience,
      n.hypothesis,
      n.evidence,
      n.nextStep,
      n.links,
      store.now(),
      id,
    );
    return result.changes
      ? { ok: true }
      : reply.code(404).send({ error: "笔记不存在" });
  });
  app.delete("/api/notes/:id", async (req) => {
    const { id } = z
      .object({ id: z.coerce.number().int().positive() })
      .parse(req.params);
    store.run("DELETE FROM notes WHERE id=?", id);
    return { ok: true };
  });
  app.get("/api/sources", async () =>
    store
      .all<Source>("SELECT * FROM sources ORDER BY category,market,kind")
      .map((s) => ({ ...s, url: feedUrl(s) })),
  );
  app.patch("/api/sources", async (req) => {
    const b = z
      .object({
        category: z.number().int().optional(),
        kind: kindSchema.optional(),
        enabled: z.boolean(),
      })
      .refine(
        (b) => b.category !== undefined || b.kind !== undefined,
        "请选择类别或榜单",
      )
      .parse(req.body);
    store.run(
      "UPDATE sources SET enabled=? WHERE (?=0 OR category=?) AND (?='' OR kind=?)",
      Number(b.enabled),
      b.category ?? 0,
      b.category ?? 0,
      b.kind ?? "",
      b.kind ?? "",
    );
    return { ok: true };
  });
  app.post("/api/sync", async (req, reply) => {
    const b = z
      .object({ sourceId: z.string().optional() })
      .parse(req.body ?? {});
    return reply.code(202).send({ run: sync.start(true, b.sourceId) });
  });
  app.get("/api/runs", async () =>
    store.all("SELECT * FROM runs ORDER BY started_at DESC LIMIT 10"),
  );
  app.get("/api/runs/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const run = store.one("SELECT * FROM runs WHERE id=?", id);
    return run
      ? {
          ...run,
          items: store.all("SELECT * FROM run_items WHERE run_id=?", id),
        }
      : reply.code(404).send({ error: "任务不存在" });
  });
  app.get("/api/snapshots/:id", async (req, reply) => {
    const { id } = z
      .object({ id: z.coerce.number().int().positive() })
      .parse(req.params);
    const row = store.one("SELECT raw FROM snapshots WHERE id=?", id);
    return row
      ? reply.type("application/json; charset=utf-8").send(gunzipSync(row.raw))
      : reply.code(404).send({ error: "快照不存在" });
  });
  registerGrowth(app, store, opts.autoSync);
  const client = opts.staticDir ?? resolve("dist/client");
  if (existsSync(client)) {
    await app.register(staticPlugin, { root: client });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.code(404).send({ error: "接口不存在" })
        : reply.sendFile("index.html"),
    );
  }
  app.addHook("onClose", async () => {
    sync.stop();
  });
  if (opts.autoSync)
    app.addHook("onListen", async () => {
      sync.start();
    });
  return app;
}
