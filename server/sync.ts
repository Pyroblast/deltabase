import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { feedUrl, getJson, lookup, type Source } from "./apple.js";
import type { Store } from "./store.js";
import type { Market } from "../shared/catalog.js";
export function createSync(store: Store) {
  let active: string | null = null;
  let stopped = false;
  let nextRequest = 0;
  const metaJobs = new Map<string, Promise<unknown>>();
  store.run(
    "UPDATE runs SET status='interrupted',finished_at=?,error='程序重启，上次采集已中断' WHERE status='running'",
    store.now(),
  );
  store.run(
    "UPDATE run_items SET status='interrupted',error='程序重启' WHERE status IN ('pending','running')",
  );
  function metadata(id: string, market: Market, force = false) {
    const key = `${market}:${id}`;
    if (metaJobs.has(key)) return metaJobs.get(key)!;
    const row = store.one(
      "SELECT metadata_at FROM listings WHERE app_id=? AND market=?",
      id,
      market,
    );
    if (
      !force &&
      row?.metadata_at &&
      Date.now() - Date.parse(row.metadata_at) < 86_400_000
    )
      return Promise.resolve();
    const job = lookup(id, market)
      .then((result) => store.saveMetadata(id, market, result))
      .finally(() => metaJobs.delete(key));
    metaJobs.set(key, job);
    return job;
  }
  async function execute(runId: string, sources: Source[]) {
    const queue = [...sources];
    async function worker() {
      while (queue.length && !stopped) {
        const source = queue.shift()!;
        const startAt = Math.max(Date.now(), nextRequest);
        nextRequest = startAt + 1000;
        await delay(Math.max(0, startAt - Date.now()));
        store.run(
          "UPDATE run_items SET status='running' WHERE run_id=? AND source_id=?",
          runId,
          source.id,
        );
        try {
          const status = store.saveFeed(source, await getJson(feedUrl(source)));
          store.run(
            "UPDATE run_items SET status=? WHERE run_id=? AND source_id=?",
            status,
            runId,
            source.id,
          );
          store.run(
            `UPDATE runs SET done=done+1,${status === "empty" ? "empty" : "success"}=${status === "empty" ? "empty" : "success"}+1 WHERE id=?`,
            runId,
          );
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          store.run(
            "UPDATE sources SET status='failed',last_checked=?,error=? WHERE id=?",
            store.now(),
            error,
            source.id,
          );
          store.run(
            "UPDATE run_items SET status='failed',error=? WHERE run_id=? AND source_id=?",
            error,
            runId,
            source.id,
          );
          store.run(
            "UPDATE runs SET done=done+1,failed=failed+1 WHERE id=?",
            runId,
          );
        }
      }
    }
    try {
      await Promise.all([worker(), worker()]);
      // Only enrich watched products. A missing lookup never removes valid feed data.
      const watched = store.all<{ app_id: string; market: Market }>(
        "SELECT l.app_id,l.market FROM listings l JOIN apps a ON a.id=l.app_id WHERE a.watch=1",
      );
      let lookupFailures = 0;
      for (const app of watched) {
        if (stopped) break;
        try {
          await metadata(app.app_id, app.market);
        } catch {
          lookupFailures++;
        }
      }
      const row = store.one("SELECT failed FROM runs WHERE id=?", runId);
      store.run(
        "UPDATE runs SET status=?,finished_at=?,error=? WHERE id=?",
        stopped
          ? "interrupted"
          : row.failed || lookupFailures
            ? "partial"
            : "completed",
        store.now(),
        lookupFailures
          ? `${lookupFailures} 个关注产品详情更新失败，已有资料保留`
          : null,
        runId,
      );
    } catch (err) {
      store.run(
        "UPDATE runs SET status='failed',finished_at=?,error=? WHERE id=?",
        store.now(),
        String(err),
        runId,
      );
    } finally {
      active = null;
    }
  }
  function start(force = false, sourceId?: string) {
    if (active) return store.one("SELECT * FROM runs WHERE id=?", active);
    const cutoff = Date.now() - 86_400_000;
    const sources = store
      .all<Source>(
        "SELECT * FROM sources WHERE enabled=1 ORDER BY CASE category WHEN 6007 THEN 0 WHEN 6017 THEN 1 WHEN 6002 THEN 2 ELSE 3 END,category,market,kind",
      )
      .filter(
        (s) =>
          (!sourceId || s.id === sourceId) &&
          (force ||
            !s.last_checked ||
            Date.parse(s.last_checked) < cutoff ||
            s.status === "failed"),
      );
    if (!sources.length) return null;
    active = randomUUID();
    store.run(
      "INSERT INTO runs (id,status,started_at,total) VALUES (?,'running',?,?)",
      active,
      store.now(),
      sources.length,
    );
    for (const source of sources)
      store.run(
        "INSERT INTO run_items (run_id,source_id,status) VALUES (?,?,'pending')",
        active,
        source.id,
      );
    const runId = active;
    void execute(runId, sources);
    return store.one("SELECT * FROM runs WHERE id=?", runId);
  }
  return {
    start,
    metadata,
    stop: () => {
      stopped = true;
    },
  };
}
