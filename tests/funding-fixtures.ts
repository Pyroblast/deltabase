import {
  emptyFundingDate,
  emptyFundingDraft,
  emptyFundingEvidence,
  type FundingDraft,
  type FundingEvidenceInput,
} from "../shared/funding";
export function fundingEvidence(
  key = "source-one",
  url = "https://example.com/funding?article=1",
): FundingEvidenceInput {
  return {
    ...emptyFundingEvidence(key),
    url,
    title: "测试公司融资公告",
    publisher: "测试公司",
    summary: "仅用于测试：公司宣布 A 轮融资，金额约 100 万美元。",
    published: { raw: "2026年7月7日", value: "2026-07-07", precision: "day" },
    supports: ["round", "amount", "published", "investors"],
  };
}
export function fundingDraft(
  overrides: Partial<FundingDraft> = {},
): FundingDraft {
  return {
    ...emptyFundingDraft(),
    company: { name: "测试融资公司", website: "https://example.com" },
    title: "测试 A 轮公告",
    roundRaw: "Series A",
    roundNormalized: "series_a",
    financingType: "equity",
    amount: {
      raw: "约100万美元",
      scope: "round",
      kind: "approximate",
      currency: "USD",
      value: "1000000",
      upper: null,
    },
    published: { raw: "2026年7月7日", value: "2026-07-07", precision: "day" },
    investors: [
      { name: "测试投资机构", role: "lead", evidenceKeys: ["source-one"] },
    ],
    evidence: [fundingEvidence()],
    ...overrides,
  };
}
export const unknownFundingDate = emptyFundingDate;
