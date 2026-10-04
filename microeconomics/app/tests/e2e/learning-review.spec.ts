import { expect, test, type Page } from "@playwright/test";
import { createInitialState, STORAGE_KEY, type LearningState } from "../../src/persistence/store";
import { queueReview } from "../../src/persistence/learning-tools";

const firstReview = "2026-10-04T10:00:00.000Z";
const readState = (page: Page): Promise<LearningState> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
const row = (page: Page, questionId: string) => page.locator(".review-queue-list li").filter({ has: page.getByText(questionId, { exact: true }) });

async function openQueue(page: Page) {
  await page.goto("/#/practice");
  await expect(page.getByRole("heading", { name: "错题与间隔复习", exact: true })).toBeVisible();
}
async function start(page: Page, questionId: string) {
  await row(page, questionId).getByRole("button", { name: /开始复习|提前复习/ }).click();
  await expect(page.getByRole("heading", { name: `正在复习 · ${questionId}`, exact: true })).toBeVisible();
}
async function seed(page: Page, state: LearningState) {
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: STORAGE_KEY, value: JSON.stringify(state) });
}

test("原题答错入队、刷新不重复、新数字核对及 again/hard/good 按 UTC 排期", async ({ page }) => {
  await page.clock.setFixedTime(new Date(firstReview));
  await page.goto("/#/lesson/M01-B");
  const original = page.locator(".check").filter({ has: page.getByRole("heading", { name: "默认预算下购买(10,20)，余额是多少？", exact: true }) });
  await original.getByRole("spinbutton").fill("0");
  await original.getByRole("button", { name: "检查答案", exact: true }).click();
  await expect(original).toContainText("本次答案需要修正。");
  let stored = await readState(page);
  expect(stored.reviewQueue["M01-B-number"]).toMatchObject({ dueAt: firstReview, reason: "incorrect", variant: 0, grade: null });
  expect(stored.objectiveAttempts["M01-B-number"]).toHaveLength(1);

  await page.reload();
  await expect(original).toContainText("已记录 1 次客观尝试。");
  stored = await readState(page);
  expect(Object.keys(stored.reviewQueue)).toEqual(["M01-B-number"]);
  expect(stored.objectiveAttempts["M01-B-number"]).toHaveLength(1);
  await openQueue(page);
  await expect(page.locator("article")).toContainText("当前到期 1 道");
  await start(page, "M01-B-number");
  await expect(page.locator(".review-prompt")).toContainText("预算 m=150");
  await expect(page.locator(".review-prompt")).toContainText("单价 px=5、py=4");
  await page.getByRole("button", { name: "核对本次回答", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("有限数值");
  await page.getByLabel("复习数值回答", { exact: true }).fill("53");
  await page.getByRole("button", { name: "核对本次回答", exact: true }).click();
  await expect(page.locator(".review-feedback")).toContainText("这次数值与模型一致");
  await expect(page.locator(".review-feedback")).toContainText("模型结果 53");
  await page.getByRole("button", { name: "再练 · 1 天后", exact: true }).click();
  stored = await readState(page);
  expect(stored.reviewQueue["M01-B-number"]).toMatchObject({ dueAt: "2026-10-05T10:00:00.000Z", intervalDays: 1, repetitions: 0, lapses: 1, grade: "again", variant: 1 });
  expect(stored.objectiveAttempts["M01-B-number"]).toHaveLength(1);
  expect(stored.objectiveAttempts["M01-B-number"][0]).toMatchObject({ answer: 0, correct: false });
  await expect(page.locator("article")).toContainText("当前没有到期题目");
  await page.reload();
  await expect(page.locator("article")).toContainText("当前到期 0 道");
  await page.getByRole("button", { name: "全部队列", exact: true }).click();
  await expect(row(page, "M01-B-number").getByRole("button", { name: "提前复习", exact: true })).toBeVisible();

  await page.clock.setFixedTime(new Date("2026-10-05T10:00:00.000Z"));
  await page.getByRole("button", { name: "刷新到期时间", exact: true }).click();
  await start(page, "M01-B-number");
  await page.getByRole("button", { name: "展开参考与自评", exact: true }).click();
  await page.getByRole("button", { name: "吃力 · 3 天后", exact: true }).click();
  stored = await readState(page);
  expect(stored.reviewQueue["M01-B-number"]).toMatchObject({ dueAt: "2026-10-08T10:00:00.000Z", intervalDays: 3, repetitions: 1, lapses: 1, grade: "hard", variant: 2 });

  await page.clock.setFixedTime(new Date("2026-10-08T10:00:00.000Z"));
  await page.getByRole("button", { name: "刷新到期时间", exact: true }).click();
  await start(page, "M01-B-number");
  await page.getByRole("button", { name: "展开参考与自评", exact: true }).click();
  await page.getByRole("button", { name: "能解释 · 延长间隔", exact: true }).click();
  stored = await readState(page);
  expect(stored.reviewQueue["M01-B-number"]).toMatchObject({ dueAt: "2026-10-15T10:00:00.000Z", intervalDays: 7, repetitions: 2, lapses: 1, grade: "good", variant: 3 });
  expect(stored.objectiveAttempts["M01-B-number"]).toHaveLength(1);
});

test("主观疑问自动入队、纯文本草稿恢复、自评不冒充机器评分", async ({ page }) => {
  await page.clock.setFixedTime(new Date(firstReview));
  await page.goto("/#/lesson/M02-B");
  const subjective = page.locator(".check").filter({ has: page.getByRole("heading", { name: "左鞋与右鞋必须1:1使用。多买十只左鞋一定更好吗？应选哪种模型？", exact: true }) });
  const text = '<img src="x" onerror="window.reviewUnsafe=true">合成测试解释：多余左鞋不增加配套数量。';
  await subjective.getByRole("textbox").fill(text);
  await page.getByLabel("M02-B-transfer 自评", { exact: true }).selectOption("partial");
  let stored = await readState(page);
  expect(stored.reviewQueue["M02-B-transfer"]).toMatchObject({ reason: "uncertain", variant: 0 });
  expect(stored.selfChecks["M02-B-transfer"]).toEqual({ answer: text, rating: "partial" });
  expect(Object.keys(stored.objectiveAttempts)).toHaveLength(0);
  await page.reload();
  await expect(subjective.getByRole("textbox")).toHaveValue(text);
  expect(Object.keys((await readState(page)).reviewQueue)).toEqual(["M02-B-transfer"]);
  await openQueue(page); await start(page, "M02-B-transfer");
  await expect(page.getByLabel("复习我的解释", { exact: true })).toHaveValue(text);
  await expect(page.locator(".review-prompt")).toContainText("新增情境由你对照 rubric 自评");
  const revised = text + "新情境需检查配套比例是否固定。";
  await page.getByLabel("复习我的解释", { exact: true }).fill(revised);
  expect((await readState(page)).selfChecks["M02-B-transfer"].answer).toBe(revised);
  await expect(page.locator(".review-question img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { reviewUnsafe?: boolean }).reviewUnsafe)).not.toBe(true);
  await expect(page.locator("article")).not.toContainText(/得分\s*[:：]|自动评分\s*[:：]|掌握率\s*[:：]/);
  await expect(page.getByRole("button", { name: "能解释 · 延长间隔", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "展开参考与自评", exact: true }).click();
  await expect(page.locator(".review-feedback")).toContainText("u=min(x,y)");
  await page.getByRole("button", { name: "吃力 · 3 天后", exact: true }).click();
  stored = await readState(page);
  expect(stored.selfChecks["M02-B-transfer"]).toEqual({ answer: revised, rating: "partial" });
  expect(stored.reviewQueue["M02-B-transfer"].dueAt).toBe("2026-10-07T10:00:00.000Z");
  expect(Object.keys(stored.objectiveAttempts)).toHaveLength(0);
  await page.getByRole("button", { name: "全部队列", exact: true }).click();
  await row(page, "M02-B-transfer").getByRole("link").click();
  await expect(page).toHaveURL(/#\/lesson\/M02-B$/);
  await expect(subjective.getByRole("textbox")).toHaveValue(revised);
});

test("全部四个跨模块队列项回到原复习，坏题目 ID 导入被拒且保留队列", async ({ page }) => {
  await page.clock.setFixedTime(new Date(firstReview));
  let state = createInitialState();
  for (const name of ["cost", "tax", "game", "risk"]) state = queueReview(state, `M12-B-review-${name}`, "uncertain", firstReview);
  await seed(page, state); await openQueue(page);
  await expect(page.locator(".review-queue-list li")).toHaveCount(4);
  for (const name of ["cost", "tax", "game", "risk"]) {
    await start(page, `M12-B-review-${name}`);
    await expect(page.locator(".review-question")).toContainText("跨模块解释题请在原复习页完成");
    await page.getByRole("link", { name: "打开跨模块复习原题", exact: true }).click();
    await expect(page).toHaveURL(/#\/review$/);
    await expect(page.getByRole("heading", { name: "跨模块复习", exact: true })).toBeVisible();
    await openQueue(page);
  }
  const before = await readState(page);
  const corrupt = structuredClone(before);
  const entry = corrupt.reviewQueue["M12-B-review-cost"];
  delete corrupt.reviewQueue["M12-B-review-cost"];
  (corrupt.reviewQueue as Record<string, unknown>)["M99-A-number"] = { ...entry, questionId: "M99-A-number", lessonId: "M99-A" };
  await page.goto("/#/records");
  await page.getByLabel("导入 JSON 文件").setInputFiles({ name: "invalid-review.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(corrupt)) });
  await expect(page.getByRole("alert")).toContainText("无效复习题目 ID");
  expect((await readState(page)).reviewQueue).toEqual(before.reviewQueue);
  await openQueue(page);
  await expect(page.locator(".review-queue-list li")).toHaveCount(4);
  await expect(page.locator("article")).not.toBeEmpty();
});

test("390px 复习可通过键盘核对并返回队列，无横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date(firstReview));
  const state = queueReview(createInitialState(), "M01-B-number", "incorrect", firstReview);
  await seed(page, state); await openQueue(page); await start(page, "M01-B-number");
  const input = page.getByLabel("复习数值回答", { exact: true });
  await input.focus(); await page.keyboard.type("53"); await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "核对本次回答", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".review-feedback")).toContainText("这次数值与模型一致");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "返回队列", exact: true }).click();
  await expect(page.locator(".review-question")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "我的复习队列", exact: true })).toBeVisible();
});
