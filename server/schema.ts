import {
  sqliteTable,
  text,
  integer,
  blob,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
export const apps = sqliteTable("apps", {
  id: text("id").primaryKey(),
  firstSeen: text("first_seen").notNull(),
  watch: integer("watch").notNull().default(0),
  ignored: integer("ignored").notNull().default(0),
  tags: text("tags").notNull().default(""),
});
export const listings = sqliteTable(
  "listings",
  {
    id: text("app_id")
      .notNull()
      .references(() => apps.id),
    market: text("market").notNull(),
    name: text("name").notNull(),
    developer: text("developer").notNull(),
    icon: text("icon").notNull(),
    url: text("url").notNull(),
    category: integer("category").notNull(),
    price: integer("price", { mode: "number" }),
    currency: text("currency").notNull(),
    releaseDate: text("release_date"),
    metadata: text("metadata"),
    metadataAt: text("metadata_at"),
  },
  (t) => [uniqueIndex("listing_identity").on(t.id, t.market)],
);
export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  market: text("market").notNull(),
  category: integer("category").notNull(),
  kind: text("kind").notNull(),
  enabled: integer("enabled").notNull().default(1),
  status: text("status").notNull().default("pending"),
  lastChecked: text("last_checked"),
  lastSuccess: text("last_success"),
  error: text("error"),
  count: integer("count").notNull().default(0),
});
export const snapshots = sqliteTable(
  "snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    observedAt: text("observed_at").notNull(),
    sourceUpdatedAt: text("source_updated_at"),
    fingerprint: text("fingerprint").notNull(),
    count: integer("count").notNull(),
    raw: blob("raw", { mode: "buffer" }).notNull(),
  },
  (t) => [
    uniqueIndex("snapshot_identity").on(t.sourceId, t.fingerprint),
    index("snapshot_history").on(t.sourceId, t.observedAt),
  ],
);
export const ranks = sqliteTable(
  "ranks",
  {
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => snapshots.id),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    rank: integer("rank").notNull(),
  },
  (t) => [
    uniqueIndex("rank_identity").on(t.snapshotId, t.appId),
    index("rank_app").on(t.appId),
  ],
);
export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    sourceId: text("source_id"),
    snapshotId: integer("snapshot_id"),
    market: text("market").notNull(),
    type: text("type").notNull(),
    observedAt: text("observed_at").notNull(),
    details: text("details").notNull(),
  },
  (t) => [index("event_app").on(t.appId, t.observedAt)],
);
export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id),
  audience: text("audience").notNull(),
  hypothesis: text("hypothesis").notNull(),
  evidence: text("evidence").notNull(),
  nextStep: text("next_step").notNull(),
  links: text("links").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  total: integer("total").notNull(),
  done: integer("done").notNull().default(0),
  success: integer("success").notNull().default(0),
  empty: integer("empty").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  error: text("error"),
});
export const runItems = sqliteTable(
  "run_items",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    status: text("status").notNull(),
    error: text("error"),
  },
  (t) => [uniqueIndex("run_item_identity").on(t.runId, t.sourceId)],
);

// Growth research is independent of Apple identities and ranking sources.
export const growthCompanies = sqliteTable("growth_companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website").notNull().default(""),
  summary: text("summary").notNull().default(""),
  batch: text("batch").notNull().default(""),
  watch: integer("watch").notNull().default(0),
  ignored: integer("ignored").notNull().default(0),
  notes: text("notes").notNull().default(""),
  firstSeen: text("first_seen").notNull(),
});
export const growthSourceState = sqliteTable("growth_source_state", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  lastChecked: text("last_checked"),
  lastSuccess: text("last_success"),
  error: text("error"),
  baselineIds: text("baseline_ids"),
});
export const growthLeads = sqliteTable(
  "growth_leads",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    companyId: text("company_id")
      .notNull()
      .references(() => growthCompanies.id),
    url: text("url").notNull(),
    payload: text("payload").notNull(),
    fingerprint: text("fingerprint").notNull(),
    firstSeen: text("first_seen").notNull(),
    lastSeen: text("last_seen").notNull(),
    lastChecked: text("last_checked").notNull(),
    checkError: text("check_error"),
    inLatestList: integer("in_latest_list").notNull().default(1),
  },
  (t) => [
    uniqueIndex("growth_source_url").on(t.source, t.url),
    index("growth_lead_company").on(t.companyId),
  ],
);
export const growthVersions = sqliteTable(
  "growth_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: text("lead_id")
      .notNull()
      .references(() => growthLeads.id),
    observedAt: text("observed_at").notNull(),
    event: text("event").notNull(),
    payload: text("payload").notNull(),
    fingerprint: text("fingerprint").notNull(),
  },
  (t) => [index("growth_version_lead").on(t.leadId, t.id)],
);
export const growthRuns = sqliteTable("growth_runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  total: integer("total").notNull().default(0),
  done: integer("done").notNull().default(0),
  success: integer("success").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  error: text("error"),
});
export const growthObservations = sqliteTable("growth_observations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id")
    .notNull()
    .references(() => growthRuns.id),
  url: text("url").notNull(),
  observedAt: text("observed_at").notNull(),
  versionId: integer("version_id").references(() => growthVersions.id),
  error: text("error"),
});
export const growthAppLinks = sqliteTable(
  "growth_app_links",
  {
    companyId: text("company_id")
      .notNull()
      .references(() => growthCompanies.id),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    confirmedAt: text("confirmed_at").notNull(),
  },
  (t) => [uniqueIndex("growth_app_identity").on(t.companyId, t.appId)],
);
