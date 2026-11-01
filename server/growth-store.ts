import { createHash, randomUUID } from "node:crypto";
import type { Store } from "./store.js";
import type { GrowthLead, GrowthRow } from "../shared/growth.js";
export function createGrowthStore(s: Store) {
  s.run("INSERT OR IGNORE INTO growth_source_state (id) VALUES ('yc')");
  function save(
    lead: GrowthLead,
    event: string,
    at = s.now(),
    existingCompanyId?: string,
  ) {
    return s.db.transaction(() => {
      const id = `${lead.source}:${lead.externalId}`;
      const previous = s.one("SELECT * FROM growth_leads WHERE id=?", id);
      const companyId =
        previous?.company_id ??
        existingCompanyId ??
        lead.company.id ??
        `manual:${randomUUID()}`;
      if (
        existingCompanyId &&
        !s.one("SELECT id FROM growth_companies WHERE id=?", existingCompanyId)
      )
        throw new Error("所选公司不存在");
      if (!previous && !existingCompanyId) {
        s.run(
          `INSERT INTO growth_companies (id,name,website,summary,batch,first_seen) VALUES (?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name,website=excluded.website,summary=excluded.summary,batch=excluded.batch`,
          companyId,
          lead.company.name,
          lead.company.website,
          lead.company.summary,
          lead.company.batch,
          at,
        );
      } else if (lead.source === "yc") {
        s.run(
          "UPDATE growth_companies SET name=?,website=?,summary=?,batch=? WHERE id=?",
          lead.company.name,
          lead.company.website,
          lead.company.summary,
          lead.company.batch,
          companyId,
        );
      }
      const payload = JSON.stringify(lead);
      // Relative publication labels naturally age; they are not content changes.
      const fingerprint = createHash("sha256")
        .update(JSON.stringify({ ...lead, publishedLabel: "" }))
        .digest("hex");
      s.run(
        `INSERT INTO growth_leads (id,source,company_id,url,payload,fingerprint,first_seen,last_seen,last_checked) VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET url=excluded.url,payload=excluded.payload,fingerprint=excluded.fingerprint,last_seen=excluded.last_seen,last_checked=excluded.last_checked,check_error=NULL`,
        id,
        lead.source,
        companyId,
        lead.url,
        payload,
        fingerprint,
        at,
        at,
        at,
      );
      if (!previous || previous.fingerprint !== fingerprint) {
        s.run(
          "INSERT INTO growth_versions (lead_id,observed_at,event,payload,fingerprint) VALUES (?,?,?,?,?)",
          id,
          at,
          previous ? "changed" : event,
          payload,
          fingerprint,
        );
      }
      const version = s.one(
        "SELECT id FROM growth_versions WHERE lead_id=? ORDER BY id DESC LIMIT 1",
        id,
      )!;
      return { id, companyId, versionId: version.id as number };
    })();
  }
  function rows(): GrowthRow[] {
    return s
      .all(
        `SELECT l.*,v.id AS version_id,v.event,v.observed_at AS event_at FROM growth_leads l
      JOIN growth_versions v ON v.id=(SELECT MAX(id) FROM growth_versions WHERE lead_id=l.id) ORDER BY v.observed_at DESC,l.id`,
      )
      .map((r) => ({
        ...JSON.parse(r.payload),
        id: r.id,
        companyId: r.company_id,
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
        lastChecked: r.last_checked,
        checkError: r.check_error,
        versionId: r.version_id,
        event: r.event,
        eventAt: r.event_at,
        inLatestList: r.in_latest_list,
      }));
  }
  function companies() {
    return s.all("SELECT * FROM growth_companies ORDER BY name COLLATE NOCASE");
  }
  function detail(id: string) {
    const company = s.one("SELECT * FROM growth_companies WHERE id=?", id);
    if (!company) return null;
    return {
      company,
      leads: rows().filter((l) => l.companyId === id),
      versions: s
        .all(
          `SELECT v.id,v.lead_id,v.event,v.observed_at,v.payload FROM growth_versions v JOIN growth_leads l ON l.id=v.lead_id WHERE l.company_id=? ORDER BY v.id DESC LIMIT 100`,
          id,
        )
        .map((v) => ({ ...v, payload: JSON.parse(v.payload) })),
      links: s.all(
        `SELECT g.app_id AS id,l.name,l.market,l.icon,g.confirmed_at FROM growth_app_links g JOIN listings l ON l.app_id=g.app_id WHERE g.company_id=? ORDER BY l.name,l.market`,
        id,
      ),
    };
  }
  return { save, rows, companies, detail };
}
