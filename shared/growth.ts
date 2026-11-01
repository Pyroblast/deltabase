export const growthSources = {
  yc: "YC Jobs",
  sideshift: "SideShift",
  wellfound: "Wellfound",
} as const;
export type GrowthSource = keyof typeof growthSources;
export const channelNames = [
  "UGC / 创作者",
  "TikTok",
  "Instagram",
  "Meta 广告",
  "付费获客",
  "SEO / 内容",
  "留存 / CRM",
  "GTM / 市场拓展",
] as const;
export type Evidence = { channel: string; text: string };
export type GrowthLead = {
  externalId: string;
  source: GrowthSource;
  url: string;
  title: string;
  company: {
    id?: string;
    name: string;
    website: string;
    summary: string;
    batch: string;
  };
  publisher: string;
  kind: "job" | "campaign";
  description: string;
  location: string;
  targetMarket: string;
  compensation: string;
  compensationUnit: string;
  employmentType: string;
  publishedLabel: string;
  evidence: Evidence[];
};
export type GrowthRow = GrowthLead & {
  id: string;
  companyId: string;
  firstSeen: string;
  lastSeen: string;
  lastChecked: string;
  checkError: string | null;
  versionId: number;
  event: string;
  eventAt: string;
  inLatestList: number;
};
export const eventNames: Record<string, string> = {
  baseline: "初始基线",
  discovered: "新发现",
  changed: "内容变化",
  manual: "手动录入",
};
