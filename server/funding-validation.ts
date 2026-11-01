import { z } from "zod";
import { fundingFieldNames, type FundingDate } from "../shared/funding.js";
export class FundingError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
export function validateHttpUrl(input: string) {
  try {
    const u = new URL(input);
    return (
      ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
    );
  } catch {
    return false;
  }
}
export function canonicalFundingUrl(input: string) {
  const u = new URL(input);
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (key.toLowerCase().startsWith("utm_")) u.searchParams.delete(key);
  return u.href;
}
const str = (max = 1000) => z.string().trim().max(max);
const required = (max = 1000) => str(max).min(1);
const url = required(3000).refine(
  validateHttpUrl,
  "来源链接须为无账号密码的 HTTP(S) 地址",
);
function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value &&
    Number(value.slice(0, 4)) >= 1000
  );
}
export const fundingDateSchema = z
  .object({
    raw: str(300),
    value: str(100).nullable(),
    precision: z.enum(["unknown", "year", "month", "day", "instant"]),
  })
  .strict()
  .superRefine((v, c) => {
    const value = v.value;
    const valid =
      v.precision === "unknown"
        ? value === null
        : value !== null &&
          (v.precision === "year"
            ? /^[1-9]\d{3}$/.test(value)
            : v.precision === "month"
              ? /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value)
              : v.precision === "day"
                ? validDay(value)
                : /^[1-9]\d{3}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(
                    value,
                  ) &&
                  validDay(value.slice(0, 10)) &&
                  Number.isFinite(Date.parse(value)));
    if (!valid)
      c.addIssue({
        code: "custom",
        path: ["value"],
        message: "时间值与精度不匹配，日期须真实且时刻须含时区",
      });
    if (v.precision !== "unknown" && !v.raw)
      c.addIssue({
        code: "custom",
        path: ["raw"],
        message: "请保留来源时间原文",
      });
  });
const decimal = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,20})(?:\.\d{1,8})?$/,
    "规范化金额须为非负十进制字符串",
  )
  .nullable();
function compareDecimal(a: string, b: string) {
  const scaled = (s: string) => {
    const [i, f = ""] = s.split(".");
    return BigInt(i + f.padEnd(8, "0"));
  };
  return scaled(a) <= scaled(b);
}
const amount = z
  .object({
    raw: str(1000),
    scope: z.enum(["round", "cumulative", "valuation", "mixed"]),
    kind: z.enum([
      "undisclosed",
      "exact",
      "approximate",
      "range",
      "lower_bound",
    ]),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    value: decimal,
    upper: decimal,
  })
  .strict()
  .superRefine((v, c) => {
    const fail = (message: string) => c.addIssue({ code: "custom", message });
    if (v.kind === "undisclosed" && (v.value !== null || v.upper !== null))
      fail("未披露金额不能填规范化数值");
    if (v.kind !== "undisclosed" && !v.raw) fail("请保留金额原文");
    if ((v.value !== null || v.upper !== null) && !v.currency)
      fail("规范化金额须注明币种");
    if (v.kind !== "range" && v.upper !== null) fail("只有范围金额可填写上界");
    if (
      v.kind === "range" &&
      ((v.value === null) !== (v.upper === null) ||
        (v.value !== null &&
          v.upper !== null &&
          !compareDecimal(v.value, v.upper)))
    )
      fail("范围金额须同时填写有效的上下界，或均留空");
  });
const fields = Object.keys(fundingFieldNames) as [
  keyof typeof fundingFieldNames,
  ...Array<keyof typeof fundingFieldNames>,
];
export const fundingEvidenceSchema = z
  .object({
    key: required(100),
    url,
    title: required(500),
    publisher: required(300),
    role: z.enum(["company", "investor", "media", "database", "other"]),
    summary: required(10000),
    published: fundingDateSchema,
    sourceUpdated: fundingDateSchema,
    supports: z.array(z.enum(fields)).max(8),
  })
  .strict();
