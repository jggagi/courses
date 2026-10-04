import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  extensionDefaults,
  runExtensionLab,
  type ExtensionLabId,
} from "../../src/models/extensions";
import { STORAGE_KEY, type LearningState } from "../../src/persistence/store";

const artifacts = path.resolve(import.meta.dirname, "../../../artifacts");
const formatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 });

async function openLab(page: Page, id: ExtensionLabId) {
  await page.goto(`/#/extensions/${id}`);
  const region = page.getByTestId(`region${id}`);
  await expect(region).toBeVisible();
  return region;
}
async function storedState(page: Page): Promise<LearningState> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}
async function change(region: Locator, key: string, value: number | string) {
  await region.getByTestId(`extension-B-${key}`).fill(String(value));
}
async function run(region: Locator) {
  await region.getByRole("button", { name: "跳过预测并运行", exact: true }).click();
}
async function savePredictionAndRun(region: Locator, id: ExtensionLabId, prediction: string) {
  await region.getByLabel(`${id} 实验预测`, { exact: true }).fill(prediction);
  await region.getByRole("button", { name: "保存预测", exact: true }).click();
  await region.getByRole("button", { name: "运行实验", exact: true }).click();
}
async function metric(region: Locator, key: string, expected: number | null, side: "A" | "B" = "B") {
  await expect(region.getByTestId(`extension-result-${side}-${key}`)).toHaveText(
    expected === null ? "未定义 / 不适用" : formatter.format(expected),
  );
}
async function matchesKernel(page: Page, region: Locator, id: ExtensionLabId, keys: string[]) {
  const state = await storedState(page);
  for (const side of ["A", "B"] as const) {
    const result = runExtensionLab(id, state.extensionLabStates[id][side === "A" ? "baseline" : "scenario"]);
    for (const key of keys) await metric(region, key, result.metrics[key], side);
  }
}

// Browser checks compare the rendered integration with the exact pure kernel;
// selected independent numeric oracles below also catch an incorrect wiring.
test("MX01 保存预测、A/B 补偿分解、无效草稿、刷新与零预算", async ({ page }) => {
  const region = await openLab(page, "MX01");
  await expect(region.getByTestId("extension-results-MX01")).toHaveCount(0);
  await expect(region.getByRole("button", { name: "运行实验", exact: true })).toBeDisabled();
  await region.getByLabel("MX01 实验预测", { exact: true }).fill("synthetic：涨价降低普通需求，两种补偿中间组合不同。");
  await expect(region.getByRole("button", { name: "运行实验", exact: true })).toBeDisabled();
  await region.getByRole("button", { name: "保存预测", exact: true }).click();
  await region.getByRole("button", { name: "运行实验", exact: true }).click();
  await metric(region, "x1", 10); await metric(region, "slutskyX", 15);
  await metric(region, "hicksX", 10 * Math.sqrt(2)); await metric(region, "totalEffect", -10);
  await matchesKernel(page, region, "MX01", ["slutskyIncome", "hicksIncome", "slutskySubstitution", "slutskyIncomeEffect", "hicksSubstitution", "hicksIncomeEffect"]);
  const initialA = (await storedState(page)).extensionLabStates.MX01.baseline;
  await change(region, "px1", 9);
  await expect(region.getByTestId("extension-results-MX01")).toHaveCount(0);
  await change(region, "px1", "");
  await change(region, "py", 3);
  await expect(region.getByRole("button", { name: "运行实验", exact: true })).toBeDisabled();
  await expect(region.getByTestId("extension-B-px1")).toHaveValue("");
  expect((await storedState(page)).extensionLabStates.MX01.revealed).toBe(false);
  await change(region, "px1", 9); await run(region);
  await metric(region, "x1", 60 / 9); await metric(region, "x1", 10, "A");
  expect((await storedState(page)).extensionLabStates.MX01.baseline).toEqual(initialA);
  await region.getByLabel("MX01 实验解释", { exact: true }).fill("synthetic：保持旧组合可负担不同于保持旧效用。");
  await page.reload();
  await expect(region.getByLabel("MX01 实验解释", { exact: true })).toHaveValue("synthetic：保持旧组合可负担不同于保持旧效用。");
  await metric(region, "x1", 60 / 9);
  await region.getByRole("button", { name: "零预算退化", exact: true }).click(); await run(region);
  await metric(region, "hicksX", 0); await metric(region, "totalEffect", 0);
  await expect(region.getByTestId("extension-results-MX01")).not.toContainText(/NaN|Infinity/);
  await region.getByRole("button", { name: "重置实验", exact: true }).click();
  await expect(region.getByLabel("MX01 实验预测", { exact: true })).toHaveValue("");
  await expect(region.getByLabel("MX01 实验解释", { exact: true })).toHaveValue("");
  expect((await storedState(page)).extensionLabStates.MX01.scenario).toEqual(extensionDefaults("MX01"));
});

