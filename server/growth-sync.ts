import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { Store } from "./store.js";
import { createGrowthStore } from "./growth-store.js";
import { YC_LIST_URL, fetchYC, parseYCDetail, parseYCList } from "./yc.js";
export function createGrowthSync(
  s: Store,
  options: { fetch?: typeof fetchYC; interval?: number } = {},
) {
  const growth = createGrowthStore(s);
  const read = options.fetch ?? fetchYC;
  const interval = options.interval ?? 1200;
  let active: string | null = null;
  let task: Promise<void> | undefined;
  let controller = new AbortController();
  s.run(
    "UPDATE growth_runs SET status='interrupted',finished_at=?,error='程序重启，上次采集中断' WHERE status='running'",
    s.now(),
  );
  s.run(
    "UPDATE growth_source_state SET status='interrupted',error='程序重启，上次采集中断' WHERE status='running'",
  );
  async function execute(id: string) {
    try {
      const list = parseYCList(await read(YC_LIST_URL, controller.signal));
      const state = s.one(
        "SELECT baseline_ids FROM growth_source_state WHERE id='yc'",
      )!;
      const baseline: string[] = state.baseline_ids
        ? JSON.parse(state.baseline_ids)
        : list.map((l) => l.id);
      s.db.transaction(() => {
        if (!state.baseline_ids)
          s.run(
            "UPDATE growth_source_state SET baseline_ids=? WHERE id='yc'",
            JSON.stringify(baseline),
          );
        s.run("UPDATE growth_leads SET in_latest_list=0 WHERE source='yc'");
        for (const row of list)
          s.run(
            "UPDATE growth_leads SET in_latest_list=1 WHERE id=?",
            `yc:${row.id}`,
          );
      })();
      // Revisit previously known detail pages even when absent from the public sample.
      const missing = s
        .all(
          "SELECT id,url FROM growth_leads WHERE source='yc' AND in_latest_list=0 ORDER BY last_checked LIMIT 50",
        )
        .map((l) => ({ id: l.id.slice(3) as string, url: l.url as string }));
      const queue = [...list, ...missing];
      const listed = new Set(list.map((l) => l.id));
      s.run("UPDATE growth_runs SET total=? WHERE id=?", queue.length, id);
      for (const item of queue) {
        await delay(interval, undefined, { signal: controller.signal });
        const at = s.now();
        try {
          const lead = parseYCDetail(
            await read(item.url, controller.signal),
            item,
          );
          const saved = growth.save(
            lead,
            baseline.includes(item.id) ? "baseline" : "discovered",
            at,
          );
          s.run(
            "UPDATE growth_leads SET in_latest_list=? WHERE id=?",
            Number(listed.has(item.id)),
            saved.id,
          );
          s.run(
            "INSERT INTO growth_observations (run_id,url,observed_at,version_id) VALUES (?,?,?,?)",
            id,
            item.url,
            at,
            saved.versionId,
          );
          s.run(
            "UPDATE growth_runs SET done=done+1,success=success+1 WHERE id=?",
            id,
          );
        } catch (err) {
          if (controller.signal.aborted) throw err;
          const error = err instanceof Error ? err.message : String(err);
          s.run(
            "UPDATE growth_leads SET last_checked=?,check_error=? WHERE id=?",
            at,
            error,
            `yc:${item.id}`,
          );
          s.run(
            "INSERT INTO growth_observations (run_id,url,observed_at,error) VALUES (?,?,?,?)",
            id,
            item.url,
            at,
            error,
          );
          s.run(
            "UPDATE growth_runs SET done=done+1,failed=failed+1 WHERE id=?",
            id,
          );
          // A platform block should stop the run rather than hit every remaining URL.
          if (/HTTP (401|403|429)/.test(error)) throw new Error(error);
        }
      }
      const run = s.one("SELECT * FROM growth_runs WHERE id=?", id)!;
      const status = run.failed
        ? run.success
          ? "partial"
          : "failed"
        : "completed";
      const error = run.failed
        ? `${run.failed} 条详情更新失败，已有资料保留`
        : null;
      s.run(
        "UPDATE growth_runs SET status=?,finished_at=?,error=? WHERE id=?",
        status,
        s.now(),
        error,
        id,
      );
      s.run(
        "UPDATE growth_source_state SET status=?,last_success=CASE WHEN ? THEN ? ELSE last_success END,error=? WHERE id='yc'",
        status,
        Number(status === "completed"),
        s.now(),
        error,
      );
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const status = controller.signal.aborted ? "interrupted" : "failed";
      s.run(
        "UPDATE growth_runs SET status=?,finished_at=?,error=? WHERE id=?",
        status,
        s.now(),
        error,
        id,
      );
      s.run(
        "UPDATE growth_source_state SET status=?,error=? WHERE id='yc'",
        status,
        error,
      );
    } finally {
      active = null;
    }
  }
  function start(force = false) {
    if (active) return s.one("SELECT * FROM growth_runs WHERE id=?", active);
    const state = s.one("SELECT * FROM growth_source_state WHERE id='yc'")!;
    if (
      !force &&
      state.status === "completed" &&
      state.last_checked &&
      Date.now() - Date.parse(state.last_checked) < 86400000
    )
      return null;
    controller = new AbortController();
    active = randomUUID();
    s.run(
      "INSERT INTO growth_runs (id,status,started_at) VALUES (?,'running',?)",
      active,
      s.now(),
    );
    s.run(
      "UPDATE growth_source_state SET status='running',last_checked=?,error=NULL WHERE id='yc'",
      s.now(),
    );
    const id = active;
    task = execute(id);
    return s.one("SELECT * FROM growth_runs WHERE id=?", id);
  }
  return {
    start,
    idle: () => task,
    stop: async () => {
      controller.abort();
      await task;
    },
  };
}
