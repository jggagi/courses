import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const STORAGE_KEY = "courses:macroeconomics:v1";
const MICRO_KEY = "courses:microeconomics:v1";
const screenshotDirectory = fileURLToPath(
  new URL("../screenshots/", import.meta.url),
);
const networkByPage = new WeakMap<Page, string[]>();
const errorsByPage = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const externalRequests: string[] = [];
  const runtimeErrors: string[] = [];
  networkByPage.set(page, externalRequests);
  errorsByPage.set(page, runtimeErrors);
  // Observe real browser traffic. A reference link must not fetch in the background.
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      ["http:", "https:"].includes(url.protocol) &&
      url.origin !== "http://127.0.0.1:5174"
    )
      externalRequests.push(request.url());
  });
  page.on("websocket", (socket) => {
    if (new URL(socket.url()).host !== "127.0.0.1:5174")
      externalRequests.push(socket.url());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(
    networkByPage.get(page),
    "The app must make no external runtime requests",
  ).toEqual([]);
  expect(
    errorsByPage.get(page),
    "The browser must not encounter uncaught application errors",
  ).toEqual([]);
});

async function openLab(page: Page, id: "LA01" | "LA02" | "LA03") {
  await page.goto(`/#/lab/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(id);
}

async function runWithPrediction(
  page: Page,
  prediction = "教学测试：先记录预测，再核对模型条件。",
) {
  await page.getByLabel("实验预测与理由").fill(prediction);
  await page.getByRole("button", { name: "保存实验预测", exact: true }).click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
}

async function ledgerRow(
  page: Page,
  label: string,
  end: string,
  baseline?: string,
) {
  const row = page
    .getByTestId("ledger-results")
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) });
  await expect(row.getByRole("cell").nth(2)).toHaveText(end);
  if (baseline !== undefined)
    await expect(row.getByRole("cell").nth(3)).toHaveText(baseline);
}

async function accountsRow(
  page: Page,
  label: string,
  result: string,
  baseline = "100",
) {
  const row = page
    .getByTestId("accounts-results")
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) });
  await expect(row.getByRole("cell").nth(0)).toHaveText(baseline);
  await expect(row.getByRole("cell").nth(1)).toHaveText(result);
}

async function allGDP(page: Page, result: string, baseline = "100") {
  for (const method of ["生产法 GDP", "支出法 GDP", "收入法 GDP"])
    await accountsRow(page, method, result, baseline);
}

async function classifyActivities(page: Page) {
  const controls = page.locator('select[aria-label$=" 分类"]');
  for (const control of await controls.all()) {
    const label = (await control.getAttribute("aria-label")) || "";
    const category = /进口/.test(label)
      ? "import"
      : /前期/.test(label)
        ? "previous"
        : /转移/.test(label)
          ? "transfer"
          : /股票|二手/.test(label)
            ? "financial"
            : /机器/.test(label)
              ? "capital"
              : /未售/.test(label)
                ? "inventory"
                : /原料商|加工商/.test(label)
                  ? "intermediate"
                  : "current";
    await control.selectOption(category);
  }
}

async function runAccounts(page: Page) {
  await classifyActivities(page);
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(page.getByTestId("accounts-results")).toBeVisible();
}

async function screenshot(page: Page, name: string) {
  await mkdir(screenshotDirectory, { recursive: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: `${screenshotDirectory}/${name}`,
    fullPage: true,
  });
}

async function expectNoPageOverflow(page: Page) {
  const measurements = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(measurements.document).toBeLessThanOrEqual(measurements.viewport + 1);
  expect(measurements.body).toBeLessThanOrEqual(measurements.viewport + 1);
}

test("six complete lessons record predictions, separate objective attempts and rubric self-checks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".planned-list p")).toHaveCount(0);
  await expect(page.locator(".planned-list a")).toHaveCount(0);
  await page.getByRole("link", { name: "从 A01-A 开始", exact: true }).click();
  const lessons = [
    ["A01-A", "110", 1],
    ["A01-B", "10", 2],
    ["A02-A", "100", 1],
    ["A02-B", "20", 2],
    ["A03-A", "44", 1],
    ["A03-B", "140.25", 1],
  ] as const;
  for (const [id, numericAnswer, correctChoice] of lessons) {
    if (id !== "A01-A")
      await page
        .getByRole("navigation", { name: "课程目录" })
        .getByRole("link")
        .filter({ hasText: id })
        .click();
    await expect(page).toHaveURL(new RegExp(`#/lesson/${id}$`));
    await expect(page.locator(".lesson-body section")).not.toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "走一遍具体例子", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "反例与边界", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("我的开场预测", { exact: true })
      .fill(`${id}：我先辨认对象、时期、单位，再比较。`);
    await page
      .getByRole("button", { name: "保存开场预测", exact: true })
      .click();
    const explanation = page.getByTestId(`check-${id}-explain`);
    await explanation
      .getByLabel(`${id}-explain 我的解释`, { exact: true })
      .fill("先写对象与条件；核算恒等式不自动给出行为机制。");
    await explanation.getByText("参考解释与自评标准", { exact: true }).click();
    await expect(explanation.locator("details ul li")).toHaveCount(3);
    await explanation.getByRole("checkbox").check();
    const transfer = page.getByTestId(`check-${id}-transfer`);
    await transfer
      .getByLabel(`${id}-transfer 我的解释`, { exact: true })
      .fill("改变时期或假设时，应重新检查结论的适用边界。");
    await transfer.getByText("参考解释与自评标准", { exact: true }).click();
    await expect(transfer.locator("details ul li")).toHaveCount(3);
    await transfer.getByRole("checkbox").check();
    const numeric = page.getByTestId(`check-${id}-number`);
    await numeric.getByRole("spinbutton").fill("-999");
    await numeric.getByRole("button", { name: "提交检查" }).click();
    await expect(numeric.getByText(/请重算/)).toBeVisible();
    await numeric.getByRole("spinbutton").fill(numericAnswer);
    await numeric.getByRole("button", { name: "提交检查" }).click();
    await expect(numeric.getByText(/数值核对正确/)).toBeVisible();
    const choice = page.getByTestId(`check-${id}-choice`);
    await choice.getByRole("radio").nth(0).check();
    await choice.getByRole("button", { name: "提交检查" }).click();
    await expect(choice.locator("[aria-live]")).not.toHaveText("");
    await expect(choice.locator("[aria-live]")).not.toHaveText("错误");
    await choice.getByRole("radio").nth(correctChoice).check();
    await choice.getByRole("button", { name: "提交检查" }).click();
    await expect(choice.locator("[aria-live]")).toContainText("对");
    const card = page.getByLabel(`${id.slice(0, 3)} 模型卡 研究对象`, {
      exact: true,
    });
    if (!(await card.isVisible()))
      await page
        .getByText(`${id.slice(0, 3)} 模型卡 · 不看原文，重建一次`, {
          exact: true,
        })
        .click();
    await card.fill("记录模型的对象与边界。");
  }
  await page
    .getByRole("link", { name: "个人记录与导入 / 导出", exact: true })
    .click();
  for (const [id] of lessons) {
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: id, exact: true }) });
    await expect(row.getByRole("cell").nth(1)).toHaveText("4");
    await expect(row.getByRole("cell").nth(2)).toHaveText("2");
  }
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
  expect(state.objectiveAttempts).toHaveLength(24);
  expect(Object.values(state.selfChecks).filter(Boolean)).toHaveLength(12);
  for (const [id] of lessons)
    expect(state.notes[`prediction:${id}`]).toContain(id);
});