test("MX02 固定成本短期作用、整数并列、零 F 与无交易边界", async ({ page }) => {
  const region = await openLab(page, "MX02"); await run(region);
  await metric(region, "shortRunPrice", 8); await metric(region, "shortRunProfit", -2); await metric(region, "integerN", 9);
  await matchesKernel(page, region, "MX02", ["shortRunQ", "shortRunFirmQ", "pLR", "qFirm", "QLR", "nLR", "integerPrice", "incumbentProfit", "entrantProfit"]);
  await expect(region.getByRole("img", { name: /A\/B 共同尺度/ })).toHaveCount(2);
  await region.getByRole("button", { name: "固定成本增加", exact: true }).click(); await run(region);
  await metric(region, "shortRunPrice", 8); await metric(region, "shortRunQ", 60); await metric(region, "shortRunProfit", -42);
  await region.getByRole("button", { name: "整数边界：10 家零利润", exact: true }).click(); await run(region);
  await metric(region, "integerMinN", 9); await metric(region, "integerMaxN", 10);
  await region.getByRole("button", { name: "零固定成本的进入极限", exact: true }).click(); await run(region);
  await metric(region, "nLR", null); await metric(region, "integerN", null);
  await expect(region.getByTestId("extension-results-MX02")).toContainText(/无限进入极限/);
  await change(region, "n", 2.5);
  await expect(region.getByRole("button", { name: "跳过预测并运行", exact: true })).toBeDisabled();
  await expect(region.getByTestId("extension-results-MX02")).toHaveCount(0);
  await change(region, "n", 10);
  await region.getByRole("button", { name: "重置实验", exact: true }).click();
  await region.getByRole("button", { name: "无交易需求", exact: true }).click(); await run(region);
  await metric(region, "shortRunPrice", null); await metric(region, "shortRunQ", 0); await metric(region, "integerN", 0);
  await expect(region.getByTestId("extension-results-MX02")).not.toContainText(/NaN|Infinity/);
});

test("MX03 完整混合支持、连续概率集合与独立重复博弈有效域", async ({ page }) => {
  const region = await openLab(page, "MX03");
  await savePredictionAndRun(region, "MX03", "synthetic：正反面零和没有纯策略解，两人等概率混合。");
  await metric(region, "pureCount", 0); await metric(region, "mixedP", .5); await metric(region, "mixedQ", .5);
  await metric(region, "threshold", .5); await metric(region, "sustainable", 1);
  await matchesKernel(page, region, "MX03", ["mixedCount", "continuumCount", "cooperationValue", "deviationValue"]);
  await expect(region.getByRole("img", { name: /A\/B 共同尺度/ })).toHaveCount(2);
  await change(region, "delta", .25); await run(region);
  await metric(region, "sustainable", 0); await metric(region, "mixedP", .5); await metric(region, "mixedQ", .5);
  await region.getByRole("button", { name: "全部并列：连续均衡", exact: true }).click(); await run(region);
  await metric(region, "pureCount", 4); await metric(region, "mixedCount", null); await metric(region, "continuumCount", 1);
  await expect(region.getByTestId("extension-result-B-equilibrium0")).toHaveText(/p∈\[0,\s*1\].*q∈\[0,\s*1\]/);
  await change(region, "R", 6);
  await expect(region.getByTestId("extension-B-R")).toHaveValue("6");
  await expect(region.getByRole("button", { name: "跳过预测并运行", exact: true })).toBeDisabled();
  await expect(region.getByTestId("extension-results-MX03")).toHaveCount(0);
  await expect(region.getByRole("alert").last()).toContainText(/T.*R.*P.*S/);
  expect((await storedState(page)).extensionLabStates.MX03.scenario.R).toBe(3);
  await change(region, "T", 7);
  await expect(region.getByTestId("extension-B-R")).toHaveValue("6"); await run(region);
  await matchesKernel(page, region, "MX03", ["threshold", "cooperationValue", "deviationValue", "sustainable"]);
  await page.reload();
  await expect(region.getByTestId("extension-B-R")).toHaveValue("6");
  await expect(region.getByTestId("extension-B-T")).toHaveValue("7");
  await expect(region.getByTestId("extension-results-MX03")).not.toContainText(/NaN|Infinity/);
});

