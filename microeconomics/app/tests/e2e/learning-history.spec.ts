import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { STORAGE_KEY, type LearningState } from "../../src/persistence/store";

async function records(page: Page): Promise<LearningState> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}
async function openLab(page: Page, lesson: string, labId: string) {
  await page.goto(`/#/lesson/${lesson}`);
  const lab = page.getByTestId(labId), panel = page.getByTestId(`history-panel-${labId}`);
  await expect(panel).toBeVisible();
  return { lab, panel };
}
async function skipAndRun(lab: Locator) {
  await lab.getByRole("button", { name: "跳过预测并运行", exact: true }).click();
}
async function expectNoPageOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    width: innerWidth, pageWidth: document.documentElement.scrollWidth,
    outside: Array.from(document.querySelectorAll("main *")).map((element) => ({
      tag: element.tagName, class: element.className, right: Math.round(element.getBoundingClientRect().right),
      text: element.textContent?.slice(0, 90),
    })).filter((element) => element.right > innerWidth + 1).slice(0, 12),
  }));
  expect(layout.pageWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width + 1);
}
async function saveSnapshot(page: Page, panel: Locator, label: string, explanation?: string) {
  const count = (await records(page)).experimentHistory.length;
  await panel.getByLabel("快照名称", { exact: true }).fill(label);
  if (explanation !== undefined) await panel.getByLabel("快照解释", { exact: true }).fill(explanation);
  await panel.getByRole("button", { name: "保存实验快照", exact: true }).click();
  await expect.poll(async () => (await records(page)).experimentHistory.length).toBe(count + 1);
  return (await records(page)).experimentHistory.at(-1)!;
}
async function saveTwoTaxSnapshots(page: Page) {
  const { lab, panel } = await openLab(page, "M06-B", "ML05");
  await lab.getByTestId("input-B-tau").fill("10"); await skipAndRun(lab);
  await lab.getByLabel("ML05 实验解释").fill("税从20降至10，交易量增加；税收是转移。只模拟无外部性的竞争市场。");
  const first = await saveSnapshot(page, panel, "税率10的反事实");
  await lab.getByTestId("input-B-tau").fill("30");
  await expect(panel.getByRole("button", { name: "保存实验快照", exact: true })).toBeDisabled();
  await skipAndRun(lab);
  await lab.getByLabel("ML05 实验解释").fill("税从20升至30，交易量降低；法定缴税方不决定经济税负。");
  const second = await saveSnapshot(page, panel, "税率30的反事实");
  return { lab, panel, first, second };
}

