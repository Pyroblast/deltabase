import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { categories, type Entry, type Market } from "../shared/catalog.js";
import { parseFeed, type Source } from "./apple.js";

export function createStore(
  path = resolve(process.env.DATA_DIR ?? "data", "deltabase.sqlite"),
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  const orm = drizzle(db);
  migrate(orm, { migrationsFolder: resolve("server/migrations") });
  const seed = db.prepare(
    "INSERT OR IGNORE INTO sources (id, market, category, kind) VALUES (?, ?, ?, ?)",
  );
  db.transaction(() => {
    for (const [category] of categories)
      for (const market of ["us", "cn"])
        for (const kind of ["free", "paid", "grossing"])
          seed.run(`${market}:${category}:${kind}`, market, category, kind);
  })();
  const all = <T = any>(sql: string, ...args: any[]): T[] =>
    db.prepare(sql).all(...args) as T[];
  const one = <T = any>(sql: string, ...args: any[]): T | undefined =>
    db.prepare(sql).get(...args) as T | undefined;
  const run = (sql: string, ...args: any[]) => db.prepare(sql).run(...args);
  const now = () => new Date().toISOString();
  function upsert(entry: Entry, market: Market, at: string) {
    run(
      "INSERT OR IGNORE INTO apps (id, first_seen) VALUES (?,?)",
      entry.id,
      at,
    );
    run(
      `INSERT INTO listings (app_id,market,name,developer,icon,url,category,price,currency,release_date) VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(app_id,market) DO UPDATE SET name=excluded.name,developer=excluded.developer,icon=excluded.icon,url=excluded.url,category=excluded.category,price=excluded.price,currency=excluded.currency,release_date=excluded.release_date`,
      entry.id,
      market,
      entry.name,
      entry.developer,
      entry.icon,
      entry.url,
      entry.category,
      entry.price,
      entry.currency,
      entry.releaseDate,
    );
  }
  function saveFeed(source: Source, raw: unknown, at = now()) {
    const parsed = parseFeed(raw, source);
    if (!parsed.entries.length) {
      run(
        "UPDATE sources SET status='empty', last_checked=?, error=NULL WHERE id=?",
        at,
        source.id,
      );
      return "empty" as const;
    }
    // Preserve daily observations when no source timestamp exists; repeated identical observations on the same day are idempotent.
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          parsed.sourceUpdatedAt ?? at.slice(0, 10),
          parsed.entries,
        ]),
      )
      .digest("hex");
    return db.transaction(() => {
      const previous = one(
        "SELECT * FROM snapshots WHERE source_id=? ORDER BY id DESC LIMIT 1",
        source.id,
      );
      if (
        previous?.source_updated_at &&
        parsed.sourceUpdatedAt &&
        parsed.sourceUpdatedAt < previous.source_updated_at
      )
        throw new Error("来源返回了早于已有快照的数据，本次未覆盖");
      if (
        one(
          "SELECT id FROM snapshots WHERE source_id=? AND fingerprint=?",
          source.id,
          fingerprint,
        )
      ) {
        run(
          "UPDATE sources SET status='success',last_checked=?,last_success=?,error=NULL WHERE id=?",
          at,
          at,
          source.id,
        );
        return "success" as const;
      }
      for (const entry of parsed.entries) upsert(entry, source.market, at);
      const snapshotId = Number(
        run(
          "INSERT INTO snapshots (source_id,observed_at,source_updated_at,fingerprint,count,raw) VALUES (?,?,?,?,?,?)",
          source.id,
          at,
          parsed.sourceUpdatedAt,
          fingerprint,
          parsed.entries.length,
          gzipSync(JSON.stringify(raw)),
        ).lastInsertRowid,
      );
      const prior = new Map<string, number>(
        previous
          ? all<{ app_id: string; rank: number }>(
              "SELECT app_id,rank FROM ranks WHERE snapshot_id=?",
              previous.id,
            ).map((r) => [r.app_id, r.rank])
          : [],
      );
      for (const entry of parsed.entries) {
        run(
          "INSERT INTO ranks (snapshot_id,app_id,rank) VALUES (?,?,?)",
          snapshotId,
          entry.id,
          entry.rank,
        );
        if (!previous) continue;
        const old = prior.get(entry.id);
        const type =
          old == null ? "entered" : old - entry.rank >= 10 ? "rising" : null;
        if (type)
          run(
            "INSERT INTO events (app_id,source_id,snapshot_id,market,type,observed_at,details) VALUES (?,?,?,?,?,?,?)",
            entry.id,
            source.id,
            snapshotId,
            source.market,
            type,
            at,
            JSON.stringify({
              rank: entry.rank,
              previousRank: old ?? null,
              previousAt: previous.observed_at,
              sourceUpdatedAt: parsed.sourceUpdatedAt,
            }),
          );
      }
      run(
        "UPDATE sources SET status='success',last_checked=?,last_success=?,error=NULL,count=? WHERE id=?",
        at,
        at,
        parsed.entries.length,
        source.id,
      );
      return "success" as const;
    })();
  }
  function saveMetadata(id: string, market: Market, result: any, at = now()) {
    const previous = one(
      "SELECT metadata FROM listings WHERE app_id=? AND market=?",
      id,
      market,
    );
    const old = previous?.metadata ? JSON.parse(previous.metadata) : null;
    db.transaction(() => {
      upsert(
        {
          id,
          name: result.trackName ?? id,
          developer: result.artistName ?? "",
          icon: result.artworkUrl100 ?? "",
          url: `https://apps.apple.com/${market}/app/id${id}`,
          category: result.primaryGenreId ?? 0,
          price: result.price ?? null,
          currency: result.currency ?? "",
          releaseDate: result.releaseDate ?? null,
          rank: 0,
        },
        market,
        at,
      );
      run(
        "UPDATE listings SET metadata=?,metadata_at=? WHERE app_id=? AND market=?",
        JSON.stringify(result),
        at,
        id,
        market,
      );
      if (
        old?.version &&
        old.version !== result.version &&
        one("SELECT watch FROM apps WHERE id=?", id)?.watch
      )
        run(
          "INSERT INTO events (app_id,market,type,observed_at,details) VALUES (?,?,?,?,?)",
          id,
          market,
          "version",
          at,
          JSON.stringify({
            from: old.version,
            to: result.version,
            releasedAt: result.currentVersionReleaseDate,
          }),
        );
    })();
  }
  const latest = `WITH latest AS (SELECT source_id, MAX(id) AS sid FROM snapshots GROUP BY source_id), current AS (SELECT r.*,s.market,s.category,s.kind,p.observed_at,p.source_updated_at,s.id AS source_id FROM latest l JOIN snapshots p ON p.id=l.sid JOIN sources s ON s.id=l.source_id JOIN ranks r ON r.snapshot_id=l.sid WHERE s.enabled=1)`;
  function ranked(filters: {
    market: string;
    kind: string;
    category?: number;
    q?: string;
    watch?: boolean;
    ignored?: boolean;
    focus?: boolean;
    page?: number;
  }) {
    const where = `c.market=? AND ((?='cross' AND l.price=0 AND (c.kind='grossing' OR (c.kind='free' AND NOT EXISTS (SELECT 1 FROM current g WHERE g.app_id=c.app_id AND g.market=c.market AND g.category=c.category AND g.kind='grossing')))) OR c.kind=?) AND (?=0 OR c.category=?) AND (l.name LIKE ? OR l.developer LIKE ?) AND (?=0 OR a.watch=1) AND (?=1 OR a.ignored=0) AND (?=0 OR (EXISTS (SELECT 1 FROM current g WHERE g.app_id=a.id AND g.market=c.market AND g.category=c.category AND g.kind='grossing' AND g.rank<=20) AND NOT EXISTS (SELECT 1 FROM current f WHERE f.app_id=a.id AND f.market=c.market AND f.category=c.category AND f.kind='free' AND f.rank<=50)))`;
    const params = [
      filters.market,
      filters.kind,
      filters.kind,
      filters.category ?? 0,
      filters.category ?? 0,
      `%${filters.q ?? ""}%`,
      `%${filters.q ?? ""}%`,
      Number(!!filters.watch),
      Number(!!filters.ignored),
      Number(!!filters.focus),
    ];
    const total =
      one(
        `${latest} SELECT COUNT(*) AS n FROM current c JOIN apps a ON a.id=c.app_id JOIN listings l ON l.app_id=a.id AND l.market=c.market WHERE ${where}`,
        ...params,
      )?.n ?? 0;
    const items = all(
      `${latest} SELECT a.id,a.watch,a.ignored,a.tags,l.name,l.developer,l.icon,l.url,l.price,l.currency,c.category,c.market,c.kind,c.rank,c.observed_at AS observedAt,c.source_updated_at AS sourceUpdatedAt,
      (SELECT rank FROM ranks WHERE app_id=a.id AND snapshot_id=(SELECT id FROM snapshots WHERE source_id=c.source_id AND id<c.snapshot_id ORDER BY id DESC LIMIT 1)) AS previousRank,
      (SELECT observed_at FROM snapshots WHERE source_id=c.source_id AND id<c.snapshot_id ORDER BY id DESC LIMIT 1) AS previousAt,
      c.snapshot_id AS snapshotId,
      (SELECT rank FROM current x WHERE x.app_id=a.id AND x.market=c.market AND x.category=c.category AND x.kind='free') AS freeRank,
      (SELECT observed_at FROM current x WHERE x.app_id=a.id AND x.market=c.market AND x.category=c.category AND x.kind='free') AS freeAt,
      (SELECT rank FROM current x WHERE x.app_id=a.id AND x.market=c.market AND x.category=c.category AND x.kind='grossing') AS grossingRank,
      (SELECT observed_at FROM current x WHERE x.app_id=a.id AND x.market=c.market AND x.category=c.category AND x.kind='grossing') AS counterpartAt
      FROM current c JOIN apps a ON a.id=c.app_id JOIN listings l ON l.app_id=a.id AND l.market=c.market WHERE ${where} ORDER BY c.rank,l.name LIMIT 50 OFFSET ?`,
      ...params,
      ((filters.page ?? 1) - 1) * 50,
    );
    return { items, total };
  }
  function watchlist(market: Market, q = "") {
    return all(
      `SELECT a.id,a.watch,a.ignored,a.tags,l.*,l.app_id AS id FROM apps a JOIN listings l ON l.app_id=a.id WHERE a.watch=1 AND l.market=? AND (l.name LIKE ? OR l.developer LIKE ?) ORDER BY a.first_seen DESC`,
      market,
      `%${q}%`,
      `%${q}%`,
    );
  }
  function signals(filters: {
    market: string;
    kind?: string;
    category?: number;
    day?: string;
    appId?: string;
  }) {
    return all(
      `SELECT e.*,l.name,l.icon,s.kind,s.category FROM events e JOIN listings l ON l.app_id=e.app_id AND l.market=e.market JOIN apps a ON a.id=e.app_id LEFT JOIN sources s ON s.id=e.source_id WHERE e.market=? AND (?='' OR s.kind=?) AND (?=0 OR s.category=?) AND (?='' OR date(e.observed_at,'+8 hours')=?) AND (?='' OR e.app_id=?) AND (a.ignored=0 OR ?<>'') ORDER BY e.id DESC LIMIT 200`,
      filters.market,
      filters.kind ?? "",
      filters.kind ?? "",
      filters.category ?? 0,
      filters.category ?? 0,
      filters.day ?? "",
      filters.day ?? "",
      filters.appId ?? "",
      filters.appId ?? "",
      filters.appId ?? "",
    ).map((e) => ({ ...e, details: JSON.parse(e.details) }));
  }
  function detail(id: string, market: Market) {
    const app = one(
      "SELECT a.*,l.* FROM apps a JOIN listings l ON l.app_id=a.id WHERE a.id=? AND l.market=?",
      id,
      market,
    );
    if (!app) return undefined;
    return {
      ...app,
      metadata: app.metadata ? JSON.parse(app.metadata) : null,
      markets: all("SELECT market FROM listings WHERE app_id=?", id).map(
        (r) => r.market,
      ),
      history: all(
        "SELECT r.rank,s.kind,s.category,p.observed_at AS observedAt,p.source_updated_at AS sourceUpdatedAt,p.id AS snapshotId,s.id AS sourceId FROM ranks r JOIN snapshots p ON p.id=r.snapshot_id JOIN sources s ON s.id=p.source_id WHERE r.app_id=? AND s.market=? ORDER BY p.observed_at",
        id,
        market,
      ),
      events: signals({ market, appId: id }),
      notes: all("SELECT * FROM notes WHERE app_id=? ORDER BY id DESC", id),
      latest: all(
        `${latest} SELECT c.* FROM current c WHERE c.app_id=? AND c.market=?`,
        id,
        market,
      ),
    };
  }
  return {
    db,
    orm,
    all,
    one,
    run,
    saveFeed,
    saveMetadata,
    ranked,
    watchlist,
    signals,
    detail,
    now,
  };
}
export type Store = ReturnType<typeof createStore>;
