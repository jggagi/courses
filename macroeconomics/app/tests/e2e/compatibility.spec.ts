import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { lessons } from "../../src/content";

const storageKey = "courses:macroeconomics:v1";
const errors = new WeakMap<Page, string[]>();
const externalRequests = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const failures: string[] = [];
  const requests: string[] = [];
  errors.set(page, failures);
  externalRequests.set(page, requests);
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== origin)
      requests.push(request.url());
  });
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page), "No uncaught browser exception").toEqual([]);
  expect(externalRequests.get(page), "Learning and audits stay local").toEqual(
    [],
  );
});

async function state(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  );
}

async function lab(page: Page, id: string) {
  await page.goto(`/#/lab/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(id);
  await page.getByRole("button", { name: "跳过预测", exact: true }).click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
}

async function summary(page: Page, id: string, label: string, value: string) {
  const row = page
    .getByTestId(`${id.toLowerCase()}-summary`)
    .getByRole("row")
    .filter({
      has: page.getByRole("rowheader", { name: label, exact: true }),
    });
  await expect(row.getByRole("cell").nth(1)).toHaveText(value);
}

async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
}

test("all 24 lessons navigate with real content and objective feedback", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const directory = page.getByRole("navigation", {
    name: "课程目录",
    exact: true,
  });
  await expect(directory.getByRole("link")).toHaveCount(24);
  for (const lesson of lessons) {
    await directory.getByRole("link").filter({ hasText: lesson.id }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      lesson.title,
    );
    await expect(page.locator(".lesson-body section")).toHaveCount(7);
    await expect(
      directory.getByRole("link").filter({ hasText: lesson.id }),
    ).toHaveAttribute("aria-current", "page");
  }
  await page.goto("/#/lesson/A01-A");
  await page
    .getByLabel("我的开场预测", { exact: true })
    .fill("教学测试：先统一主体与时期。");
  await page.getByRole("button", { name: "保存开场预测", exact: true }).click();
  const check = lessons
    .find((lesson) => lesson.id === "A01-A")!
    .checks.find((item) => item.kind === "numeric")!;
  const question = page.getByTestId(`check-${check.id}`);
  await question.getByRole("spinbutton").fill(String(check.value));
  await question.getByRole("button", { name: "提交检查", exact: true }).click();
  await expect(question.locator("[aria-live]")).toContainText("数值核对正确");
  await page.reload();
  await expect(page.getByLabel("我的开场预测", { exact: true })).toHaveValue(
    "教学测试：先统一主体与时期。",
  );
  expect((await state(page)).objectiveAttempts.at(-1).correct).toBe(true);
});

test("growth and lagged policy agree with their numeric alternatives and preserve A", async ({
  page,
}) => {
  await lab(page, "LA04");
  await summary(page, "LA04", "稳态 k*", "4");
  await page
    .getByRole("button", { name: "提高储蓄率至40%", exact: true })
    .click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await summary(page, "LA04", "稳态 k*", "16");
  const chart = page.getByRole("img").first();
  await expect(chart).toHaveAccessibleName(/完整数字见下方表格/);
  await expect(page.getByTestId("la04-results")).toBeVisible();
  await lab(page, "LA06");
  await summary(page, "LA06", "第1期通胀", "2.25");
  await page
    .getByRole("button", { name: "设A为当前情景", exact: true })
    .click();
  const baseline = (await state(page)).labStates.LA06.baseline;
  await page.getByRole("button", { name: "成本冲击 +1", exact: true }).click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await summary(page, "LA06", "第1期产出缺口", "0");
  await summary(page, "LA06", "第1期通胀", "3");
  const period2 = page
    .getByTestId("la06-results")
    .getByRole("row")
    .filter({
      has: page.getByRole("rowheader", { name: "2期", exact: true }),
    });
  await expect(period2.getByRole("cell").nth(0)).toHaveText("-0.5");
  expect((await state(page)).labStates.LA06.baseline).toEqual(baseline);
});

test("bank events, debt boundary and external accounts stay valid across browser engines", async ({
  page,
}) => {
  await lab(page, "LA07");
  await page
    .getByRole("button", { name: "运行10/7/3/8示例", exact: true })
    .click();
  await summary(page, "LA07", "系统存款", "187");
  const bankA = page
    .getByTestId("la07-results")
    .getByRole("row")
    .filter({
      has: page.getByRole("rowheader", { name: "A", exact: true }),
    });
  await expect(bankA.getByRole("cell")).toHaveText(["13", "79", "90", "2"]);
  await page
    .getByRole("button", { name: "撤销最后银行事件", exact: true })
    .click();
  await expect(bankA.getByRole("cell")).toHaveText(["13", "87", "90", "10"]);
  await lab(page, "LA08");
  await summary(page, "LA08", "第1期债务率", "62.17647059");
  const valid = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  );
  await page.getByLabel("名义 GDP 增长 g", { exact: true }).fill("-100");
  await expect(page.getByRole("alert")).toContainText(/增长.*(?:大于|高于)/);
  await expect(
    page.getByRole("button", { name: "运行实验", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(valid);
  // Correct the transient invalid draft before changing experiment routes.
  await page.getByLabel("名义 GDP 增长 g", { exact: true }).fill("2");
  await lab(page, "LA09");
  await summary(page, "LA09", "经常账户 CA", "-2");
  await summary(page, "LA09", "外部净资产变化", "2");
  await page
    .getByRole("button", { name: "本币价格每外币7.7", exact: true })
    .click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await summary(page, "LA09", "实际汇率 q", "7.7");
  await summary(page, "LA09", "经常账户 CA", "-2");
});

test("private JSON records survive refresh, explicit export, clearing and validated import", async ({
  page,
}) => {
  await page.goto("/#/lesson/A12-B");
  await page
    .getByLabel("学习笔记", { exact: true })
    .fill("教学测试：证据需要独立验证。");
  await page.reload();
  await expect(page.getByLabel("学习笔记", { exact: true })).toHaveValue(
    "教学测试：证据需要独立验证。",
  );
  await page.goto("/#/records");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出本课 JSON", exact: true })
    .click();
  const download = await pending;
  const saved = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(saved.notes["note:A12-B"]).toBe("教学测试：证据需要独立验证。");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "清空本课全部记录", exact: true })
    .click();
  expect((await state(page)).notes["note:A12-B"]).toBeUndefined();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("导入本课 JSON", { exact: true }).setInputFiles({
    name: "synthetic-compatibility-record.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(page.getByRole("status")).toContainText("导入成功");
  await page.goto("/#/lesson/A12-B");
  await expect(page.getByLabel("学习笔记", { exact: true })).toHaveValue(
    "教学测试：证据需要独立验证。",
  );
});

test("concurrent tabs preserve another tab's saved note and permit exporting the local draft", async ({
  page,
  context,
}) => {
  await page.goto("/#/lesson/A01-A");
  const secondary = await context.newPage();
  const secondaryErrors: string[] = [];
  secondary.on("pageerror", (error) => secondaryErrors.push(error.message));
  await secondary.goto("/#/lesson/A01-A");
  await expect(secondary.getByLabel("学习笔记", { exact: true })).toBeVisible();
  await page
    .getByLabel("学习笔记", { exact: true })
    .fill("教学测试：先打开的页面保存内容A。");
  await secondary
    .getByLabel("学习笔记", { exact: true })
    .fill("教学测试：另一页面的未覆盖草稿B。");
  await expect(secondary.getByRole("alert")).toContainText("其他页面已修改");
  await expect(secondary.getByRole("alert")).toContainText("导出");
  const shared = await state(page);
  expect(shared.notes["note:A01-A"]).toBe("教学测试：先打开的页面保存内容A。");
  await secondary
    .getByRole("link", { name: "个人记录与导入 / 导出", exact: true })
    .click();
  const pending = secondary.waitForEvent("download");
  await secondary
    .getByRole("button", { name: "导出本课 JSON", exact: true })
    .click();
  const download = await pending;
  const draft = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(draft.notes["note:A01-A"]).toBe("教学测试：另一页面的未覆盖草稿B。");
  expect((await state(page)).notes["note:A01-A"]).toBe(
    shared.notes["note:A01-A"],
  );
  expect(secondaryErrors).toEqual([]);
  await secondary.close();
  await page.goto("/#/lesson/%E0%A4%A");
  await expect(page.getByRole("main")).toBeVisible();
  await page.goto("/#/lesson/A01-A");
  await expect(page.getByLabel("学习笔记", { exact: true })).toHaveValue(
    shared.notes["note:A01-A"],
  );
});

test("WCAG axe audits cover reading, experiment output, records and capstone semantics", async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  const findings: { route: string; violations: unknown[] }[] = [];
  for (const route of [
    "home",
    "lesson/A01-A",
    "lesson/A08-B",
    "capstone",
    "review",
    "records",
    "sources",
    "lab/LA03",
    "lab/LA04",
    "lab/LA06",
    "lab/LA07",
    "lab/LA08",
    "lab/LA09",
  ]) {
    await page.goto(`/#/${route}`);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (route.startsWith("lab/")) {
      await page.getByRole("button", { name: "跳过预测", exact: true }).click();
      await page.getByRole("button", { name: "运行实验", exact: true }).click();
    }
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    findings.push({ route, violations: result.violations });
  }
  const auditPath = testInfo.outputPath("local-axe-audit.json");
  await writeFile(auditPath, JSON.stringify(findings, null, 2));
  await testInfo.attach("local-axe-audit.json", {
    path: auditPath,
    contentType: "application/json",
  });
  const summaries = findings.flatMap(({ route, violations }) =>
    violations.map((entry) => {
      const violation = entry as {
        id: string;
        impact: string;
        nodes: unknown[];
      };
      return {
        route,
        rule: violation.id,
        impact: violation.impact,
        affectedNodes: violation.nodes.length,
      };
    }),
  );
  expect(
    summaries,
    "Automated semantic/contrast audit; this is not a screen-reader user test",
  ).toEqual([]);
});

