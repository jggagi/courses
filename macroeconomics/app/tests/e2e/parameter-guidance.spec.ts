import { expect, test } from "@playwright/test";

const key = "courses:macroeconomics:v1";

test("percentage controls and policy coefficients retain their distinct units and accessible explanations", async ({
  page,
}) => {
  await page.goto("/#/lab/LA04");
  const savings = page.getByRole("spinbutton", {
    name: "储蓄率 s",
    exact: true,
  });
  await expect(savings).toHaveValue("20");
  await expect(savings).toHaveAccessibleDescription(/比例.*新增资本/);
  await expect(page.getByText(/储蓄率填20表示20%/)).toBeVisible();
  await page.getByRole("button", { name: "跳过预测", exact: true }).click();
  await page
    .getByRole("button", { name: "设A为当前情景", exact: true })
    .click();
  await savings.fill("40");
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  const growth = await page.evaluate(
    (storageKey) =>
      JSON.parse(localStorage.getItem(storageKey)!).labStates.LA04,
    key,
  );
  expect(growth.input.s).toBe(0.4);
  expect(growth.baseline.s).toBe(0.2);

  await page.goto("/#/lab/LA06");
  await expect(page.getByText(/利率和通胀填2表示2%/)).toBeVisible();
  const demand = page.getByRole("spinbutton", {
    name: "需求冲击 d",
    exact: true,
  });
  await expect(demand).toHaveAccessibleDescription(/缺口.*正数扩张/);
  await page.getByRole("button", { name: "跳过预测", exact: true }).click();
  await demand.fill("0.2");
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  const firstPolicy = page
    .getByTestId("la06-results")
    .locator("tbody tr")
    .nth(1);
  await expect(firstPolicy).toContainText("2.05");

  await page.goto("/#/lab/LA08");
  const interest = page.getByRole("spinbutton", {
    name: "有效名义利率 i",
    exact: true,
  });
  await expect(interest).toHaveValue("4");
  await expect(interest).toHaveAccessibleDescription(/上期期末债务/);
  await interest.fill("6");
  expect(
    await page.evaluate(
      (storageKey) =>
        JSON.parse(localStorage.getItem(storageKey)!).labStates.LA08.input
          .interestRate,
      key,
    ),
  ).toBe(0.06);
});

test("open-economy guidance explains a temporarily unbalanced draft and permits a balanced paired change", async ({
  page,
}) => {
  await page.goto("/#/lab/LA09");
  await page
    .getByText("参数怎么改 · 建议试验与允许范围", { exact: true })
    .click();
  await expect(page.getByText(/中间草稿可能暂时不平衡/)).toBeVisible();
  await page.getByRole("button", { name: "跳过预测", exact: true }).click();
  const before = await page.evaluate(
    (storageKey) => localStorage.getItem(storageKey),
    key,
  );
  await page
    .getByRole("spinbutton", { name: "消费 C", exact: true })
    .fill("90");
  await expect(page.getByRole("alert")).toContainText("生产与最终使用不一致");
  expect(
    await page.evaluate((storageKey) => localStorage.getItem(storageKey), key),
  ).toBe(before);
  await page
    .getByRole("spinbutton", { name: "进口 M", exact: true })
    .fill("50");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  const summary = page.getByTestId("la09-summary");
  await expect(summary.getByRole("row", { name: /经常账户 CA/ })).toContainText(
    "-32",
  );
  await expect(
    page.getByRole("spinbutton", { name: "进口 M", exact: true }),
  ).toHaveAccessibleDescription(/计入.*C.*I.*G/);
});

test("a long experiment table scrolls by keyboard within the mobile page and keeps numeric alternatives", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/lab/LA04");
  await page.getByRole("button", { name: "跳过预测", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "推演期数", exact: true })
    .fill("100");
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  const table = page.getByTestId("la04-results");
  const scroll = table.locator("..");
  await expect(scroll).toHaveAttribute("role", "region");
  await expect(scroll).toHaveAccessibleName(/B.*表格滚动区域/);
  await expect(table.locator("tbody tr")).toHaveCount(101);
  await scroll.focus();
  await expect(scroll).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  expect(
    await table
      .locator("thead th")
      .first()
      .evaluate((element) => getComputedStyle(element).position),
  ).toBe("sticky");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});
