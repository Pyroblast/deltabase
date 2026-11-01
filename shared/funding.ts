/** Financing MVP HTTP contract. No URL is fetched by these APIs. */
export const fundingRecordKinds = {
  event: "融资事件",
  lead: "待核验线索",
} as const;
export const fundingSourceRoles = {
  company: "公司发布",
  investor: "投资方发布",
  media: "媒体报道",
  database: "数据库记录",
  other: "其他来源",
} as const;
export const fundingFieldNames = {
  company: "公司身份",
  round: "轮次",
  amount: "金额与口径",
  occurred: "发生时间",
  published: "公告时间",
  investors: "投资方",
  useOfFunds: "资金用途",
  status: "交易状态",
} as const;
export type FundingField = keyof typeof fundingFieldNames;
export type FundingDate = {
  raw: string;
  value: string | null;
  precision: "unknown" | "year" | "month" | "day" | "instant";
};
export type FundingAmount = {
  raw: string;
  scope: "round" | "cumulative" | "valuation" | "mixed";
  kind: "undisclosed" | "exact" | "approximate" | "range" | "lower_bound";
  currency: string | null;
  value: string | null;
  upper: string | null;
};
export type FundingCompanyInput =
  { id: string } | { name: string; website: string };
export type FundingCompany = {
  id: string;
  name: string;
  website: string;
  summary: string;
  notes: string;
  watch: number;
  ignored: number;
};
export type FundingEvidenceInput = {
  /** Stable within an event, chosen by client (e.g. crypto.randomUUID()). */
  key: string;
  url: string;
  title: string;
  publisher: string;
  role: keyof typeof fundingSourceRoles;
  summary: string;
  published: FundingDate;
  sourceUpdated: FundingDate;
  supports: FundingField[];
};
export type FundingDraft = {
  company: FundingCompanyInput;
  title: string;
  recordKind: keyof typeof fundingRecordKinds;
  roundRaw: string;
  roundNormalized: string;
  financingType: "equity" | "convertible" | "debt" | "mixed" | "unspecified";
  statusRaw: string;
  amount: FundingAmount;
  occurred: FundingDate;
  published: FundingDate;
  investors: {
    name: string;
    role: "lead" | "participant" | "unspecified";
    evidenceKeys: string[];
  }[];
  useOfFunds: string;
  verification: "unverified" | "source_checked" | "conflicting";
  notes: string;
  companyReason: string;
  relatedEventId: string | null;
  relationRaw: string;
  evidence: FundingEvidenceInput[];
};
export type FundingEvent = {
  id: string;
  version: number;
  companyId: string;
  company: FundingCompany;
  data: FundingDraft;
  firstSeenAt: string;
  updatedAt: string;
  archived: boolean;
  duplicateOf: string | null;
  archiveReason: string;
};
export type FundingRevision = {
  id: number;
  version: number;
  createdAt: string;
  reason: string;
  snapshot: {
    data: FundingDraft;
    company: FundingCompany;
    archived: boolean;
    duplicateOf: string | null;
    archiveReason: string;
  };
};
export type FundingObservation = {
  id: string;
  eventId: string;
  evidenceKey: string;
  documentId: string;
  observedAt: string;
  outcome: "readable" | "unavailable" | "conflicting" | "withdrawn";
  note: string;
  version: number;
  evidence: FundingEvidenceInput;
};
export type FundingDocument = {
  key: string;
  documentId: string;
  canonicalUrl: string;
  originalUrl: string;
};
export type FundingDetail = {
  event: FundingEvent;
  revisions: FundingRevision[];
  observations: FundingObservation[];
  documents: FundingDocument[];
  appLinks: { id: string; name: string; market: string }[];
};
export type FundingList = {
  items: FundingEvent[];
  total: number;
  page: number;
  pageSize: number;
};
export type FundingDuplicate = {
  id: string;
  title: string;
  companyName: string;
  roundRaw: string;
  published: FundingDate;
  reasons: string[];
};
export type FundingMutationResult = {
  id: string;
  version: number;
  changed: boolean;
  replayed: boolean;
};
export type FundingCreateRequest = {
  idempotencyKey: string;
  data: FundingDraft;
  separateReason?: string;
};
export type FundingUpdateRequest = {
  idempotencyKey: string;
  expectedVersion: number;
  data: FundingDraft;
  reason: string;
  separateReason?: string;
};
export type FundingEvidenceRequest = {
  idempotencyKey: string;
  expectedVersion: number;
  evidence: FundingEvidenceInput;
  reason: string;
};
export type FundingArchiveRequest = {
  idempotencyKey: string;
  expectedVersion: number;
  archived: boolean;
  duplicateOf?: string | null;
  reason: string;
};
export type FundingObservationRequest = {
  idempotencyKey: string;
  expectedVersion: number;
  evidenceKey: string;
  outcome: FundingObservation["outcome"];
  note: string;
};
export type FundingConflict = {
  error: string;
  code:
    | "VERSION_CONFLICT"
    | "IDEMPOTENCY_CONFLICT"
    | "DUPLICATE_CANDIDATES"
    | "ARCHIVED"
    | "RELATION_CONFLICT";
  currentVersion?: number;
  candidates?: FundingDuplicate[];
};
export const emptyFundingDate = (): FundingDate => ({
  raw: "",
  value: null,
  precision: "unknown",
});
export const emptyFundingEvidence = (key: string): FundingEvidenceInput => ({
  key,
  url: "",
  title: "",
  publisher: "",
  role: "company",
  summary: "",
  published: emptyFundingDate(),
  sourceUpdated: emptyFundingDate(),
  supports: [],
});
export const emptyFundingDraft = (): FundingDraft => ({
  company: { name: "", website: "" },
  title: "",
  recordKind: "event",
  roundRaw: "",
  roundNormalized: "",
  financingType: "unspecified",
  statusRaw: "",
  amount: {
    raw: "",
    scope: "round",
    kind: "undisclosed",
    currency: null,
    value: null,
    upper: null,
  },
  occurred: emptyFundingDate(),
  published: emptyFundingDate(),
  investors: [],
  useOfFunds: "",
  verification: "unverified",
  notes: "",
  companyReason: "",
  relatedEventId: null,
  relationRaw: "",
  evidence: [],
});