test("390px keyboard flow, named charts, scrollable tables and reduced motion remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "跳到学习正文", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await noOverflow(page);
  const directoryToggle = page.getByRole("button", {
    name: "课程与实验目录",
    exact: true,
  });
  await expect(directoryToggle).toHaveAttribute("aria-expanded", "false");
  await directoryToggle.focus();
  await page.keyboard.press("Enter");
  await expect(directoryToggle).toHaveAttribute("aria-expanded", "true");
  const lessonLink = page
    .getByRole("navigation", { name: "课程目录", exact: true })
    .getByRole("link")
    .filter({ hasText: "A08-B" });
  await lessonLink.focus();
  await lessonLink.press("Enter");
  await expect(directoryToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await page.getByLabel("我的开场预测", { exact: true }).focus();
  await page.keyboard.type(
    "A loan creates a deposit under explicit constraints.",
  );
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "保存开场预测", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await noOverflow(page);
  await lab(page, "LA04");
  const saving = page.getByLabel("储蓄率 s", { exact: true });
  await saving.focus();
  await saving.press("ControlOrMeta+A");
  await saving.pressSequentially("40");
  await page.getByRole("button", { name: "运行实验", exact: true }).focus();
  await page.keyboard.press("Enter");
  await summary(page, "LA04", "稳态 k*", "16");
  const table = page.getByTestId("la04-results").locator("..");
  await table.focus();
  await expect(table).toBeFocused();
  await table.press("ArrowRight");
  await expect
    .poll(() => table.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  for (const chart of await page.getByRole("img").all())
    await expect(chart).toHaveAccessibleName(/完整数字/);
  expect(await page.getByRole("main").ariaSnapshot()).toMatch(/heading "LA04/);
  await noOverflow(page);
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  await page.goto("/#/capstone");
  await expect(
    page.getByLabel("终课报告 发生了什么", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await noOverflow(page);
});
