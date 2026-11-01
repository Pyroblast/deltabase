import { createHash, randomUUID } from "node:crypto";
import type { Store } from "./store.js";
import type {
  FundingArchiveRequest,
  FundingCompany,
  FundingCreateRequest,
  FundingDetail,
  FundingDraft,
  FundingDuplicate,
  FundingEvent,
  FundingEvidenceRequest,
  FundingMutationResult,
  FundingObservationRequest,
  FundingUpdateRequest,
} from "../shared/funding.js";
import {
  canonicalFundingUrl,
  dateInterval,
  FundingError,
  fundingDraftSchema,
  listFundingSchema,
} from "./funding-validation.js";
import type { z } from "zod";
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
    .join(",")}}`;
}
const hash = (v: unknown) =>
  createHash("sha256").update(stable(v)).digest("hex");
const normalizeName = (v: string) =>
  v.trim().toLowerCase().replace(/\s+/g, " ");
function fingerprint(
  data: FundingDraft,
  archived: boolean,
  duplicateOf: string | null,
  archiveReason: string,
) {
  const normalized = {
    ...data,
    investors: data.investors
      .map((i) => ({ ...i, evidenceKeys: [...new Set(i.evidenceKeys)].sort() }))
      .sort((a, b) => stable(a).localeCompare(stable(b))),
    evidence: data.evidence
      .map((e) => ({
        ...e,
        url: canonicalFundingUrl(e.url),
        supports: [...new Set(e.supports)].sort(),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
  return hash({ data: normalized, archived, duplicateOf, archiveReason });
}
export function createFundingStore(s: Store) {
  function company(id: string): FundingCompany {
    const c = s.one(
      "SELECT id,name,website,summary,notes,watch,ignored FROM growth_companies WHERE id=?",
      id,
    );
    if (!c) throw new FundingError(404, "NOT_FOUND", "公司不存在");
    return c;
  }
  function companies(q = ""): FundingCompany[] {
    return s.all(
      "SELECT id,name,website,summary,notes,watch,ignored FROM growth_companies WHERE name LIKE ? OR website LIKE ? ORDER BY name COLLATE NOCASE",
      `%${q}%`,
      `%${q}%`,
    );
  }
  function event(id: string): FundingEvent {
    const r = s.one("SELECT * FROM funding_events WHERE id=?", id);
    if (!r) throw new FundingError(404, "NOT_FOUND", "融资记录不存在");
    return {
      id: r.id,
      version: r.version,
      companyId: r.company_id,
      company: company(r.company_id),
      data: JSON.parse(r.payload),
      firstSeenAt: r.first_seen_at,
      updatedAt: r.updated_at,
      archived: !!r.archived,
      duplicateOf: r.duplicate_of,
      archiveReason: r.archive_reason,
    };
  }
  function detail(id: string): FundingDetail {
    return {
      event: event(id),
      revisions: s
        .all(
          "SELECT id,version,created_at AS createdAt,reason,snapshot FROM funding_revisions WHERE event_id=? ORDER BY version DESC",
          id,
        )
        .map((r) => ({ ...r, snapshot: JSON.parse(r.snapshot) })),
      observations: s
        .all(
          "SELECT id,event_id AS eventId,evidence_key AS evidenceKey,document_id AS documentId,observed_at AS observedAt,outcome,note,version,evidence FROM funding_observations WHERE event_id=? ORDER BY observed_at DESC,id",
          id,
        )
        .map((r) => ({ ...r, evidence: JSON.parse(r.evidence) })),
      documents: s.all(
        "SELECT e.evidence_key AS key,d.id AS documentId,d.canonical_url AS canonicalUrl,d.original_url AS originalUrl FROM funding_event_evidence e JOIN funding_documents d ON d.id=e.document_id WHERE e.event_id=? ORDER BY e.evidence_key",
        id,
      ),
      appLinks: s.all(
        "SELECT l.app_id AS id,l.name,l.market FROM growth_app_links g JOIN listings l ON l.app_id=g.app_id WHERE g.company_id=(SELECT company_id FROM funding_events WHERE id=?) ORDER BY l.name,l.market",
        id,
      ),
    };
  }
  function list(q: z.infer<typeof listFundingSchema>) {
    const rows = s
      .all("SELECT id FROM funding_events ORDER BY first_seen_at DESC,id DESC")
      .map((r) => event(r.id))
      .filter((e) => {
        if (q.archived !== "all" && e.archived !== (q.archived === "1"))
          return false;
        if (q.companyId && e.companyId !== q.companyId) return false;
        if (q.recordKind !== "all" && e.data.recordKind !== q.recordKind)
          return false;
        if (
          q.q &&
          ![
            e.data.title,
            e.company.name,
            e.data.roundRaw,
            e.data.notes,
            ...e.data.investors.map((i) => i.name),
          ]
            .join(" ")
            .toLowerCase()
            .includes(q.q.toLowerCase())
        )
          return false;
        let interval: [string, string] | null;
        if (q.dateType === "published")
          interval = dateInterval(e.data.published);
        else {
          const day = new Date(Date.parse(e.firstSeenAt) + 8 * 3600000)
            .toISOString()
            .slice(0, 10);
          interval = [day, day];
        }
        if (q.dateType === "published" && q.unknownDate === "1")
          return interval === null;
        if (!q.from && !q.to) return true;
        return (
          interval !== null &&
          (!q.from || interval[1] >= q.from) &&
          (!q.to || interval[0] <= q.to)
        );
      });
    if (q.dateType === "published")
      rows.sort((a, b) => {
        const av = dateInterval(a.data.published)?.[0],
          bv = dateInterval(b.data.published)?.[0];
        if (!av) return bv ? 1 : 0;
        if (!bv) return -1;
        return (
          bv.localeCompare(av) || b.firstSeenAt.localeCompare(a.firstSeenAt)
        );
      });
    return {
      items: rows.slice((q.page - 1) * 30, q.page * 30),
      total: rows.length,
      page: q.page,
      pageSize: 30,
    };
  }
  function duplicates(
    data: FundingDraft,
    excludeId?: string,
  ): FundingDuplicate[] {
    const selected = "id" in data.company ? company(data.company.id) : null;
    const name =
      selected?.name ?? ("name" in data.company ? data.company.name : "");
    const website =
      selected?.website ??
      ("website" in data.company ? data.company.website : "");
    const host = (u: string) => {
      try {
        return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
      } catch {
        return "";
      }
    };
    const urls = new Set(data.evidence.map((e) => canonicalFundingUrl(e.url)));
    const round = normalizeName(data.roundNormalized || data.roundRaw);
    const d = dateInterval(data.published);
    return s
      .all(
        "SELECT id FROM funding_events WHERE archived=0 AND id<>?",
        excludeId ?? "",
      )
      .flatMap((r) => {
        const e = event(r.id);
        const sameCompany = selected?.id === e.companyId;
        const identityCandidate =
          normalizeName(name) === normalizeName(e.company.name) ||
          (host(website) !== "" && host(website) === host(e.company.website));
        const sharedUrl = e.data.evidence.some((x) =>
          urls.has(canonicalFundingUrl(x.url)),
        );
        const sameRound =
          round !== "" &&
          round === normalizeName(e.data.roundNormalized || e.data.roundRaw);
        const other = dateInterval(e.data.published);
        const nearby =
          !d ||
          !other ||
          (Date.parse(d[0]) - Date.parse(other[1]) <= 90 * 86400000 &&
            Date.parse(other[0]) - Date.parse(d[1]) <= 90 * 86400000);
        if (
          !sharedUrl &&
          !((sameCompany || identityCandidate) && sameRound && nearby)
        )
          return [];
        const reasons: string[] = [];
        if (sharedUrl)
          reasons.push("已有记录引用相同文档；一篇文档也可能涉及多轮，请核对");
        if (sameCompany && sameRound) reasons.push("已确认同公司且轮次相同");
        else if (identityCandidate)
          reasons.push("公司名称或官网相近，身份尚需人工核对");
        if (!d || !other) reasons.push("公告日期缺失，不能据此排除重复");
        return [
          {
            id: e.id,
            title: e.data.title,
            companyName: e.company.name,
            roundRaw: e.data.roundRaw,
            published: e.data.published,
            reasons,
          },
        ];
      })
      .slice(0, 30);
  }
  function checkDuplicates(
    data: FundingDraft,
    excludeId: string | undefined,
    reason?: string,
    previous?: FundingDraft,
  ) {
    const alreadyReviewed = new Set(
      previous ? duplicates(previous, excludeId).map((c) => c.id) : [],
    );
    const candidates = duplicates(data, excludeId).filter(
      (c) => !alreadyReviewed.has(c.id),
    );
    if (candidates.length && !reason?.trim())
      throw new FundingError(
        409,
        "DUPLICATE_CANDIDATES",
        "发现可能属于同轮的记录，请追加证据或说明另建理由",
        { candidates },
      );
  }
  function checkVersion(e: FundingEvent, expected: number, editable = true) {
    if (e.version !== expected)
      throw new FundingError(
        409,
        "VERSION_CONFLICT",
        "记录已被更新，请重新读取后合并草稿",
        { currentVersion: e.version },
      );
    if (editable && e.archived)
      throw new FundingError(409, "ARCHIVED", "记录已归档，请恢复后再编辑", {
        currentVersion: e.version,
      });
  }
  function mutate<T extends Record<string, unknown>>(
    key: string,
    operation: string,
    request: unknown,
    work: () => T,
  ): T & { replayed: boolean } {
    return s.db
      .transaction(() => {
        const requestHash = hash({ operation, request });
        const old = s.one("SELECT * FROM funding_idempotency WHERE key=?", key);
        if (old) {
          if (old.request_hash !== requestHash)
            throw new FundingError(
              409,
              "IDEMPOTENCY_CONFLICT",
              "此幂等键已用于不同请求，请使用新的键",
            );
          return { ...JSON.parse(old.response), replayed: true };
        }
        const result = work();
        s.run(
          "INSERT INTO funding_idempotency (key,request_hash,response,created_at) VALUES (?,?,?,?)",
          key,
          requestHash,
          JSON.stringify(result),
          s.now(),
        );
        return { ...result, replayed: false };
      })
      .immediate();
  }
  function resolveCompany(data: FundingDraft) {
    if ("id" in data.company) return company(data.company.id);
    const id = `company:${randomUUID()}`;
    s.run(
      "INSERT INTO growth_companies (id,name,website,first_seen) VALUES (?,?,?,?)",
      id,
      data.company.name,
      data.company.website,
      s.now(),
    );
    return company(id);
  }
  function validateRelation(data: FundingDraft, id: string, companyId: string) {
    if (!data.relatedEventId) return;
    if (data.relatedEventId === id)
      throw new FundingError(400, "VALIDATION_ERROR", "不能关联自身轮次");
    const related = event(data.relatedEventId);
    if (related.companyId !== companyId)
      throw new FundingError(
        400,
        "VALIDATION_ERROR",
        "相关轮次须属于同一已确认公司",
      );
  }
  function linkDocuments(id: string, data: FundingDraft, at: string) {
    s.run("DELETE FROM funding_event_evidence WHERE event_id=?", id);
    for (const e of data.evidence) {
      const canonical = canonicalFundingUrl(e.url);
      let document = s.one(
        "SELECT id FROM funding_documents WHERE canonical_url=?",
        canonical,
      );
      if (!document) {
        const documentId = `document:${randomUUID()}`;
        s.run(
          "INSERT INTO funding_documents (id,canonical_url,original_url,first_seen_at) VALUES (?,?,?,?)",
          documentId,
          canonical,
          e.url,
          at,
        );
        document = { id: documentId };
      }
      s.run(
        "INSERT INTO funding_event_evidence (event_id,evidence_key,document_id) VALUES (?,?,?)",
        id,
        e.key,
        document!.id,
      );
    }
  }
  function save(
    id: string,
    data: FundingDraft,
    c: FundingCompany,
    previous: FundingEvent | null,
    reason: string,
    archive?: {
      archived: boolean;
      duplicateOf: string | null;
      archiveReason: string;
    },
  ) {
    const state = archive ?? {
      archived: previous?.archived ?? false,
      duplicateOf: previous?.duplicateOf ?? null,
      archiveReason: previous?.archiveReason ?? "",
    };
    const normalized: FundingDraft = {
      ...data,
      company: { id: c.id },
      companyReason: data.companyReason || "手动创建公司，未与其他公司自动合并",
    };
    validateRelation(normalized, id, c.id);
    const fp = fingerprint(
      normalized,
      state.archived,
      state.duplicateOf,
      state.archiveReason,
    );
    const old = previous
      ? s.one("SELECT fingerprint FROM funding_events WHERE id=?", id)
      : null;
    if (old?.fingerprint === fp)
      return { id, version: previous!.version, changed: false };
    const at = s.now(),
      version = (previous?.version ?? 0) + 1;
    s.run(
      `INSERT INTO funding_events (id,company_id,version,payload,fingerprint,first_seen_at,updated_at,archived,duplicate_of,archive_reason) VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET company_id=excluded.company_id,version=excluded.version,payload=excluded.payload,fingerprint=excluded.fingerprint,updated_at=excluded.updated_at,archived=excluded.archived,duplicate_of=excluded.duplicate_of,archive_reason=excluded.archive_reason`,
      id,
      c.id,
      version,
      JSON.stringify(normalized),
      fp,
      at,
      at,
      Number(state.archived),
      state.duplicateOf,
      state.archiveReason,
    );
    linkDocuments(id, normalized, at);
    s.run(
      "INSERT INTO funding_revisions (event_id,version,created_at,reason,snapshot) VALUES (?,?,?,?,?)",
      id,
      version,
      at,
      reason,
      JSON.stringify({ data: normalized, company: c, ...state }),
    );
    return { id, version, changed: true };
  }
  function create(req: FundingCreateRequest): FundingMutationResult {
    return mutate(req.idempotencyKey, "create", req, () => {
      checkDuplicates(req.data, undefined, req.separateReason);
      const c = resolveCompany(req.data);
      return save(
        `funding:${randomUUID()}`,
        req.data,
        c,
        null,
        req.separateReason
          ? `手动录入；另建理由：${req.separateReason}`
          : "手动录入",
      );
    });
  }
  function update(
    id: string,
    req: FundingUpdateRequest,
  ): FundingMutationResult {
    return mutate(req.idempotencyKey, `update:${id}`, req, () => {
      const previous = event(id);
      checkVersion(previous, req.expectedVersion);
      checkDuplicates(req.data, id, req.separateReason, previous.data);
      const c = resolveCompany(req.data);
      // Keep existing related/replacement relationships valid when reassigning a company.
      if (
        c.id !== previous.companyId &&
        s.one(
          "SELECT id FROM funding_events WHERE duplicate_of=? OR json_extract(payload,'$.relatedEventId')=? LIMIT 1",
          id,
          id,
        )
      )
        throw new FundingError(
          409,
          "RELATION_CONFLICT",
          "其他记录引用此轮次，请先解除关系再变更公司",
        );
      return save(
        id,
        req.data,
        c,
        previous,
        req.reason +
          (req.separateReason ? `；另建理由：${req.separateReason}` : ""),
      );
    });
  }
  function append(
    id: string,
    req: FundingEvidenceRequest,
  ): FundingMutationResult {
    return mutate(req.idempotencyKey, `evidence:${id}`, req, () => {
      const previous = event(id);
      checkVersion(previous, req.expectedVersion);
      const data = fundingDraftSchema.parse({
        ...previous.data,
        evidence: [...previous.data.evidence, req.evidence],
      });
      return save(id, data, company(previous.companyId), previous, req.reason);
    });
  }
  function archive(
    id: string,
    req: FundingArchiveRequest,
  ): FundingMutationResult {
    return mutate(req.idempotencyKey, `archive:${id}`, req, () => {
      const previous = event(id);
      checkVersion(previous, req.expectedVersion, false);
      const targetId = req.duplicateOf ?? null;
      if (!req.archived && targetId)
        throw new FundingError(
          400,
          "VALIDATION_ERROR",
          "恢复记录时须清空归并目标",
        );
      if (
        req.archived &&
        s.one("SELECT id FROM funding_events WHERE duplicate_of=? LIMIT 1", id)
      )
        throw new FundingError(
          409,
          "RELATION_CONFLICT",
          "此记录是其他归档记录的目标，请先调整原关联",
        );
      if (targetId) {
        const target = event(targetId);
        if (
          target.id === id ||
          target.archived ||
          target.companyId !== previous.companyId
        )
          throw new FundingError(
            400,
            "VALIDATION_ERROR",
            "归档目标须为同公司另一个未归档事件",
          );
      }
      return save(
        id,
        previous.data,
        company(previous.companyId),
        previous,
        req.reason,
        {
          archived: req.archived,
          duplicateOf: targetId,
          archiveReason: req.archived ? req.reason : "",
        },
      );
    });
  }
  function observe(id: string, req: FundingObservationRequest) {
    return mutate(req.idempotencyKey, `observe:${id}`, req, () => {
      const previous = event(id);
      checkVersion(previous, req.expectedVersion, false);
      const evidence = previous.data.evidence.find(
        (e) => e.key === req.evidenceKey,
      );
      if (!evidence)
        throw new FundingError(404, "NOT_FOUND", "当前版本不存在该证据");
      const document = s.one(
        "SELECT document_id FROM funding_event_evidence WHERE event_id=? AND evidence_key=?",
        id,
        req.evidenceKey,
      )!;
      const observationId = `observation:${randomUUID()}`;
      s.run(
        "INSERT INTO funding_observations (id,event_id,evidence_key,document_id,observed_at,outcome,note,version,evidence) VALUES (?,?,?,?,?,?,?,?,?)",
        observationId,
        id,
        evidence.key,
        document.document_id,
        s.now(),
        req.outcome,
        req.note,
        previous.version,
        JSON.stringify(evidence),
      );
      return { id: observationId, eventId: id, version: previous.version };
    });
  }
  return {
    companies,
    list,
    detail,
    duplicates,
    create,
    update,
    append,
    archive,
    observe,
  };
}
