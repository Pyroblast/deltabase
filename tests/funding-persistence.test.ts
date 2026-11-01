import { it, expect } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createStore } from "../server/store";
import { createApp } from "../server/app";
import { createFundingStore } from "../server/funding-store";
import { createGrowthStore } from "../server/growth-store";
import { fundingDraft } from "./funding-fixtures";
import { lead } from "./growth-fixtures";
import { randomUUID } from "node:crypto";
import { feed } from "./fixtures";
it("preserves notes, company/App links, revisions, failed observations and retry keys after reopening", async () => {
  const dir = mkdtempSync(join(tmpdir(), "deltabase-funding-persistence-"));
  let s = createStore(join(dir, "test.sqlite"));
  let app = await createApp(s);
  try {
    const g = createGrowthStore(s).save(lead(), "baseline");
    s.run(
      "UPDATE growth_companies SET notes='原有公司笔记',watch=1 WHERE id=?",
      g.companyId,
    );
    s.saveFeed(
      s.one("SELECT * FROM sources WHERE id='us:6007:free'")!,
      feed(["1"]),
    );
    const path = `/api/growth/companies/${g.companyId}/apps`;
    await app.inject({ method: "POST", url: path, payload: { appId: "1" } });
    const request = {
      idempotencyKey: randomUUID(),
      data: fundingDraft({
        company: { id: g.companyId },
        companyReason: "核对同一官网",
      }),
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/funding",
      payload: request,
    });
    expect(res.statusCode).toBe(201);
    const id = res.json().id;
    await app.inject({
      method: "POST",
      url: `/api/funding/${id}/observations`,
      payload: {
        idempotencyKey: randomUUID(),
        expectedVersion: 1,
        evidenceKey: "source-one",
        outcome: "unavailable",
        note: "原链接暂不可访问",
      },
    });
    await app.close();
    s.db.close();
    s = createStore(join(dir, "test.sqlite"));
    app = await createApp(s);
    const d = (await app.inject(`/api/funding/${id}`)).json();
    expect(d.event.company.notes).toBe("原有公司笔记");
    expect(d.event.company.watch).toBe(1);
    expect(d.appLinks[0].id).toBe("1");
    expect(d.revisions).toHaveLength(1);
    expect(d.observations[0].outcome).toBe("unavailable");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/funding",
          payload: request,
        })
      ).json().replayed,
    ).toBe(true);
    await app.inject({ method: "DELETE", url: path + "/1" });
    expect((await app.inject(`/api/funding/${id}`)).json().appLinks).toEqual(
      [],
    );
    expect(s.one("SELECT COUNT(*) n FROM ranks")!.n).toBe(1);
    expect(s.one("SELECT COUNT(*) n FROM funding_events")!.n).toBe(1);
    expect(s.db.pragma("foreign_key_check")).toEqual([]);
  } finally {
    await app.close();
    if (s.db.open) s.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
it("applies only the new migration to a pre-funding schema without modifying existing evidence or user records", () => {
  const dir = mkdtempSync(join(tmpdir(), "deltabase-funding-migration-"));
  const migrationDir = join(dir, "old-migrations");
  mkdirSync(join(migrationDir, "meta"), { recursive: true });
  const journal = JSON.parse(
    readFileSync(resolve("server/migrations/meta/_journal.json"), "utf8"),
  );
  journal.entries = journal.entries.filter((e: any) => e.idx < 2);
  writeFileSync(
    join(migrationDir, "meta/_journal.json"),
    JSON.stringify(journal),
  );
  for (const e of journal.entries)
    copyFileSync(
      resolve(`server/migrations/${e.tag}.sql`),
      join(migrationDir, `${e.tag}.sql`),
    );
  const path = join(dir, "old.sqlite");
  const old = new Database(path);
  try {
    migrate(drizzle(old), { migrationsFolder: migrationDir });
    old.exec(`INSERT INTO apps(id,first_seen,watch,tags) VALUES ('1','2026-01-01',1,'原有标签');
      INSERT INTO listings(app_id,market,name,developer,icon,url,category,currency) VALUES ('1','us','原产品','原开发者','','https://apps.apple.com/us/app/id1',6007,'USD');
      INSERT INTO notes(app_id,audience,hypothesis,evidence,next_step,links,created_at,updated_at) VALUES ('1','','原有机会假设','原有证据','','','2026-01-01','2026-01-01');
      INSERT INTO growth_companies(id,name,website,notes,first_seen) VALUES ('yc:42','测试旧公司','https://example.com','增长研究笔记','2026-01-01');
      INSERT INTO growth_app_links(company_id,app_id,confirmed_at) VALUES ('yc:42','1','2026-01-01');
      INSERT INTO sources(id,market,category,kind) VALUES ('us:6007:free','us',6007,'free');
      INSERT INTO snapshots(source_id,observed_at,fingerprint,count,raw) VALUES ('us:6007:free','2026-01-01','old-fingerprint',1,X'001122');
      INSERT INTO ranks(snapshot_id,app_id,rank) VALUES (1,'1',5);`);
    const payload = JSON.stringify(lead());
    old
      .prepare(
        "INSERT INTO growth_leads(id,source,company_id,url,payload,fingerprint,first_seen,last_seen,last_checked) VALUES ('yc:101','yc','yc:42','https://example.com/job',?,'old-hash','2026-01-01','2026-01-01','2026-01-01')",
      )
      .run(payload);
    old
      .prepare(
        "INSERT INTO growth_versions(lead_id,observed_at,event,payload,fingerprint) VALUES ('yc:101','2026-01-01','baseline',?,'old-hash')",
      )
      .run(payload);
    const tables = [
      "apps",
      "listings",
      "notes",
      "snapshots",
      "ranks",
      "growth_companies",
      "growth_app_links",
      "growth_leads",
      "growth_versions",
    ];
    const before = Object.fromEntries(
      tables.map((t) => [t, old.prepare(`SELECT * FROM ${t}`).all()]),
    );
    old.close();
    const s = createStore(path);
    try {
      for (const t of tables)
        expect(s.all(`SELECT * FROM ${t}`)).toEqual(before[t]);
      expect(s.all("SELECT * FROM funding_events")).toEqual([]);
      const result = createFundingStore(s).create({
        idempotencyKey: randomUUID(),
        data: fundingDraft({
          company: { id: "yc:42" },
          companyReason: "旧公司身份已确认",
        }),
      });
      expect(result.version).toBe(1);
      for (const t of tables)
        expect(s.all(`SELECT * FROM ${t}`)).toEqual(before[t]);
      expect(s.db.pragma("foreign_key_check")).toEqual([]);
    } finally {
      s.db.close();
    }
  } finally {
    if (old.open) old.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
