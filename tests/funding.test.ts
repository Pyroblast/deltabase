import { it, expect } from "vitest";
import {
  canonicalFundingUrl,
  fundingDraftSchema,
  fundingDateSchema,
  dateInterval,
} from "../server/funding-validation";
import {
  fundingDraft,
  fundingEvidence,
  unknownFundingDate,
} from "./funding-fixtures";
it("preserves business query params, paths and original slash distinctions while dropping tracking", () => {
  expect(
    canonicalFundingUrl(
      "https://EXAMPLE.com/News?id=7&ref=article&utm_source=x#section",
    ),
  ).toBe("https://example.com/News?id=7&ref=article");
  expect(canonicalFundingUrl("https://example.com/News/")).not.toBe(
    canonicalFundingUrl("https://example.com/news"),
  );
  expect(canonicalFundingUrl("https://example.com/a/")).not.toBe(
    canonicalFundingUrl("https://example.com/a"),
  );
});
it("validates dates without inventing precision and filters month intervals", () => {
  for (const d of [
    { raw: "x", value: "2026-02-30", precision: "day" },
    { raw: "x", value: "2026-13", precision: "month" },
    { raw: "x", value: "2026-07-07T09:00:00", precision: "instant" },
    { raw: "x", value: "2026-07-07", precision: "unknown" },
    { raw: "x", value: "2026-07-07T24:00:00Z", precision: "instant" },
  ])
    expect(fundingDateSchema.safeParse(d).success).toBe(false);
  expect(
    dateInterval({ raw: "Feb 2024", value: "2024-02", precision: "month" }),
  ).toEqual(["2024-02-01", "2024-02-29"]);
  expect(
    dateInterval({
      raw: "2026-07-07T20:00:00Z",
      value: "2026-07-07T20:00:00Z",
      precision: "instant",
    }),
  ).toEqual(["2026-07-08", "2026-07-08"]);
  expect(dateInterval(unknownFundingDate())).toBeNull();
});
it("requires field-level evidence, investor references and company association basis", () => {
  const d = fundingDraft();
  expect(fundingDraftSchema.safeParse(d).success).toBe(true);
  expect(
    fundingDraftSchema.safeParse({
      ...d,
      evidence: [{ ...d.evidence[0], supports: [] }],
    }).success,
  ).toBe(false);
  expect(
    fundingDraftSchema.safeParse({
      ...d,
      investors: [{ name: "Test", role: "lead", evidenceKeys: ["missing"] }],
    }).success,
  ).toBe(false);
  expect(
    fundingDraftSchema.safeParse({ ...d, company: { id: "yc:1" } }).success,
  ).toBe(false);
  expect(
    fundingDraftSchema.safeParse({
      ...d,
      evidence: [
        d.evidence[0],
        fundingEvidence("two", d.evidence[0].url + "&utm_source=other"),
      ],
    }).success,
  ).toBe(false);
  for (const url of [
    "javascript:alert(1)",
    "https://user:password@example.com/news",
    "file:///etc/passwd",
  ])
    expect(
      fundingDraftSchema.safeParse({
        ...d,
        evidence: [{ ...d.evidence[0], url }],
      }).success,
    ).toBe(false);
});
it("keeps unknown, imprecise, mixed and large monetary amounts without coercion", () => {
  const d = fundingDraft();
  for (const a of [
    {
      ...d.amount,
      raw: "数千万",
      kind: "approximate",
      currency: null,
      value: null,
    },
    {
      ...d.amount,
      raw: "over $20M",
      scope: "cumulative",
      kind: "lower_bound",
      value: "20000000",
    },
    { ...d.amount, raw: "股权和债务合计", scope: "mixed", kind: "exact" },
    {
      ...d.amount,
      raw: "not disclosed",
      kind: "undisclosed",
      value: null,
      currency: null,
    },
    {
      ...d.amount,
      raw: "range",
      kind: "range",
      value: "9007199254740993.01",
      upper: "9007199254740993.02",
    },
  ])
    expect(fundingDraftSchema.safeParse({ ...d, amount: a }).success).toBe(
      true,
    );
  for (const a of [
    { ...d.amount, kind: "undisclosed", value: "0" },
    { ...d.amount, value: "-10" },
    { ...d.amount, value: "1e6" },
    {
      ...d.amount,
      kind: "range",
      value: "9007199254740993.02",
      upper: "9007199254740993.01",
    },
    { ...d.amount, kind: "range", upper: null },
    { ...d.amount, currency: null },
    { ...d.amount, kind: "exact", upper: "2" },
  ])
    expect(fundingDraftSchema.safeParse({ ...d, amount: a }).success).toBe(
      false,
    );
});