test("LA01 replays wage 20, service 10 and repayment 5, freezes A and undoes correctly", async ({
  page,
}) => {
  await openLab(page, "LA01");
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("预测");
  await page
    .getByLabel("实验预测与理由")
    .fill("工资和消费不改总存款，本金偿还减少5。");
  await page.getByRole("button", { name: "保存实验预测", exact: true }).click();
  await page
    .getByRole("button", { name: "执行默认三步（20 / 10 / 5）", exact: true })
    .click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await ledgerRow(page, "H 存款资产", "110", "100");
  await ledgerRow(page, "H 净值", "110");
  await ledgerRow(page, "F 存款资产", "25", "40");
  await ledgerRow(page, "F 贷款负债", "15", "20");
  await ledgerRow(page, "F 净值", "10");
  await ledgerRow(page, "B 存款负债总额", "135", "140");
  await ledgerRow(page, "B 权益", "40", "40");
  const stepThree = page
    .getByTestId("ledger-results")
    .getByRole("row")
    .filter({
      has: page.getByRole("rowheader", { name: "第3步", exact: true }),
    });
  await expect(stepThree).toContainText("175＝135＋40");
  await page
    .getByRole("button", { name: "设 A 为当前情景", exact: true })
    .click();
  await page.getByRole("button", { name: "撤销最后事件", exact: true }).click();
  await ledgerRow(page, "F 存款资产", "30", "25");
  await ledgerRow(page, "F 贷款负债", "20", "15");
  await ledgerRow(page, "B 存款负债总额", "140", "135");
  await ledgerRow(page, "B 权益", "40");
  await page
    .getByRole("combobox", { name: "交易类型", exact: true })
    .selectOption("repayment");
  await page.getByLabel("事件金额", { exact: true }).fill("21");
  await page.getByRole("button", { name: "添加事件", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/贷款|本金/);
  await expect(page.locator("ol li")).toHaveCount(2);
  await page
    .getByRole("textbox", { name: "实验解释", exact: true })
    .fill("撤销按剩余事件重放，不修改已冻结的 A。");
  await page.getByRole("button", { name: "重置实验", exact: true }).click();
  await expect(page.getByLabel("实验预测与理由")).toHaveValue(
    "工资和消费不改总存款，本金偿还减少5。",
  );
  await expect(page.locator("ol li")).toHaveCount(0);
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(page.getByLabel("实验解释")).toHaveValue(
    "撤销按剩余事件重放，不修改已冻结的 A。",
  );
});

test("LA02 classifies production, inventory, imports, machines, old assets and transfers with three consistent methods", async ({
  page,
}) => {
  await openLab(page, "LA02");
  await page.getByRole("button", { name: "跳过预测", exact: true }).click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("分类");
  await runAccounts(page);
  await allGDP(page, "100");
  await page.getByLabel("本期未售存货", { exact: true }).fill("20");
  await runAccounts(page);
  await allGDP(page, "100");
  await accountsRow(page, "C 消费", "80");
  await accountsRow(page, "I 资本形成与净存货变化", "20", "0");
  await page.getByLabel("本期未售存货", { exact: true }).fill("10");
  await page.getByLabel("出口", { exact: true }).fill("20");
  await runAccounts(page);
  await accountsRow(page, "C 消费", "70");
  await accountsRow(page, "X 出口", "20", "0");
  await page.getByRole("button", { name: "重置实验", exact: true }).click();
  await page.getByLabel("进口", { exact: true }).fill("30");
  // A plausible wrong classification produces an explanation, without blocking experimentation.
  for (const select of await page.locator('select[aria-label$=" 分类"]').all())
    await select.selectOption("current");
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(page.getByTestId("accounts-results")).toContainText(
    "请修正：进口消费：C 与 M 同增",
  );
  await allGDP(page, "100");
  await accountsRow(page, "C 消费", "130");
  await accountsRow(page, "M 进口（扣除项）", "30", "0");
  await page.getByRole("checkbox", { name: "机器生产", exact: true }).check();
  await runAccounts(page);
  await allGDP(page, "140");
  await accountsRow(page, "I 资本形成与净存货变化", "40", "0");
  for (const name of [
    "政府转移 10",
    "购买已有股票 50",
    "二手商品转卖 20（无服务费）",
  ])
    await page.getByRole("checkbox", { name, exact: true }).check();
  await runAccounts(page);
  await allGDP(page, "140");
  await expect(page.getByTestId("accounts-results")).toContainText("分类一致");
  await expect(page.getByTestId("accounts-results")).toContainText(
    "股票是金融权利转手",
  );
  await expect(page.getByTestId("accounts-results")).toContainText(
    "转移本身没有新生产",
  );
  await page.getByRole("button", { name: "重置实验", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "销售前期存货 20", exact: true })
    .check();
  await runAccounts(page);
  await allGDP(page, "100");
  await accountsRow(page, "C 消费", "120");
  await accountsRow(page, "I 资本形成与净存货变化", "-20", "0");
  const sourceLink = page
    .getByTestId("accounts-results")
    .locator('a[href^="#activity-"]')
    .first();
  const target = await sourceLink.getAttribute("href");
  await sourceLink.click();
  await expect(page.locator(target!)).toBeInViewport();
  await expect(page).toHaveURL(/#\/lab\/LA02$/);
});

test("LA03 derives its oracle from p/q, compares presets, normalizes and handles undefined and invalid inputs", async ({
  page,
}) => {
  await openLab(page, "LA03");
  await runWithPrediction(page);
  const row0 = page.getByTestId("price-row-0").getByRole("cell");
  const row1 = page.getByTestId("price-row-1").getByRole("cell");
  const row2 = page.getByTestId("price-row-2").getByRole("cell");
  await expect(row0).toHaveText([
    "40",
    "40",
    "100",
    "100",
    "未定义",
    "未定义",
    "未定义",
    "未定义",
  ]);
  await expect(row1).toHaveText([
    "61",
    "44",
    "138.636364",
    "137.5",
    "52.5%",
    "10%",
    "38.636364%",
    "37.5%",
  ]);
  await expect(row2).toHaveText([
    "62.22",
    "44",
    "141.409091",
    "140.25",
    "2%",
    "0%",
    "2%",
    "2%",
  ]);
  await page
    .getByRole("combobox", { name: "指数显示刻度", exact: true })
    .selectOption("1000");
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(row2.nth(3)).toHaveText("1402.5");
  await expect(row2.nth(7)).toHaveText("2%");
  await page.getByRole("button", { name: "预设：只涨价", exact: true }).click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(row1.nth(1)).toHaveText("40");
  await expect(row1.nth(5)).toHaveText("0%");
  await page.getByRole("button", { name: "预设：只增产", exact: true }).click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(row1.nth(0)).toHaveText((await row1.nth(1).textContent()) || "");
  await expect(row1.nth(2)).toHaveText("100");
  await page
    .getByRole("button", { name: "预设：改变组合", exact: true })
    .click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(page.getByTestId("price-results")).toBeVisible();
  await page
    .getByRole("combobox", { name: "实际产出的价格权重基期", exact: true })
    .selectOption("1");
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(page.getByTestId("price-results")).toContainText(
    "A 与 B 的权重基期不同",
  );
  await page
    .getByRole("button", { name: "预设：通胀放缓但价格继续上升", exact: true })
    .click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await page.getByRole("radio", { name: "增长／通胀", exact: true }).check();
  await expect(page.getByTestId("price-results").getByRole("img")).toHaveCount(
    4,
  );
  await expect(
    page
      .getByTestId("price-results")
      .getByText("N／R／D／L 四个分离指标的数字替代表：A/B 水平与同指标同比", {
        exact: true,
      }),
  ).toBeVisible();
  await page.getByLabel("第0期 x数量", { exact: true }).fill("0");
  await page.getByLabel("第0期 y数量", { exact: true }).fill("0");
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(row0).toHaveText([
    "0",
    "0",
    "未定义",
    "未定义",
    "未定义",
    "未定义",
    "未定义",
    "未定义",
  ]);
  await expect(row1.nth(3)).toHaveText("未定义");
  await expect(row1.nth(4)).toHaveText("未定义");
  await page.getByRole("button", { name: "重置实验", exact: true }).click();
  await page.getByLabel("第0期 x价格", { exact: true }).fill("-1");
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("大于0");
  await expect(page.getByTestId("price-results")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/NaN|Infinity/);
  await screenshot(page, "error-la03.png");
});

test("notes, predictions and raw events survive deep-link refresh and a real JSON download / clear / import roundtrip", async ({
  page,
}, testInfo) => {
  await page.goto("/#/lesson/A01-A");
  const maliciousText =
    '<script>window.__courseScriptRan = true</script><img src=x onerror="window.__courseScriptRan = true">';
  await page.getByLabel("学习笔记", { exact: true }).fill(maliciousText);
  await page
    .getByLabel("我的开场预测", { exact: true })
    .fill("预测需要明确本期的工资和消费。");
  await page.getByRole("button", { name: "保存开场预测", exact: true }).click();
  await page.evaluate(
    (key) => localStorage.setItem(key, "micro-course-must-survive"),
    MICRO_KEY,
  );
  await page
    .getByRole("navigation", { name: "实验目录" })
    .getByRole("link", { name: /LA01/ })
    .click();
  await page.getByLabel("实验预测与理由").fill("本金偿还减少5的总存款。");
  await page.getByRole("button", { name: "保存实验预测", exact: true }).click();
  await page
    .getByRole("button", { name: "执行默认三步（20 / 10 / 5）", exact: true })
    .click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await page
    .getByRole("textbox", { name: "实验解释", exact: true })
    .fill("结果135来自偿还本金，不是工资烧掉存款。");
  await page.reload();
  await expect(page).toHaveURL(/#\/lab\/LA01$/);
  await ledgerRow(page, "B 存款负债总额", "135");
  await expect(page.getByLabel("实验预测与理由")).toHaveValue(
    "本金偿还减少5的总存款。",
  );
  await expect(page.getByLabel("实验解释")).toHaveValue(
    "结果135来自偿还本金，不是工资烧掉存款。",
  );
  await page.goto("/#/lesson/A01-A");
  await page.reload();
  await expect(page.getByLabel("学习笔记", { exact: true })).toHaveValue(
    maliciousText,
  );
  await expect(page.getByLabel("我的开场预测")).toHaveValue(
    "预测需要明确本期的工资和消费。",
  );
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __courseScriptRan?: boolean }).__courseScriptRan,
    ),
  ).toBeUndefined();
  await expect(page.locator('main script, main img[src="x"]')).toHaveCount(0);
  await page
    .getByRole("link", { name: "个人记录与导入 / 导出", exact: true })
    .click();
  await expect(
    page.getByText("导出的 JSON 含私人笔记，请保管好，不要提交公开仓库。", {
      exact: true,
    }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出本课 JSON", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "macroeconomics-private-learning.json",
  );
  const file = testInfo.outputPath("private-roundtrip.json");
  await download.saveAs(file);
  const raw = await readFile(file, "utf8");
  const exported = JSON.parse(raw);
  expect(exported.notes["note:A01-A"]).toBe(maliciousText);
  expect(
    exported.labStates.LA01.input.events.map(
      (event: { amount: number }) => event.amount,
    ),
  ).toEqual([20, 10, 5]);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "清空本课全部记录", exact: true })
    .click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).notes["note:A01-A"],
      STORAGE_KEY,
    ),
  ).toBe(maliciousText);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "清空本课全部记录", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("已清空");
  const cleared = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
  expect(cleared.notes).toEqual({});
  expect(cleared.labStates.LA01.input.events).toEqual([]);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), MICRO_KEY),
  ).toBe("micro-course-must-survive");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("导入本课 JSON", { exact: true }).setInputFiles(file);
  await expect(page.getByRole("status")).toContainText("导入成功");
  const restored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
  for (const key of [
    "notes",
    "lessonStates",
    "objectiveAttempts",
    "selfChecks",
    "labStates",
    "lastLessonId",
  ])
    expect(restored[key]).toEqual(exported[key]);
  await page
    .getByLabel("导入本课 JSON", { exact: true })
    .setInputFiles({
      name: "micro.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ ...exported, courseId: "microeconomics" }),
      ),
    });
  await expect(page.getByRole("status")).toContainText("课程不匹配");
  await page
    .getByLabel("导入本课 JSON", { exact: true })
    .setInputFiles({
      name: "illegal-event.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          ...exported,
          labStates: {
            ...exported.labStates,
            LA01: {
              ...exported.labStates.LA01,
              input: {
                ...exported.labStates.LA01.input,
                events: [
                  { id: "bad", sequence: 1, type: "telemetry", amount: 20 },
                ],
              },
            },
          },
        }),
      ),
    });
  await expect(page.getByRole("status")).toContainText("非法事件类型");
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).labStates,
      STORAGE_KEY,
    ),
  ).toEqual(exported.labStates);
  await page.goto("/#/lesson/A01-A");
  await expect(page.getByLabel("学习笔记", { exact: true })).toHaveValue(
    maliciousText,
  );
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __courseScriptRan?: boolean }).__courseScriptRan,
    ),
  ).toBeUndefined();
});

