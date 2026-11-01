import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  emptyFundingDraft,
  emptyFundingEvidence,
  type FundingDraft,
  type FundingDetail,
} from "../../shared/funding";
import { fundingDraft, fundingEvidence } from "../funding-fixtures";

const path = (id: string) => `/api/funding/${encodeURIComponent(id)}`;
const view = (id: string) => `/funding/${encodeURIComponent(id)}`;
async function create(
  request: APIRequestContext,
  data: FundingDraft,
  separateReason?: string,
) {
  const response = await request.post("/api/funding", {
    data: { data, idempotencyKey: randomUUID(), separateReason },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).id as string;
}
async function detail(
  request: APIRequestContext,
  id: string,
): Promise<FundingDetail> {
  return (await request.get(path(id))).json();
}
function sample(name: string): FundingDraft {
  return fundingDraft({
    company: {
      name,
      website: `https://${name.length}-${randomUUID()}.example.com`,
    },
    title: `${name} A 轮`,
    evidence: [
      fundingEvidence("source-one", `https://example.com/${randomUUID()}`),
    ],
  });
}
async function fillSource(page: Page, title: string, url: string) {
  await page.getByLabel("原始公告链接", { exact: true }).fill(url);
  await page.getByLabel("原文标题", { exact: true }).fill(title);
  await page.getByLabel("发布者", { exact: true }).fill("浏览器测试公司");
  await page
    .getByLabel("摘要或短摘录", { exact: true })
    .fill("隔离浏览器测试资料，仅用于验证来源保存，不是真实融资。");
}
async function fillLead(page: Page, name: string) {
  await page.goto("/funding/new");
  await page.getByLabel("公司名称", { exact: true }).fill(name);
  await page.getByLabel("记录标题", { exact: true }).fill(`${name} 待核验资料`);
  await page.getByLabel("记录性质", { exact: true }).selectOption("lead");
  await fillSource(
    page,
    `${name} 来源`,
    `https://example.com/${encodeURIComponent(name)}`,
  );
}
async function saveRecord(page: Page, title: string) {
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true, level: 1 }),
  ).toBeVisible();
}

test("funding form reuses a company, preserves three times and amount scope, and keeps no-App research independent", async ({
  page,
  request,
}) => {
  const baseline = (await (await request.get("/api/growth")).json()).totals
    .companies;
  const seed = emptyFundingDraft();
  seed.company = {
    name: "浏览器已有融资公司",
    website: "https://funding-browser.example.com",
  };
  seed.title = "已有公司背景";
  seed.recordKind = "lead";
  seed.evidence = [
    {
      ...emptyFundingEvidence("background"),
      url: "https://funding-browser.example.com/about",
      title: "测试背景",
      publisher: "测试公司",
      summary: "仅建立隔离测试公司。",
    },
  ];
  const seedId = await create(request, seed);
  const company = (await detail(request, seedId)).event.company;
  await page.goto("/funding/new");
  await page.getByLabel("选择已有公司", { exact: true }).check();
  await page.getByLabel("已有公司", { exact: true }).selectOption(company.id);
  await page
    .getByLabel("公司身份核对依据", { exact: true })
    .fill("公告链接与公司官网一致，本例是隔离合成数据。");
  await page
    .getByLabel("记录标题", { exact: true })
    .fill("浏览器已有公司累计融资资料");
  await page.getByLabel("轮次原文", { exact: true }).fill("Series A");
  await page.getByLabel("金额原文", { exact: true }).fill("累计超过数千万美元");
  await page.getByLabel("金额口径", { exact: true }).selectOption("cumulative");
  await page
    .getByLabel("金额表述", { exact: true })
    .selectOption("lower_bound");
  await page.getByLabel("公告日期精度", { exact: true }).selectOption("month");
  await page.getByLabel("公告日期", { exact: true }).fill("2026-07");
  await page.getByLabel("公告日期原文", { exact: true }).fill("2026年7月");
  await fillSource(
    page,
    "已有公司 A 轮资料",
    "https://funding-browser.example.com/series-a",
  );
  await page.getByLabel("支持轮次", { exact: true }).check();
  await page.getByLabel("支持金额与口径", { exact: true }).check();
  await page.getByLabel("支持公告时间", { exact: true }).check();
  await saveRecord(page, "浏览器已有公司累计融资资料");
  await expect(page.getByRole("region", { name: "融资时间" })).toContainText(
    "未知",
  );
  await expect(page.getByRole("region", { name: "融资时间" })).toContainText(
    "2026年7月（2026-07）",
  );
  await expect(page.getByRole("region", { name: "融资事实" })).toContainText(
    "累计融资 · 下界 / 超过",
  );
  await expect(page.getByText("尚未关联 App · 不影响独立研究")).toBeVisible();
  await page
    .getByLabel("公司共享研究笔记")
    .fill("下一步核对累计金额与本轮金额，暂不相加。");
  await page.getByRole("button", { name: "保存公司笔记" }).click();
  await expect(page.getByRole("status")).toHaveText("公司笔记已保存");
  await page.reload();
  await expect(page.getByLabel("公司共享研究笔记")).toHaveValue(
    "下一步核对累计金额与本轮金额，暂不相加。",
  );
  expect(
    (await (await request.get("/api/growth")).json()).totals.companies,
  ).toBe(baseline);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "编辑记录", exact: true }).click();
  await expect(page.getByLabel("金额原文", { exact: true })).toHaveValue(
    "累计超过数千万美元",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a committed creation with a lost response retries after reload with the same request and no duplicate", async ({
  page,
  request,
}) => {
  await fillLead(page, "响应丢失测试公司");
  let submitted: any;
  await page.route("**/api/funding", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    submitted = route.request().postDataJSON();
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(
    (await (await request.get("/api/funding?q=响应丢失测试公司")).json()).total,
  ).toBe(1);
  await page.unroute("**/api/funding");
  await page.reload();
  await expect(page.getByLabel("记录标题", { exact: true })).toHaveValue(
    "响应丢失测试公司 待核验资料",
  );
  const nextRequest = page.waitForRequest(
    (r) => r.url().endsWith("/api/funding") && r.method() === "POST",
  );
  await saveRecord(page, "响应丢失测试公司 待核验资料");
  expect((await nextRequest).postDataJSON().idempotencyKey).toBe(
    submitted.idempotencyKey,
  );
  expect(
    (await (await request.get("/api/funding?q=响应丢失测试公司")).json()).total,
  ).toBe(1);
  const id = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
  expect((await detail(request, id)).revisions).toHaveLength(1);
});

