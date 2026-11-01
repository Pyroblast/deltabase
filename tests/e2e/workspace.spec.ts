import { test, expect } from "@playwright/test";
test("research workflow: discover, cross charts, follow, note, refresh and persist", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "从变化开始研究。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "交叉观察" }).click();
  await page.getByLabel("交叉筛选").selectOption("1");
  await page
    .getByRole("button", { name: "查看证据 测试产品 777", exact: true })
    .click();
  await page.getByRole("button", { name: "加入观察名单", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "已关注", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "完整档案" }).click();
  await expect(
    page.getByRole("heading", { name: "测试产品 777", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "写一条笔记" }).click();
  await page
    .getByLabel("需求假设", { exact: true })
    .fill("测试：用户愿意为专注付费");
  await page.getByLabel("下一步验证", { exact: true }).fill("访谈三位用户");
  await page.getByRole("button", { name: "保存笔记" }).click();
  await expect(
    page.getByText("测试：用户愿意为专注付费", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("研究标签", { exact: true }).fill("待访谈");
  await page.getByRole("button", { name: "保存标签" }).click();
  await page.reload();
  await expect(
    page.getByText("测试：用户愿意为专注付费", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("研究标签", { exact: true })).toHaveValue(
    "待访谈",
  );
  await page.getByRole("link", { name: "返回发现" }).click();
  await expect(page.getByLabel("交叉筛选")).toHaveValue("1");
  await expect(
    page.getByRole("button", { name: "查看证据 测试产品 777", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: /观察名单/ }).click();
  await expect(
    page.getByRole("heading", { name: "测试产品 777" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /数据状态/ }).click();
  await expect(
    page.getByText("26 个非游戏品类 × 2 个市场 × 3 类榜单"),
  ).toBeVisible();
  await page.getByText("采集范围设置", { exact: true }).click();
  await page.getByLabel("畅销榜（实验性）", { exact: true }).uncheck();
  await expect(
    page.getByLabel("畅销榜（实验性）", { exact: true }),
  ).not.toBeChecked();
});
test("changes, responsive navigation and no horizontal page overflow", async ({
  page,
}) => {
  await page.goto("/?tab=signals");
  await expect(page.getByText("从第 15 位升至第 1 位")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "从变化开始研究。" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "查看证据 测试产品 15", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "观察证据" }),
  ).toBeInViewport();
  await expect(page.getByText("#15 → #1", { exact: true })).toBeVisible();
});

test("preview drafts survive switching and reload, failed saves can be retried", async ({
  page,
}) => {
  await page.goto("/?tab=charts&market=us&category=6007&kind=free");
  await page
    .getByRole("button", { name: "查看证据 测试产品 15", exact: true })
    .click();
  await page
    .getByLabel("需求假设", { exact: true })
    .fill("侧栏：验证持续使用需求");
  await page
    .getByLabel("下一步验证", { exact: true })
    .fill("体验三天并记录阻力");
  await page.getByRole("button", { name: "下一个产品", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "测试产品 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("需求假设", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "上一个产品", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "测试产品 15", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("需求假设", { exact: true })).toHaveValue(
    "侧栏：验证持续使用需求",
  );
  await page.reload();
  await expect(page.getByLabel("下一步验证", { exact: true })).toHaveValue(
    "体验三天并记录阻力",
  );
  await page.route("**/api/apps/15/notes", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "测试保存失败" }),
    }),
  );
  await page.getByRole("button", { name: "保存笔记", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("测试保存失败");
  await expect(page.getByLabel("需求假设", { exact: true })).toHaveValue(
    "侧栏：验证持续使用需求",
  );
  await page.unroute("**/api/apps/15/notes");
  await page.getByRole("button", { name: "保存笔记", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("笔记已保存到本机");
  await page.reload();
  await expect(page.getByLabel("需求假设", { exact: true })).toHaveValue("");
  await page.getByText("最近的研究假设", { exact: true }).click();
  await expect(
    page.getByText("侧栏：验证持续使用需求", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "完整档案" }).click();
  await expect(
    page.getByText("侧栏：验证持续使用需求", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "返回发现" }).click();
  await expect(page.getByLabel("品类", { exact: true })).toHaveValue("6007");
  await expect(
    page.getByRole("button", { name: "查看证据 测试产品 15", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