for (const [label, original] of [
  ["damaged JSON", "{bad-json"],
  [
    "unknown schema",
    JSON.stringify({ courseId: "macroeconomics", schemaVersion: 99 }),
  ],
] as const) {
  test(`protects ${label} without silently overwriting the original`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript(
      ({ key, value, micro }) => {
        localStorage.setItem(key, value);
        localStorage.setItem(micro, "protected-micro-record");
      },
      { key: STORAGE_KEY, value: original, micro: MICRO_KEY },
    );
    await page.goto("/#/lesson/A01-A");
    await expect(page.getByRole("alert")).toContainText("原始记录已保护");
    await page
      .getByLabel("学习笔记", { exact: true })
      .fill("当前编辑只能留在内存中。");
    expect(
      await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
    ).toBe(original);
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "下载原始记录", exact: true })
      .click();
    const download = await downloadPromise;
    const file = testInfo.outputPath("damaged-record.json");
    await download.saveAs(file);
    expect(await readFile(file, "utf8")).toBe(original);
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "放弃损坏记录并恢复保存", exact: true })
      .click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).courseId,
        STORAGE_KEY,
      ),
    ).toBe("macroeconomics");
    expect(
      await page.evaluate((key) => localStorage.getItem(key), MICRO_KEY),
    ).toBe("protected-micro-record");
  });
}