test("duplicate candidates support selecting one of several draft sources and preserve the remaining draft", async ({
  page,
  request,
}) => {
  const draft = sample("多来源候选测试");
  const id = await create(request, draft);
  const original = await detail(request, id);
  await page.goto("/funding/new");
  await page.getByLabel("选择已有公司", { exact: true }).check();
  await page
    .getByLabel("已有公司", { exact: true })
    .selectOption(original.event.companyId);
  await page
    .getByLabel("公司身份核对依据")
    .fill("同官网、同一公司，需核对是否同轮。");
  await page.getByLabel("记录标题", { exact: true }).fill("多来源草稿待核对");
  await page.getByLabel("轮次原文", { exact: true }).fill("Series A");
  await page.getByLabel("公告日期精度", { exact: true }).selectOption("day");
  await page.getByLabel("公告日期", { exact: true }).fill("2026-07-07");
  await page.getByLabel("公告日期原文", { exact: true }).fill("2026-07-07");
  await fillSource(
    page,
    "已存在的公司公告",
    `${draft.evidence[0].url}?utm_source=e2e`,
  );
  await page.getByLabel("支持轮次", { exact: true }).check();
  await page.getByLabel("支持公告时间", { exact: true }).check();
  await page.getByRole("button", { name: "添加另一份来源" }).click();
  await page
    .getByLabel("原始公告链接", { exact: true })
    .nth(1)
    .fill("https://investor.example.com/new-source");
  await page
    .getByLabel("原文标题", { exact: true })
    .nth(1)
    .fill("投资方补充公告");
  await page.getByLabel("发布者", { exact: true }).nth(1).fill("测试投资方");
  await page
    .getByLabel("证据性质", { exact: true })
    .nth(1)
    .selectOption("investor");
  await page
    .getByLabel("摘要或短摘录", { exact: true })
    .nth(1)
    .fill("隔离测试：投资方确认参与同一轮，未披露金额。");
  await page.getByLabel("支持投资方", { exact: true }).nth(1).check();
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "可能重复的融资记录" }),
  ).toBeVisible();
  await page
    .getByLabel("选择要追加的来源")
    .selectOption({ label: "来源 2 · 投资方补充公告" });
  await page.getByRole("button", { name: "追加该公告" }).click();
  await expect(
    page.getByRole("heading", { name: "为同一轮追加证据", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("原文标题", { exact: true })).toHaveValue(
    "投资方补充公告",
  );
  await page.getByRole("button", { name: "保存证据", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("证据已追加");
  const updated = await detail(request, id);
  expect(updated.event.data.evidence).toHaveLength(2);
  expect(updated.event.data.evidence[1].supports).toEqual(["investors"]);
  await page.goto("/funding/new");
  await expect(page.getByLabel("记录标题", { exact: true })).toHaveValue(
    "多来源草稿待核对",
  );
  await expect(page.getByLabel("原始公告链接", { exact: true })).toHaveCount(2);
});

test("editing keeps drafts on failure and version conflict; no-op saves and manual failed checks retain evidence", async ({
  page,
  request,
}) => {
  const id = await create(request, sample("版本冲突测试"));
  await page.goto(view(id));
  await page.getByRole("button", { name: "编辑记录", exact: true }).click();
  await page.getByLabel("金额原文", { exact: true }).fill("测试修订金额");
  await page
    .getByLabel("本次修改理由", { exact: true })
    .fill("核对公告金额说明");
  const prior = await detail(request, id);
  const remote = structuredClone(prior.event.data);
  remote.notes = "另一个操作新增的研究问题";
  const response = await request.put(path(id), {
    data: {
      data: remote,
      expectedVersion: prior.event.version,
      reason: "模拟并发编辑",
      idempotencyKey: randomUUID(),
    },
  });
  expect(response.ok()).toBe(true);
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("已被更新");
  await expect(page.getByLabel("金额原文", { exact: true })).toHaveValue(
    "测试修订金额",
  );
  await page.getByRole("button", { name: "读取最新版本", exact: true }).click();
  await expect(
    page.getByText("另一个操作新增的研究问题", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("事件疑问与下一步", { exact: true })
    .fill("另一个操作新增的研究问题");
  await page
    .getByRole("button", { name: "已核对，保留草稿并采用最新版本" })
    .click();
  await page.route(`**/api/funding/${encodeURIComponent(id)}`, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "模拟写入失败" }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("模拟写入失败");
  await page.unroute(`**/api/funding/${encodeURIComponent(id)}`);
  await page.reload();
  await page.getByRole("button", { name: "编辑记录", exact: true }).click();
  await expect(page.getByLabel("金额原文", { exact: true })).toHaveValue(
    "测试修订金额",
  );
  await saveRecord(page, "版本冲突测试 A 轮");
  await expect(page.getByRole("status")).toHaveText("记录已保存");
  expect((await detail(request, id)).event.version).toBe(3);
  await page.getByRole("button", { name: "编辑记录", exact: true }).click();
  await page.getByLabel("本次修改理由", { exact: true }).fill("同字段重新保存");
  await saveRecord(page, "版本冲突测试 A 轮");
  await expect(page.getByRole("status")).toHaveText("记录已保存");
  expect((await detail(request, id)).event.version).toBe(3);
  await page.getByRole("button", { name: "核验来源 1" }).click();
  await page
    .getByLabel("核验结果", { exact: true })
    .selectOption("unavailable");
  await page
    .getByLabel("核验说明")
    .fill("隔离测试：页面 404，保留上一份有效证据。");
  await page.getByRole("button", { name: "保存核验记录" }).click();
  await expect(page.getByRole("status")).toContainText("核验记录已保存");
  await page.reload();
  await expect(page.getByText(/访问失败 \/ 无法核对 ·/)).toBeVisible();
  const after = await detail(request, id);
  expect(after.event.version).toBe(3);
  expect(after.observations).toHaveLength(1);
  expect(after.event.data.evidence[0].summary).toBe(
    prior.event.data.evidence[0].summary,
  );
});

test("duplicate rounds require a reason and can be archived to a retained record then restored", async ({
  page,
  request,
}) => {
  const data = sample("归档浏览器测试");
  const id = await create(request, data);
  const original = await detail(request, id);
  await page.goto("/funding/new");
  await page.getByLabel("选择已有公司", { exact: true }).check();
  await page
    .getByLabel("已有公司", { exact: true })
    .selectOption(original.event.companyId);
  await page.getByLabel("公司身份核对依据").fill("测试公司身份已核对");
  await page.getByLabel("记录标题", { exact: true }).fill("归档测试副本");
  await fillSource(page, "重复公告", data.evidence[0].url);
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "可能重复的融资记录" }),
  ).toBeVisible();
  await page
    .getByLabel("确认为另一轮的理由")
    .fill("隔离测试：此公告回顾另一笔尚需核对的融资，暂分开记录。");
  await saveRecord(page, "归档测试副本");
  const copyId = decodeURIComponent(
    new URL(page.url()).pathname.split("/").pop()!,
  );
  await page.getByRole("button", { name: "归档记录", exact: true }).click();
  await page.getByLabel("重复记录归向（可选）").selectOption(id);
  await page
    .getByLabel("归档理由", { exact: true })
    .fill("复核后属于同轮，保留主记录与原证据。");
  await page.getByRole("button", { name: "确认归档" }).click();
  await expect(page.getByRole("status")).toHaveText("记录已归档");
  await page.reload();
  await expect(
    page.getByRole("link", { name: "查看保留的主记录" }),
  ).toBeVisible();
  expect((await detail(request, copyId)).event.duplicateOf).toBe(id);
  await page.getByRole("button", { name: "恢复记录", exact: true }).click();
  await page.getByLabel("恢复理由").fill("隔离测试验证可恢复性");
  await page.getByRole("button", { name: "确认恢复" }).click();
  await expect(page.getByRole("status")).toHaveText("记录已恢复");
  expect((await detail(request, copyId)).event.archived).toBe(false);
});

test("public research samples keep evidence roles, missing dates, independent time filters and mobile layout", async ({
  page,
  request,
}, testInfo) => {
  const pack = JSON.parse(
    readFileSync(
      new URL("../../docs/research/funding-acceptance.json", import.meta.url),
      "utf8",
    ),
  );
  const identities: Record<string, { name: string; website: string }> = {
    "real-boldvoice-series-a": {
      name: "BoldVoice",
      website: "https://www.boldvoice.com",
    },
    "real-agave-series-a": { name: "Agave", website: "https://useagave.com" },
    "real-educato-insufficient-evidence": {
      name: "Educato",
      website: "https://www.educato.com",
    },
  };
  const ids: Record<string, string> = {};
  for (const record of pack.apiDrafts) {
    const data = structuredClone(record.data) as FundingDraft;
    data.company = identities[record.recordId];
    ids[record.recordId] = await create(request, data);
  }
  const bold = await detail(request, ids["real-boldvoice-series-a"]);
  expect(bold.event.data.occurred.value).toBeNull();
  expect(bold.appLinks).toHaveLength(0);
  await page.goto(view(bold.event.id));
  await expect(
    page.getByRole("region", { name: "融资来源证据" }),
  ).toContainText("公司发布");
  await expect(
    page.getByRole("region", { name: "融资来源证据" }),
  ).toContainText("2026/01/28 22:30");
  await page.goto(view(ids["real-agave-series-a"]));
  await expect(
    page.getByRole("region", { name: "融资来源证据" }),
  ).toContainText("2 份来源");
  const investor = page
    .getByRole("region", { name: "融资来源证据" })
    .locator("article")
    .filter({ hasText: "Accel 宣布领投 Agave A 轮" });
  await expect(investor).toContainText("投资方发布");
  await expect(investor.getByText("金额与口径", { exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: testInfo.outputPath("funding-desktop.png"),
    fullPage: true,
  });
  await page.goto("/funding?q=BoldVoice");
  await page.getByLabel("筛选时间", { exact: true }).selectOption("published");
  await page.getByLabel("开始日期", { exact: true }).fill("2026-01-01");
  await page.getByLabel("结束日期", { exact: true }).fill("2026-01-31");
  await expect(
    page.getByRole("heading", { name: "BoldVoice 宣布 A 轮融资", exact: true }),
  ).toBeVisible();
  await page.getByLabel("筛选时间", { exact: true }).selectOption("discovered");
  await expect(page.getByText("没有符合条件的记录")).toBeVisible();
  await page.goto("/funding?q=Educato&dateType=published&unknownDate=1");
  await expect(
    page.getByRole("heading", {
      name: "Educato 的 YC 背景待补融资证据",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Educato 的 YC 背景待补融资证据/ })
    .click();
  await expect(page.getByRole("region", { name: "融资事实" })).toContainText(
    "未披露",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("funding-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "返回融资观察" }).click();
  await expect(page.getByLabel("搜索融资记录")).toHaveValue("Educato");
  await expect(page.getByLabel("仅看公告日期未知")).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
