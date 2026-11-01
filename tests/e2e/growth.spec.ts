import { test, expect } from "@playwright/test";
test("growth evidence, notes, confirmed App link and mobile layout", async ({
  page,
}) => {
  await page.goto("/growth");
  await expect(
    page.getByRole("heading", { name: "增长投入雷达." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "测试增长公司", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "UGC Growth Manager", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关注公司", exact: true }).click();
  await page.getByLabel("公司研究笔记").fill("验证创作者渠道的转化与留存");
  await page.getByRole("button", { name: "保存笔记", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  await page.getByLabel("搜索关联 App").fill("777");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await page
    .getByRole("button", { name: "确认关联 测试产品 777 us", exact: true })
    .click();
  await expect(page.getByText("US · 查看排名与笔记 ↗")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("公司研究笔记")).toHaveValue(
    "验证创作者渠道的转化与留存",
  );
  await expect(
    page.getByRole("button", { name: "已关注", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "返回增长雷达" }).click();
  await page.getByRole("button", { name: "已关注", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "测试增长公司" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("manual SideShift and Wellfound records persist and remain editable", async ({
  page,
}) => {
  await page.goto("/growth");
  await page.getByRole("button", { name: "录入线索", exact: true }).click();
  await page
    .getByLabel("原始链接", { exact: true })
    .fill("https://app.sideshift.app/jobs/e2e-campaign");
  await page
    .getByLabel("公司 / 产品名称", { exact: true })
    .fill("测试人工产品");
  await page
    .getByLabel("发布机构（可选）", { exact: true })
    .fill("测试代理机构");
  await page.getByLabel("线索标题", { exact: true }).fill("测试 UGC 活动");
  await page
    .getByLabel("研究记录", { exact: true })
    .fill("招募 TikTok creators；需要验证投放是否持续。");
  await page
    .getByLabel("报酬原文（可选）", { exact: true })
    .fill("$500 / month");
  await page.getByRole("button", { name: "保存线索", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "测试人工产品", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "编辑线索", exact: true }).click();
  await page.getByLabel("线索标题", { exact: true }).fill("测试 UGC 活动修订");
  await page.getByRole("button", { name: "保存线索", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "测试 UGC 活动修订", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "返回增长雷达" }).click();
  await page.getByRole("button", { name: "录入线索", exact: true }).click();
  await page.getByLabel("线索来源").selectOption("wellfound");
  await page.getByLabel("归属公司").selectOption({ label: "测试人工产品" });
  await page.getByLabel("线索类型").selectOption("job");
  await page
    .getByLabel("原始链接", { exact: true })
    .fill("https://wellfound.com/jobs/12345-e2e");
  await page.getByLabel("线索标题", { exact: true }).fill("测试增长招聘");
  await page
    .getByLabel("研究记录", { exact: true })
    .fill("SEO 与 content marketing 岗位，先保存自己的研究记录。");
  await page.getByRole("button", { name: "保存线索", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "测试增长招聘", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "测试 UGC 活动修订", exact: true }),
  ).toBeVisible();
});