test("unavailable localStorage leaves a usable memory session with an explicit warning", async ({
  page,
}) => {
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"])
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() {
          throw new DOMException("Storage disabled for test", "SecurityError");
        },
      });
  });
  await page.goto("/#/lesson/A01-A");
  await expect(page.getByRole("alert")).toContainText("内存");
  await page
    .getByLabel("学习笔记", { exact: true })
    .fill("内存模式仍能学习与导出。");
  await page.getByLabel("我的开场预测").fill("先记录时期。");
  await page.getByRole("button", { name: "保存开场预测", exact: true }).click();
  await page
    .getByRole("navigation", { name: "实验目录" })
    .getByRole("link", { name: /LA01/ })
    .click();
  await page.getByRole("button", { name: "跳过预测", exact: true }).click();
  await page
    .getByRole("button", { name: "执行默认三步（20 / 10 / 5）", exact: true })
    .click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await ledgerRow(page, "B 存款负债总额", "135");
  await page
    .getByRole("navigation", { name: "课程目录" })
    .getByRole("link")
    .filter({ hasText: "A01-A" })
    .click();
  await expect(page.getByLabel("学习笔记", { exact: true })).toHaveValue(
    "内存模式仍能学习与导出。",
  );
  await expect(page.getByLabel("我的开场预测")).toHaveValue("先记录时期。");
  await page
    .getByRole("link", { name: "个人记录与导入 / 导出", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出本课 JSON", exact: true })
    .click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.notes["note:A01-A"]).toBe("内存模式仍能学习与导出。");
});

