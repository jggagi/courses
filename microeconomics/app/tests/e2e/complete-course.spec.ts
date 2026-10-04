import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createInitialState, STORAGE_KEY } from "../../src/persistence/store";

const artifacts = path.resolve(import.meta.dirname, "../../../artifacts");
async function labAt(page: Page, lesson: string, id: string) {
  await page.goto(`/#/lesson/${lesson}`);
  return page.getByTestId(id);
}
async function run(lab: Locator) {
  await lab.getByRole("button", { name: "跳过预测并运行", exact: true }).click();
}
async function change(lab: Locator, key: string, value: number) {
  await lab.getByTestId(`input-B-${key}`).fill(String(value));
}
async function metric(lab: Locator, key: string, value: string) {
  await expect(lab.getByTestId(`advanced-B-${key}`)).toHaveText(value);
}
async function state(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}

test("ML04 固定成本、短期供给和市场数量真实联动", async ({ page }) => {
  const lab = await labAt(page, "M04-B", "ML04");
  await expect(lab.getByTestId("results-ML04")).toHaveCount(0);
  await expect(lab.getByRole("button", { name: "运行实验", exact: true })).toBeDisabled();
  await lab.getByLabel("ML04 实验预测").fill("提高价格增加边际收入，固定成本只改变利润。");
  await lab.getByRole("button", { name: "保存预测", exact: true }).click();
  await lab.getByRole("button", { name: "运行实验", exact: true }).click();
  await metric(lab, "q", "6");
  await metric(lab, "profit", "-2");
  await change(lab, "p", 9);
  await expect(lab.getByTestId("results-ML04")).toHaveCount(0);
  await run(lab);
  await metric(lab, "q", "7");
  await metric(lab, "profit", "4.5");
  await change(lab, "F", 100);
  await run(lab);
  await metric(lab, "q", "7");
  await metric(lab, "profit", "-75.5");
  await lab.getByLabel("ML04 实验解释").fill("负利润仍可能优于承担全部固定成本的停产。");
  await page.reload();
  await metric(lab, "profit", "-75.5");
  await expect(lab.getByLabel("ML04 实验解释")).toHaveValue("负利润仍可能优于承担全部固定成本的停产。");
  await lab.getByRole("button", { name: "重置实验", exact: true }).click();
  await expect(lab.getByLabel("ML04 实验预测")).toHaveValue("");
});

test("ML05 税楔对账、法定征收方与无交易边界", async ({ page }) => {
  const lab = await labAt(page, "M06-B", "ML05");
  await change(lab, "tau", 20); await run(lab);
  for (const [key, value] of Object.entries({ q: "30", buyerPrice: "70", sellerPrice: "50", taxRevenue: "600", cs: "450", ps: "450", dwl: "100" })) await metric(lab, key, value);
  if (await lab.getByTestId("input-B-legalPayer").count()) {
    await change(lab, "legalPayer", 1); await run(lab); await metric(lab, "taxRevenue", "600");
  }
  await change(lab, "tau", 80); await run(lab);
  await metric(lab, "q", "0"); await metric(lab, "taxRevenue", "0"); await metric(lab, "dwl", "1600");
  await expect(lab.getByTestId("advanced-B-buyerPrice")).not.toHaveText(/^\d/);
  await expect(lab).not.toContainText(/NaN|Infinity/);
});

test("ML06 垄断解与独立网络机制辨析", async ({ page }) => {
  const lab = await labAt(page, "M07-A", "ML06");
  await run(lab); await metric(lab, "monopolyQ", "40"); await metric(lab, "monopolyPrice", "60");
  await change(lab, "F", 100); await run(lab); await metric(lab, "monopolyQ", "40");
  const network = lab.getByLabel("网络效应情景");
  await network.selectOption({ label: "更多用户但不可互通" });
  await lab.getByRole("button", { name: "将观察加入实验解释" }).click();
  await expect(lab.getByLabel("ML06 实验解释")).toHaveValue(/不可互通/);
});

test("ML07 枚举多均衡、无纯均衡和全部并列", async ({ page }) => {
  const lab = await labAt(page, "M08-A", "ML07");
  await run(lab); await metric(lab, "equilibriumCount", "1");
  const setMatrix = async (values: number[]) => {
    for (const [index, key] of ["r00", "c00", "r01", "c01", "r10", "c10", "r11", "c11"].entries()) await change(lab, key, values[index]);
    await run(lab);
  };
  await setMatrix([2, 2, 0, 0, 0, 0, 1, 1]); await metric(lab, "equilibriumCount", "2");
  await setMatrix([1, -1, -1, 1, -1, 1, 1, -1]); await metric(lab, "equilibriumCount", "0");
  await expect(lab).toContainText(/混合策略/);
  await setMatrix([1, 1, 1, 1, 1, 1, 1, 1]); await metric(lab, "equilibriumCount", "4");
});

test("ML08 社会成本、纠正税与退化无损害情景", async ({ page }) => {
  const lab = await labAt(page, "M09-A", "ML08");
  await change(lab, "e", 2); await change(lab, "tau", 40); await run(lab);
  for (const [key, value] of Object.entries({ privateQ: "40", socialQ: "20", correctiveTax: "40", policyQ: "20", policyWelfare: "800" })) await metric(lab, key, value);
  await change(lab, "e", 0); await change(lab, "tau", 0); await run(lab);
  await metric(lab, "socialQ", "40"); await metric(lab, "correctiveTax", "0");
});

test("ML09 保留逐轮信念、参与阈值和认证费用", async ({ page }) => {
  const lab = await labAt(page, "M10-B", "ML09");
  await change(lab, "theta", .25); await run(lab);
  await metric(lab, "initialPrice", "6"); await metric(lab, "finalPrice", "4");
  await expect(lab.getByRole("table").first()).toContainText(/参与|信念/);
  await change(lab, "certificationFee", 3); await run(lab);
  await metric(lab, "certifiedHighNet", "1");
});