test("进阶实验保存两次快照、独立重置、确认恢复与 JSON 往返", async ({ page }) => {
  const region = await openLab(page, "MX01");
  const history = region.getByTestId("history-panel-MX01");
  await history.getByLabel("快照名称", { exact: true }).fill("synthetic · 新价 6");
  await expect(history.getByRole("button", { name: "保存实验快照", exact: true })).toBeDisabled();
  await savePredictionAndRun(region, "MX01", "synthetic：x 涨价，需求下降。");
  await region.getByLabel("MX01 实验解释", { exact: true }).fill("synthetic：Slutsky 与 Hicks 中间组合不同。");
  await history.getByRole("button", { name: "保存实验快照", exact: true }).click();
  await change(region, "px1", 9);
  await savePredictionAndRun(region, "MX01", "synthetic：新价格 9 下普通需求进一步下降。");
  await region.getByLabel("MX01 实验解释", { exact: true }).fill("synthetic：收入与相对价格均需检查。");
  await history.getByLabel("快照名称", { exact: true }).fill("synthetic · 新价 9");
  await history.getByRole("button", { name: "保存实验快照", exact: true }).click();
  const snapshots = (await storedState(page)).experimentHistory;
  expect(snapshots).toHaveLength(2);
  expect(snapshots.map((snapshot) => (snapshot.scenario as Record<string, number>).px1)).toEqual([6, 9]);
  expect(snapshots[0].explanation).toContain("Slutsky");
  await region.getByRole("button", { name: "重置实验", exact: true }).click();
  expect((await storedState(page)).experimentHistory).toHaveLength(2);
  await page.goto("/#/history");
  const first = page.getByTestId(`snapshot-${snapshots[0].id}`);
  await first.getByText("A/B 参数、预测与可复现结果", { exact: true }).click();
  await expect(first.getByRole("table")).toHaveCount(3);
  await expect(first).toContainText("synthetic：Slutsky 与 Hicks 中间组合不同。");
  await first.getByRole("button", { name: "恢复此快照", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "确认恢复实验" });
  await expect(dialog).toBeVisible(); await dialog.getByRole("button", { name: "确认恢复", exact: true }).click();
  await expect(page).toHaveURL(/#\/extensions\/MX01$/);
  await metric(region, "x1", 10);
  await expect(region.getByLabel("MX01 实验解释", { exact: true })).toHaveValue("synthetic：Slutsky 与 Hicks 中间组合不同。");
  await page.goto("/#/records");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  const download = await downloadPromise;
  const json = await readFile((await download.path())!, "utf8");
  expect(JSON.parse(json).experimentHistory).toHaveLength(2);
  await page.getByRole("button", { name: "清空本课程记录", exact: true }).click();
  await page.getByRole("button", { name: "确认清空", exact: true }).click();
  await page.getByLabel("导入 JSON 文件", { exact: true }).setInputFiles({ name: "synthetic-extension-record.json", mimeType: "application/json", buffer: Buffer.from(json) });
  expect((await storedState(page)).experimentHistory).toHaveLength(2);
  await page.goto("/#/extensions/MX01"); await metric(region, "x1", 10);
  await expect(region.getByLabel("MX01 实验解释", { exact: true })).toHaveValue("synthetic：Slutsky 与 Hicks 中间组合不同。");
});

test("三个进阶实验的键盘预测、390px 图表替代与桌面截图", async ({ page }) => {
  await mkdir(artifacts, { recursive: true });
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ["MX01", "MX02", "MX03"] as const) {
    const region = await openLab(page, id);
    await region.getByLabel(`${id} 实验预测`, { exact: true }).focus();
    await page.keyboard.insertText(`synthetic：${id} 比较一个条件变化与模型边界。`);
    await page.keyboard.press("Tab");
    await expect(region.getByRole("button", { name: "保存预测", exact: true })).toBeFocused();
    await page.keyboard.press("Enter"); await page.keyboard.press("Tab");
    await expect(region.getByRole("button", { name: "运行实验", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(region.getByTestId(`extension-results-${id}`)).toBeVisible();
    await expect(region.getByRole("table").filter({ has: page.locator("[data-testid^='extension-result-B-']") }).first()).toBeVisible();
    await region.getByText("展开曲线全部点的替代表格", { exact: true }).first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator("main").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.getByTestId("extension-results-MX03").locator(":scope > h3").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, "learning-extensions-mobile.png"), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const desktop = await openLab(page, "MX01");
  await change(desktop, "px1", 9); await run(desktop);
  await desktop.locator(".extension-plot").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, "learning-extensions-desktop.png"), fullPage: false });
  expect(errors).toEqual([]);
});

test("未知进阶实验深链接提供明确返回入口", async ({ page }) => {
  await page.goto("/#/extensions/MX99");
  await expect(page.getByRole("heading", { name: "找不到这个进阶实验", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "返回三个进阶实验", exact: true }).click();
  await expect(page).toHaveURL(/#\/extensions$/);
  for (const id of ["MX01", "MX02", "MX03"]) await expect(page.getByTestId(`region${id}`)).toBeVisible();
});