async function keyboardActivate(locator: Locator) {
  await locator.focus();
  await expect(locator).toBeFocused();
  await locator.press("Enter");
}

test("the lesson and the full LA01 event trajectory work with keyboard input and focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "跳到学习正文", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await keyboardActivate(
    page.getByRole("link", { name: "从 A01-A 开始", exact: true }),
  );
  const prediction = page.getByLabel("我的开场预测", { exact: true });
  await prediction.focus();
  await prediction.pressSequentially("A flow needs a defined period.");
  await prediction.press("Tab");
  await expect(
    page.getByRole("button", { name: "保存开场预测", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const explanation = page.getByTestId("check-A01-A-explain");
  await keyboardActivate(explanation.locator("summary"));
  await expect(explanation.locator("details")).toHaveAttribute("open", "");
  await explanation.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  await expect(explanation.getByRole("checkbox")).toBeChecked();
  await keyboardActivate(
    page.getByRole("link", { name: "打开 LA01，先预测再实验", exact: true }),
  );
  const labPrediction = page.getByRole("textbox", {
    name: "实验预测与理由",
    exact: true,
  });
  await labPrediction.focus();
  await labPrediction.pressSequentially(
    "Total deposits fall only on repayment.",
  );
  await labPrediction.press("Tab");
  await expect(
    page.getByRole("button", { name: "保存实验预测", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const eventType = page.getByRole("combobox", {
    name: "交易类型",
    exact: true,
  });
  const amount = page.getByLabel("事件金额", { exact: true });
  for (const [downCount, number] of [
    [0, "20"],
    [1, "10"],
    [2, "5"],
  ] as const) {
    await eventType.focus();
    await eventType.press("Home");
    for (let down = 0; down < downCount; down++)
      await eventType.press("ArrowDown");
    await eventType.press("Tab");
    await expect(amount).toBeFocused();
    await amount.press("ControlOrMeta+A");
    await amount.pressSequentially(number);
    await amount.press("Tab");
    await expect(
      page.getByRole("button", { name: "添加事件", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
  }
  await keyboardActivate(
    page.getByRole("button", { name: "运行实验", exact: true }),
  );
  await ledgerRow(page, "B 存款负债总额", "135");
  await keyboardActivate(
    page.getByRole("button", { name: "撤销最后事件", exact: true }),
  );
  await ledgerRow(page, "B 存款负债总额", "140");
});

test("390px mobile and 1440px desktop keep the page within the viewport with scrollable tables and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLab(page, "LA01");
  await page.getByRole("button", { name: "跳过预测", exact: true }).click();
  await page
    .getByRole("button", { name: "执行默认三步（20 / 10 / 5）", exact: true })
    .click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expectNoPageOverflow(page);
  const scrollTable = page.getByLabel("三部门账表，可横向滚动", {
    exact: true,
  });
  expect(
    await scrollTable.evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
      overflow: getComputedStyle(element).overflowX,
    })),
  ).toMatchObject({ overflow: "auto" });
  expect(
    await scrollTable.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  await scrollTable.focus();
  await expect(scrollTable).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => scrollTable.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  await screenshot(page, "mobile-la01.png");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openLab(page, "LA03");
  await page.getByRole("button", { name: "跳过预测", exact: true }).click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await expectNoPageOverflow(page);
  const charts = page.getByTestId("price-results").getByRole("img");
  await expect(charts).toHaveCount(4);
  for (const chart of await charts.all())
    expect(await chart.getAttribute("aria-label")).toBeTruthy();
  await expect(
    page.getByTestId("price-row-2").getByRole("cell").nth(3),
  ).toHaveText("140.25");
  expect(
    await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  expect(
    await page
      .getByRole("button", { name: "运行实验", exact: true })
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  expect(
    await page
      .locator("html")
      .evaluate((element) => getComputedStyle(element).scrollBehavior),
  ).toBe("auto");
  await screenshot(page, "desktop-la03.png");
  await page.goto("/#/sources");
  await expect(page.getByRole("link", { name: /MAC-BEA ·/ })).toHaveAttribute(
    "target",
    "_blank",
  );
  await expectNoPageOverflow(page);
});