test("ML10 风险、借款限制与劳动边界都重新计算", async ({ page }) => {
  const lab = await labAt(page, "M11-B", "ML10");
  for (const [key, value] of Object.entries({ wLow: 0, wHigh: 100, probHigh: .5, y1: 20, y2: 180, r: 0, beta: 1, noBorrow: 0 })) await change(lab, key, value);
  await run(lab);
  await metric(lab, "risk-certaintyEquivalent", "25"); await metric(lab, "time-c1", "100");
  await change(lab, "noBorrow", 1); await run(lab); await metric(lab, "time-c1", "20"); await metric(lab, "time-c2", "180");
  await change(lab, "y1", 0); await run(lab);
  await expect(lab.getByTestId("advanced-B-time-c1")).not.toHaveText(/^\d/);
  await expect(lab).toContainText(/对数|正消费/); await expect(lab).not.toContainText(/NaN|Infinity/);
});

test("ML11 贸易守恒、消费边界与非法交易提示", async ({ page }) => {
  const lab = await labAt(page, "M12-A", "ML11");
  await run(lab);
  for (const [key, value] of Object.entries({ opportunityA: "0.5", opportunityB: "1", tradeY: "30", consumeAx: "80", consumeAy: "30", consumeBx: "40", consumeBy: "10" })) await metric(lab, key, value);
  await expect(lab.getByRole("img")).toHaveCount(2);
  await change(lab, "tradeX", 1000);
  await expect(lab.getByRole("alert").first()).toBeVisible();
  await expect(lab.getByTestId("results-ML11")).toHaveCount(0);
});

test("旧版学习记录自动迁移并保存新课、复习与终课作品", async ({ page }) => {
  const current = createInitialState();
  const ids = ["M01-A", "M01-B", "M02-A", "M02-B", "M03-A", "M03-B"];
  const { advancedLabStates: _advanced, capstone: _capstone, reviewQueue: _review, experimentHistory: _history, extensionLabStates: _extensions, capstoneSnapshots: _references, ...legacy } = current;
  const record = { ...legacy, schemaVersion: 1, lastLessonId: "M03-A", notes: { "M03-A": "已有笔记" },
    lessonStates: Object.fromEntries(ids.map((id) => [id, "in_progress"])), conceptConfidence: Object.fromEntries(ids.map((id) => [id, null])) };
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: STORAGE_KEY, value: JSON.stringify(record) });
  await page.goto("/#/lesson/M03-A");
  await expect(page.getByLabel("本节学习笔记")).toHaveValue("已有笔记");
  await page.goto("/#/lesson/M12-B");
  await page.getByLabel("本节学习笔记").fill("区分机制和识别证据。");
  expect((await state(page)).schemaVersion).toBe(3);
  await page.goto("/#/review");
  await page.getByLabel("税楔、剩余与外部性 我的解释").fill("税收是转移，额外损害须另行计入。");
  await page.goto("/#/capstone");
  await page.getByLabel("1 · 对象、问题与价值标准").fill("<script>window.pwned=true</script>虚构商品税负");
  await page.getByLabel("3 · 两次反事实与分配").fill("税20与40；记录两个情景的 A/B 和分配边界。");
  await page.reload();
  await expect(page.getByLabel("1 · 对象、问题与价值标准")).toHaveValue(/虚构商品税负/);
  expect(await page.evaluate(() => (window as Window & { pwned?: boolean }).pwned)).toBeUndefined();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出终课作品文本与实验快照" }).click();
  const report = await downloadPromise;
  expect(await readFile((await report.path())!, "utf8")).toContain("税20与40");
  await page.goto("/#/records");
  const backupPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  const backup = await backupPromise; const json = await readFile((await backup.path())!, "utf8");
  await page.getByRole("button", { name: "清空本课程记录" }).click(); await page.getByRole("button", { name: "确认清空" }).click();
  await page.getByLabel("导入 JSON 文件").setInputFiles({ name: "all-course.json", mimeType: "application/json", buffer: Buffer.from(json) });
  expect((await state(page)).capstone.counterfactuals).toContain("税20与40");
  expect((await state(page)).notes["M03-A"]).toBe("已有笔记");
});

test("完整课程的手机图表、桌面布局和键盘预测可用", async ({ page }) => {
  await mkdir(artifacts, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [lesson, id] of [["M04-B", "ML04"], ["M06-B", "ML05"], ["M08-A", "ML07"], ["M10-B", "ML09"], ["M11-B", "ML10"], ["M12-A", "ML11"]]) {
    const lab = await labAt(page, lesson, id); await run(lab);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator("main").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(lab.getByRole("table").first()).toBeVisible();
  }
  await page.getByTestId("results-ML11").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, "complete-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const lab = await labAt(page, "M06-B", "ML05");
  const prediction = lab.getByLabel("ML05 实验预测");
  await prediction.focus(); await page.keyboard.insertText("税使交易量减少，分配取决于响应。");
  await page.keyboard.press("Tab"); await expect(lab.getByRole("button", { name: "保存预测", exact: true })).toBeFocused();
  await page.keyboard.press("Enter"); await page.keyboard.press("Tab");
  await expect(lab.getByRole("button", { name: "运行实验", exact: true })).toBeFocused(); await page.keyboard.press("Enter");
  await change(lab, "tau", 20); await run(lab);
  await lab.getByTestId("results-ML05").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, "complete-desktop.png") });
  await page.goto("/#/capstone");
  expect(await page.locator("main").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});