test("ML03 未运行不能保存；两个快照保留不同 B，恢复取消及刷新可用", async ({ page }) => {
  const { lab, panel } = await openLab(page, "M03-A", "ML03");
  await panel.getByLabel("快照名称", { exact: true }).fill("尚未运行");
  await expect(panel.getByRole("button", { name: "保存实验快照", exact: true })).toBeDisabled();
  expect((await records(page)).experimentHistory).toHaveLength(0);
  await lab.getByLabel("ML03 实验预测").fill("收入和偏好不变，x涨价会降低最优x；不把总效应只叫替代效应。");
  await lab.getByRole("button", { name: "保存预测并运行", exact: true }).click();
  await lab.getByLabel("x 单价 px（货币 / x）", { exact: true }).fill("6");
  const first = await saveSnapshot(page, panel, "x价格翻倍", "最优x减至10，y维持30是CD固定支出份额的结论。");
  await lab.getByLabel("x 单价 px（货币 / x）", { exact: true }).fill("9");
  const second = await saveSnapshot(page, panel, "x价格三倍", "最优x为20/3；固定收入不能理解为实际购买力不变。");
  await lab.getByLabel("x 单价 px（货币 / x）", { exact: true }).fill("12");
  expect(first.id).not.toBe(second.id);
  const saved = await records(page);
  expect(saved.experimentHistory.map((snapshot) => snapshot.scenario.px)).toEqual([6, 9]);
  expect(saved.labStates.ML03.scenario.px).toBe(12);
  await page.goto("/#/history");
  const card = page.getByTestId(`snapshot-${first.id}`);
  await card.getByText("A/B 参数、预测与可复现结果", { exact: true }).click();
  await expect(card).toContainText("最优 x");
  await expect(card.getByRole("table", { name: "B 反事实 · 由同一实验内核重新计算" })).toContainText("10");
  await card.getByRole("button", { name: "恢复此快照", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "确认恢复实验" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
  expect((await records(page)).labStates.ML03.scenario.px).toBe(12);
  await expect(page).toHaveURL(/#\/history$/);
  await card.getByRole("button", { name: "恢复此快照", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确认恢复", exact: true }).click();
  await expect(page).toHaveURL(/#\/lesson\/M03-A$/);
  await expect(page.getByTestId("ML03").getByLabel("x 单价 px（货币 / x）", { exact: true })).toHaveValue("6");
  await page.reload();
  await expect(page.getByTestId("ML03").getByLabel("x 单价 px（货币 / x）", { exact: true })).toHaveValue("6");
  expect((await records(page)).experimentHistory.map((snapshot) => snapshot.scenario.px)).toEqual([6, 9]);
  expect((await records(page)).experimentHistory[0].explanation).toContain("减至10");
});

test("ML05 保存两次税收反事实，修改当前 B 不覆盖历史，恢复与刷新重算税楔", async ({ page }) => {
  const { lab, panel, first, second } = await saveTwoTaxSnapshots(page);
  await lab.getByTestId("input-B-tau").fill("80"); await skipAndRun(lab);
  await expect(lab.getByTestId("advanced-B-q")).toHaveText("0");
  expect((await records(page)).experimentHistory.map((snapshot) => (snapshot.scenario as Record<string, number>).tau)).toEqual([10, 30]);
  await expect(panel).toContainText("本实验 2 份");
  await page.goto("/#/history");
  await expect(page.getByTestId(`snapshot-${first.id}`)).toContainText("税率10的反事实");
  await expect(page.getByTestId(`snapshot-${second.id}`)).toContainText("税率30的反事实");
  await page.getByTestId(`snapshot-${second.id}`).getByRole("button", { name: "恢复此快照", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确认恢复", exact: true }).click();
  await expect(page).toHaveURL(/#\/lesson\/M06-B$/);
  const restored = page.getByTestId("ML05");
  await expect(restored.getByTestId("input-B-tau")).toHaveValue("30");
  await expect(restored.getByTestId("advanced-B-q")).toHaveText("25");
  await expect(restored.getByTestId("advanced-B-taxRevenue")).toHaveText("750");
  await page.reload();
  await expect(restored.getByTestId("advanced-B-q")).toHaveText("25");
  await expect(restored.getByLabel("ML05 实验解释")).toHaveValue(/法定缴税方/);
});

test("终课作品选择两份历史快照，下载精确参数结果，删除需确认并解除引用", async ({ page }) => {
  const { lab, first, second } = await saveTwoTaxSnapshots(page);
  await lab.getByTestId("input-B-tau").fill("80"); await skipAndRun(lab);
  await page.goto("/#/capstone");
  await expect(page.getByTestId("capstone-snapshot-count")).toContainText("仍是草稿");
  await page.getByLabel("1 · 对象、问题与价值标准", { exact: true }).fill("虚构商品税负；规范判断与模型结果分开。");
  await page.getByLabel("3 · 两次反事实与分配", { exact: true }).fill("保留τ20基准，分别比较τ10与τ30；税收只计一次。");
  await page.getByRole("checkbox", { name: "引用 税率10的反事实", exact: true }).check();
  await page.getByRole("checkbox", { name: "引用 税率30的反事实", exact: true }).check();
  await expect(page.getByTestId("capstone-snapshot-count")).toContainText("已引用 2 份快照");
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "引用 税率10的反事实", exact: true })).toBeChecked();
  expect((await records(page)).capstoneSnapshots).toEqual([first.id, second.id]);
  const pendingDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出终课作品文本与实验快照", exact: true }).click();
  const download = await pendingDownload;
  const text = await readFile((await download.path())!, "utf8");
  const appendices = text.split("\n\n").filter((section) => section.startsWith("{\n")).map((section) => JSON.parse(section));
  expect(appendices).toHaveLength(2);
  expect(appendices.map((snapshot) => snapshot.snapshotId)).toEqual([first.id, second.id]);
  expect(appendices.map((snapshot) => snapshot.baseline.tau)).toEqual([20, 20]);
  expect(appendices.map((snapshot) => snapshot.scenario.tau)).toEqual([10, 30]);
  expect(appendices.map((snapshot) => snapshot.scenarioResults.metrics.q)).toEqual([35, 25]);
  expect(appendices.map((snapshot) => snapshot.scenarioResults.metrics.taxRevenue)).toEqual([350, 750]);
  expect(appendices[0].explanation).toContain("税收是转移");
  expect(appendices[0].scenarioResults).not.toHaveProperty("curves");
  expect(text).toContain("保留τ20基准，分别比较τ10与τ30");
  await page.goto("/#/history");
  const card = page.getByTestId(`snapshot-${first.id}`);
  await card.getByRole("button", { name: "删除此快照", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
  expect((await records(page)).capstoneSnapshots).toHaveLength(2);
  await card.getByRole("button", { name: "删除此快照", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "确认删除快照" })).toContainText("引用也会移除");
  await page.getByRole("dialog").getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(card).toHaveCount(0);
  expect((await records(page)).experimentHistory.map((snapshot) => snapshot.id)).toEqual([second.id]);
  expect((await records(page)).capstoneSnapshots).toEqual([second.id]);
  await page.goto("/#/capstone");
  await expect(page.getByTestId("capstone-snapshot-count")).toContainText("已引用 1 份快照");
  await expect(page.getByLabel("3 · 两次反事实与分配", { exact: true })).toHaveValue(/分别比较τ10与τ30/);
});

test("恶意快照名称及解释仅渲染为纯文本，390px历史与作品无横向正文溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { lab, panel } = await openLab(page, "M03-A", "ML03");
  await skipAndRun(lab);
  const label = '<img src=x onerror="window.snapshotExecuted=true">';
  const snapshot = await saveSnapshot(page, panel, label, '<script>window.snapshotExecuted=true</script>只作为文本保存。');
  await page.goto("/#/history");
  const card = page.getByTestId(`snapshot-${snapshot.id}`);
  await expect(card.getByRole("heading", { name: label, exact: true })).toBeVisible();
  await card.getByText("A/B 参数、预测与可复现结果", { exact: true }).click();
  await expect(card).toContainText('<script>window.snapshotExecuted=true</script>');
  await expect(card.locator("img, script")).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { snapshotExecuted?: boolean }).snapshotExecuted)).toBeUndefined();
  await expectNoPageOverflow(page);
  await page.goto("/#/capstone");
  await page.getByRole("checkbox", { name: `引用 ${label}`, exact: true }).check();
  await page.getByTestId(`capstone-snapshot-${snapshot.id}`).getByText("A/B 参数、预测与可复现结果", { exact: true }).click();
  await expect(page.locator("main img, main script")).toHaveCount(0);
  await expectNoPageOverflow(page);
});
