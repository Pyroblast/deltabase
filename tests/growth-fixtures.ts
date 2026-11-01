import { parseYCDetail } from "../server/yc";
export function page(props: unknown) {
  return `<div data-page="${JSON.stringify({ props }).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}"></div>`;
}
export function ycJob(id = 101, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: "UGC Growth Manager",
    url: `/companies/test-lab/jobs/test-${id}`,
    companyName: "测试增长公司",
    companyBatchName: "S26",
    companyOneLiner: "测试用产品",
    location: "Remote",
    salaryRange: "$50K–$90K",
    type: "Full-time",
    createdAt: "2 months",
    description:
      "Recruit creators on TikTok and Instagram. Manage paid acquisition in new markets.",
    ...extra,
  };
}
export function detailPage(id = 101, extra: Record<string, unknown> = {}) {
  return page({
    job: ycJob(id, extra),
    company: {
      id: 42,
      name: "测试增长公司",
      website: "https://example.com",
      one_liner: "仅用于自动化测试的增长产品",
      batch_name: "S26",
    },
  });
}
export const jobUrl = (id: number) =>
  `https://www.ycombinator.com/companies/test-lab/jobs/test-${id}`;
export function lead(id = 101, extra: Record<string, unknown> = {}) {
  return parseYCDetail(detailPage(id, extra), {
    id: String(id),
    url: jobUrl(id),
  });
}
export const manual = {
  source: "sideshift",
  url: "https://app.sideshift.app/jobs/test-manual",
  companyName: "测试手动产品",
  publisher: "测试代理商",
  website: "https://example.org",
  title: "测试 Creator 招募",
  kind: "campaign",
  description: "招募 TikTok UGC creators，研究发布机构与产品的关系。",
  compensation: "$500 / month",
  compensationUnit: "创作者月费",
};
