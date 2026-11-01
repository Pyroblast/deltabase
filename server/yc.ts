import { z } from "zod";
import {
  channelNames,
  type Evidence,
  type GrowthLead,
} from "../shared/growth.js";
export const YC_LIST_URL = "https://www.ycombinator.com/jobs/role/marketing";
function decode(s: string) {
  return s.replace(
    /&(#x[\da-f]+|#\d+|quot|amp|lt|gt|apos);/gi,
    (_, entity: string) => {
      if (entity.startsWith("#")) {
        const n =
          entity[1].toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : Number(entity.slice(1));
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "�";
      }
      return (
        { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'" } as Record<
          string,
          string
        >
      )[entity.toLowerCase()];
    },
  );
}
export function pageProps(html: string): unknown {
  const m = html.match(/\bdata-page\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!m)
    throw new Error(
      "YC 页面格式变化或访问受限：未找到公开岗位数据，已有数据保留",
    );
  try {
    return JSON.parse(decode(m[2])).props;
  } catch {
    throw new Error("YC 页面数据无法解析，已有数据保留");
  }
}
const optionalText = z
  .string()
  .nullish()
  .transform((v) => v ?? "");
const jobSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().min(1),
  companyName: z.string().min(1),
  companyBatchName: optionalText,
  companyOneLiner: optionalText,
  location: optionalText,
  salaryRange: optionalText,
  type: optionalText,
  createdAt: optionalText,
});
export function ycUrl(input: string) {
  const u = new URL(input, "https://www.ycombinator.com");
  if (
    u.origin !== "https://www.ycombinator.com" ||
    u.username ||
    u.password ||
    !/^\/companies\/[^/]+\/jobs\/[^/]+\/?$/.test(u.pathname)
  )
    throw new Error("YC 岗位地址无效");
  return u.origin + u.pathname.replace(/\/$/, "");
}
export function parseYCList(html: string) {
  const { jobPostings } = z
    .object({ jobPostings: z.array(jobSchema).max(200) })
    .parse(pageProps(html));
  if (!jobPostings.length)
    throw new Error(
      "YC 返回空列表，无法确认是空结果还是页面变化；保留已有数据",
    );
  const seen = new Set<number>();
  return jobPostings.map((j) => {
    if (seen.has(j.id)) throw new Error("YC 列表包含重复岗位 ID");
    seen.add(j.id);
    return { id: String(j.id), url: ycUrl(j.url) };
  });
}
const patterns = [
  /\b(?:UGC|creators?|influencers?)\b/i,
  /\bTikTok\b/i,
  /\bInstagram\b/i,
  /\b(?:Meta|Facebook)\s+(?:ads?|advertising)\b/i,
  /\b(?:paid\s+(?:acquisition|ads?|media|marketing|social)|performance\s+marketing|Google\s+Ads)\b/i,
  /\b(?:SEO|search engine optimization|content\s+(?:marketing|strategy))\b/i,
  /\b(?:CRM|retention|lifecycle\s+marketing)\b/i,
  /\b(?:GTM|go.to.market|market\s+expansion|new\s+markets)\b/i,
];
export function classify(title: string, description: string): Evidence[] {
  const lines = `${title}\n${description}`
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.replace(/^[#*\s-]+/, "").trim())
    .filter(Boolean);
  return patterns.flatMap((pattern, i) => {
    const text = lines.find(
      (s) =>
        pattern.test(s) &&
        !/\b(?:not|no|without|don't|do not)\b.{0,35}(?:UGC|creators?|influencers?|TikTok|Instagram|Meta|paid|SEO|CRM|retention|GTM)\b/i.test(
          s,
        ),
    );
    return text
      ? [{ channel: channelNames[i], text: text.slice(0, 1000) }]
      : [];
  });
}
export function parseYCDetail(
  html: string,
  expected: { id: string; url: string },
): GrowthLead {
  const { job: j, company: c } = z
    .object({
      job: jobSchema.extend({ description: z.string().min(1).max(100_000) }),
      company: z.object({
        id: z.number().int().positive(),
        name: z.string().min(1),
        website: optionalText,
        one_liner: optionalText,
        batch_name: optionalText,
      }),
    })
    .parse(pageProps(html));
  if (String(j.id) !== expected.id || ycUrl(j.url) !== expected.url)
    throw new Error("YC 岗位身份不匹配，未保存");
  return {
    source: "yc",
    externalId: String(j.id),
    url: expected.url,
    title: j.title,
    company: {
      id: `yc:${c.id}`,
      name: c.name,
      website: safeWebsite(c.website),
      summary: c.one_liner,
      batch: c.batch_name,
    },
    publisher: c.name,
    kind: "job",
    description: j.description,
    location: j.location,
    targetMarket: "",
    compensation: j.salaryRange,
    compensationUnit: "原文薪资范围（周期以原文为准）",
    employmentType: j.type,
    publishedLabel: j.createdAt,
    evidence: classify(j.title, j.description),
  };
}
export function safeWebsite(s: string) {
  try {
    const u = new URL(s);
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export async function fetchYC(url: string, signal: AbortSignal) {
  if (url !== YC_LIST_URL) ycUrl(url);
  const res = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
    redirect: "error",
    headers: {
      "User-Agent": "Deltabase/0.2 (personal research)",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`YC HTTP ${res.status}，未推断岗位关闭`);
  const text = await res.text();
  if (text.length > 5_000_000) throw new Error("YC 页面超过大小限制");
  return text;
}