export const fundingDraftSchema = z
  .object({
    company: z.union([
      z.object({ id: required(150) }).strict(),
      z
        .object({
          name: required(200),
          website: str(2000).refine(
            (v) => !v || validateHttpUrl(v),
            "公司官网须为 HTTP(S) 地址",
          ),
        })
        .strict(),
    ]),
    title: required(500),
    recordKind: z.enum(["event", "lead"]),
    roundRaw: str(300),
    roundNormalized: str(100),
    financingType: z.enum([
      "equity",
      "convertible",
      "debt",
      "mixed",
      "unspecified",
    ]),
    statusRaw: str(1000),
    amount,
    occurred: fundingDateSchema,
    published: fundingDateSchema,
    investors: z
      .array(
        z
          .object({
            name: required(300),
            role: z.enum(["lead", "participant", "unspecified"]),
            evidenceKeys: z.array(required(100)).min(1).max(20),
          })
          .strict(),
      )
      .max(50),
    useOfFunds: str(10000),
    verification: z.enum(["unverified", "source_checked", "conflicting"]),
    notes: str(30000),
    companyReason: str(3000),
    relatedEventId: required(150).nullable(),
    relationRaw: str(1000),
    evidence: z.array(fundingEvidenceSchema).min(1).max(20),
  })
  .strict()
  .superRefine((v, c) => {
    const issue = (path: (string | number)[], message: string) =>
      c.addIssue({ code: "custom", path, message });
    const keys = new Set<string>();
    const urls = new Set<string>();
    v.evidence.forEach((e, i) => {
      if (keys.has(e.key)) issue(["evidence", i, "key"], "证据 key 重复");
      keys.add(e.key);
      if (validateHttpUrl(e.url)) {
        const u = canonicalFundingUrl(e.url);
        if (urls.has(u))
          issue(["evidence", i, "url"], "同一事件中该文档已存在，请编辑原证据");
        urls.add(u);
      }
    });
    if ("id" in v.company && !v.companyReason)
      issue(["companyReason"], "请填写选择或关联此公司的依据");
    if (v.relatedEventId && !v.relationRaw)
      issue(["relationRaw"], "请说明与相关轮次的关系");
    const needed: (keyof typeof fundingFieldNames)[] = [];
    if (v.roundRaw || v.roundNormalized) needed.push("round");
    if (
      v.amount.raw ||
      v.amount.kind !== "undisclosed" ||
      v.amount.value !== null
    )
      needed.push("amount");
    if (v.occurred.raw || v.occurred.value) needed.push("occurred");
    if (v.published.raw || v.published.value) needed.push("published");
    if (v.statusRaw) needed.push("status");
    if (v.useOfFunds) needed.push("useOfFunds");
    for (const f of needed)
      if (!v.evidence.some((e) => e.supports.includes(f)))
        issue(["evidence"], `请为${fundingFieldNames[f]}选择支持证据`);
    v.investors.forEach((investor, i) => {
      for (const key of investor.evidenceKeys)
        if (
          !v.evidence.some(
            (e) => e.key === key && e.supports.includes("investors"),
          )
        )
          issue(
            ["investors", i, "evidenceKeys"],
            "投资方必须引用支持投资方字段的证据",
          );
    });
  });
const idem = required(160).min(8);
const expected = z.number().int().positive();
export const createFundingSchema = z
  .object({
    idempotencyKey: idem,
    data: fundingDraftSchema,
    separateReason: str(3000).optional(),
  })
  .strict();
export const updateFundingSchema = z
  .object({
    idempotencyKey: idem,
    expectedVersion: expected,
    data: fundingDraftSchema,
    reason: required(3000),
    separateReason: str(3000).optional(),
  })
  .strict();
export const appendFundingSchema = z
  .object({
    idempotencyKey: idem,
    expectedVersion: expected,
    evidence: fundingEvidenceSchema,
    reason: required(3000),
  })
  .strict();
export const archiveFundingSchema = z
  .object({
    idempotencyKey: idem,
    expectedVersion: expected,
    archived: z.boolean(),
    duplicateOf: required(150).nullable().optional(),
    reason: required(3000),
  })
  .strict();
export const observationFundingSchema = z
  .object({
    idempotencyKey: idem,
    expectedVersion: expected,
    evidenceKey: required(100),
    outcome: z.enum(["readable", "unavailable", "conflicting", "withdrawn"]),
    note: required(5000),
  })
  .strict();
export const duplicateFundingSchema = z
  .object({ data: fundingDraftSchema, excludeId: required(150).optional() })
  .strict();
export const listFundingSchema = z
  .object({
    q: str(200).default(""),
    companyId: str(150).default(""),
    recordKind: z.enum(["all", "event", "lead"]).default("all"),
    archived: z.enum(["0", "1", "all"]).default("0"),
    dateType: z.enum(["discovered", "published"]).default("discovered"),
    from: z.string().refine(validDay).optional(),
    to: z.string().refine(validDay).optional(),
    unknownDate: z.enum(["0", "1"]).default("0"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, "日期起点不能晚于终点");
/** Inclusive calendar intervals, preserving year/month precision. */
export function dateInterval(d: FundingDate): [string, string] | null {
  if (d.value === null || d.precision === "unknown") return null;
  if (d.precision === "year") return [`${d.value}-01-01`, `${d.value}-12-31`];
  if (d.precision === "month") {
    const [y, m] = d.value.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [`${d.value}-01`, `${d.value}-${last}`];
  }
  if (d.precision === "instant") {
    const day = new Date(Date.parse(d.value) + 8 * 3600000)
      .toISOString()
      .slice(0, 10);
    return [day, day];
  }
  return [d.value, d.value];
}
