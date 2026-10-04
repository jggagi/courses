import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { LearningState } from "../../src/persistence";

const STORAGE_KEY = "courses:macroeconomics:v1";
const screenshots = fileURLToPath(new URL("../screenshots/", import.meta.url));
const trafficByPage = new WeakMap<Page, string[]>();
const errorsByPage = new WeakMap<Page, string[]>();

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  const external: string[] = [];
  const errors: string[] = [];
  trafficByPage.set(page, external);
  errorsByPage.set(page, errors);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      ["http:", "https:"].includes(url.protocol) &&
      url.origin !== "http://127.0.0.1:5174"
    )
      external.push(request.url());
  });
  page.on("websocket", (socket) => {
    if (new URL(socket.url()).host !== "127.0.0.1:5174")
      external.push(socket.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(trafficByPage.get(page), "No external runtime requests").toEqual([]);
  expect(errorsByPage.get(page), "No uncaught browser errors").toEqual([]);
});

async function readState(page: Page): Promise<LearningState> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
}

async function openLesson(page: Page, id: string) {
  await page.goto(`/#/lesson/${id}`);
  await expect(page.getByLabel("我的开场预测", { exact: true })).toBeVisible();
}

async function openReview(page: Page) {
  await page.goto("/#/review");
  await expect(page.getByTestId("review-workbench")).toBeVisible();
}

async function expectLessonStatus(page: Page, expected: string) {
  await expect
    .poll(async () => (await readState(page)).lessonStates["A01-A"].status)
    .toBe(expected);
}

async function expectNoOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(size.document).toBeLessThanOrEqual(size.viewport + 1);
  expect(size.body).toBeLessThanOrEqual(size.viewport + 1);
}

async function screenshot(page: Page, name: string) {
  await mkdir(screenshots, { recursive: true });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: `${screenshots}/${name}`, fullPage: true });
}

test("an incorrect answer enters local review, a correct retry leaves the queue and preserves history and a focused deep link", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openLesson(page, "A01-A");
  const original = page.getByTestId("check-A01-A-number");
  await original.getByRole("spinbutton").fill("999");
  await original.getByRole("button", { name: "提交检查", exact: true }).click();
  await expect(original.locator("[aria-live]")).toContainText("请重算");

  await page
    .getByRole("link", { name: "复习 · 错题、迁移与模型卡", exact: true })
    .click();
  const workbench = page.getByTestId("review-workbench");
  await expect(workbench).toContainText("待复习 1 题");
  const review = page.getByTestId("review-A01-A-number");
  await expect(review).toContainText("999");
  await expect(review).toContainText("把借款当净财富");

  await review.getByText("用自己的话解释这次误解", { exact: true }).click();
  const reflection = review.getByLabel("A01-A-number 误解复习笔记", {
    exact: true,
  });
  await reflection.fill("教学测试：借款增加存款，也增加同额负债。");
  await review.getByRole("checkbox").check();
  await reflection.fill("教学测试：先同时检查资产和负债，再求净值。");
  await expect(review.getByRole("checkbox")).not.toBeChecked();
  await screenshot(page, "refinements-desktop-review.png");

  await review.getByText("先独立重算，再提交一次", { exact: true }).click();
  await review
    .getByLabel("A01-A-number 复习数值答案", { exact: true })
    .fill("110");
  await review
    .getByRole("button", { name: "提交复习检查", exact: true })
    .click();
  await expect(workbench).toContainText("待复习 0 题");
  await expect(workbench.getByRole("status")).toContainText("历史仍保留");
  await expect(
    page.getByRole("heading", { name: "错题与误解回看", exact: true }),
  ).toBeFocused();

  await page
    .getByText("已正确重做，保留误解与历史（1 题）", { exact: true })
    .click();
  await expect(review).toContainText("最新重做答案");
  await review.getByText("这道题的尝试历史（2 次）", { exact: true }).click();
  const history = review.locator(".review-history li");
  await expect(history).toHaveCount(2);
  await expect(history.nth(0)).toContainText("999");
  await expect(history.nth(0)).toContainText("需再练习");
  await expect(history.nth(1)).toContainText("110");
  await expect(history.nth(1)).toContainText("正确");
  await review.getByText("用自己的话解释这次误解", { exact: true }).click();
  await expect(reflection).toHaveValue(
    "教学测试：先同时检查资产和负债，再求净值。",
  );
  await expect(review.getByRole("checkbox")).not.toBeChecked();

  await review
    .getByRole("link", { name: "回到 A01-A 的这道题", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/lesson\/A01-A\/check\/A01-A-number$/);
  await expect(original).toBeFocused();
  await expect(original.getByRole("spinbutton")).toHaveValue("110");
  await expect(original.locator("[aria-live]")).toContainText("数值核对正确");
  await page.reload();
  await expect(original).toBeFocused();
  const attempts = (await readState(page)).objectiveAttempts;
  expect(attempts.map(({ answer, correct }) => ({ answer, correct }))).toEqual([
    { answer: "999", correct: false },
    { answer: "110", correct: true },
  ]);
});

test("transfer self-checks cancel on edits, shared model cards survive refresh and a real JSON export and import", async ({
  page,
}, testInfo) => {
  const originalCard = "教学测试：家庭、企业和银行，以及边界外准备金发行方。";
  const updatedCard = "教学测试：H/F/B，同一金融工具的双方都要对账。";
  const transferAnswer =
    "教学测试：先算存款，再按生产时期检查GDP，两个对象不同。";
  const revisedTransfer = "教学测试：工资18与利润−11合计GDP7，存款总额仍140。";
  await openLesson(page, "A01-A");
  await page
    .getByText("A01 模型卡 · 不看原文，重建一次", { exact: true })
    .click();
  await page
    .getByLabel("A01 模型卡 研究对象", { exact: true })
    .fill(originalCard);

  await openReview(page);
  const transfer = page.getByTestId("review-transfer-stocks-and-production");
  await transfer.locator("summary").first().click();
  const answer = transfer.getByLabel("stocks-and-production 迁移解释", {
    exact: true,
  });
  await answer.fill(transferAnswer);
  await transfer.getByText("参考解释与自评标准", { exact: true }).click();
  await expect(transfer.locator(".review-reference ul li")).toHaveCount(3);
  await expect(transfer.locator(".review-reference")).toContainText("利润−11");
  await transfer.getByRole("checkbox").check();
  await answer.fill(revisedTransfer);
  await expect(transfer.getByRole("checkbox")).not.toBeChecked();
  await transfer.getByRole("checkbox").check();

  const card = page.getByTestId("review-card-A01");
  await card.locator("summary").click();
  const object = card.getByLabel("A01 复习模型卡 研究对象", { exact: true });
  await expect(object).toHaveValue(originalCard);
  await card.getByRole("checkbox").check();
  await object.fill(updatedCard);
  await expect(card.getByRole("checkbox")).not.toBeChecked();
  await card
    .getByLabel("A01 复习模型卡 核心关系", { exact: true })
    .fill("教学测试：资产=负债+净值；存款与贷款匹配对手方。");
  await expect(card.locator("summary")).toContainText("已填 2/7 字段");
  await page.reload();
  await transfer.locator("summary").first().click();
  await expect(answer).toHaveValue(revisedTransfer);
  await expect(transfer.getByRole("checkbox")).toBeChecked();
  await card.locator("summary").click();
  await expect(object).toHaveValue(updatedCard);
  await expect(card.getByRole("checkbox")).not.toBeChecked();

  await page.goto("/#/records");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出本课 JSON", exact: true })
    .click();
  const download = await downloadPromise;
  const file = testInfo.outputPath("refinement-private-roundtrip.json");
  await download.saveAs(file);
  const exported = JSON.parse(await readFile(file, "utf8")) as LearningState;
  expect(exported.notes["review:transfer:stocks-and-production"]).toBe(
    revisedTransfer,
  );
  expect(exported.notes["card:A01:研究对象"]).toBe(updatedCard);
  expect(exported.selfChecks["review:transfer:stocks-and-production"]).toBe(
    true,
  );
  expect(exported.selfChecks["review:card:A01"]).toBe(false);

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "清空本课全部记录", exact: true })
    .click();
  await expect.poll(async () => (await readState(page)).notes).toEqual({});
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("导入本课 JSON", { exact: true }).setInputFiles(file);
  await expect(page.getByRole("status")).toContainText("导入成功");
  await openReview(page);
  await transfer.locator("summary").first().click();
  await expect(answer).toHaveValue(revisedTransfer);
  await expect(transfer.getByRole("checkbox")).toBeChecked();
  await card.locator("summary").click();
  await expect(object).toHaveValue(updatedCard);
  await expect(card.getByRole("checkbox")).not.toBeChecked();
  expect((await readState(page)).selfChecks).toEqual(exported.selfChecks);

  await card
    .getByRole("link", { name: "回看 A01-B 与原模型卡", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/lesson\/A01-B\/card$/);
  await expect(page.locator("#card-A01")).toBeFocused();
  await expect(page.locator("#card-A01")).toHaveAttribute("open", "");
  await expect(
    page.getByLabel("A01 模型卡 研究对象", { exact: true }),
  ).toHaveValue(updatedCard);
});

test("objective retries and prediction saves preserve lesson self-check evidence, edits cancel the relevant self-check and reset clears feedback", async ({
  page,
}) => {
  await openLesson(page, "A01-A");
  const explanation = page.getByTestId("check-A01-A-explain");
  const transfer = page.getByTestId("check-A01-A-transfer");
  for (const [article, id] of [
    [explanation, "A01-A-explain"],
    [transfer, "A01-A-transfer"],
  ] as const) {
    await article
      .getByLabel(`${id} 我的解释`, { exact: true })
      .fill("教学测试：先说明时点或时期、对象与假设，再检查结论。");
    await article.getByText("参考解释与自评标准", { exact: true }).click();
    await article.getByRole("checkbox").check();
  }
  await expectLessonStatus(page, "self_checked");
  const numeric = page.getByTestId("check-A01-A-number");
  await numeric.getByRole("spinbutton").fill("110");
  await numeric.getByRole("button", { name: "提交检查", exact: true }).click();
  await expect(numeric.locator("[aria-live]")).toContainText("数值核对正确");
  await expectLessonStatus(page, "self_checked");
  await page
    .getByLabel("我的开场预测", { exact: true })
    .fill("教学测试：借款同时改变资产与负债，净值不因此增加。");
  await page.getByRole("button", { name: "保存开场预测", exact: true }).click();
  await expectLessonStatus(page, "self_checked");
  const choice = page.getByTestId("check-A01-A-choice");
  await choice.getByRole("radio").nth(0).check();
  await choice.getByRole("button", { name: "提交检查", exact: true }).click();
  await expect(choice.locator("[aria-live]")).toContainText("流量率");
  await expectLessonStatus(page, "self_checked");

  await explanation
    .getByLabel("A01-A-explain 我的解释", { exact: true })
    .fill("教学测试：债务是时点存量，赤字是期间流量，还要核验利息口径。");
  await expect(explanation.getByRole("checkbox")).not.toBeChecked();
  await expect(transfer.getByRole("checkbox")).toBeChecked();
  await expectLessonStatus(page, "practiced");
  await explanation.getByRole("checkbox").check();
  await expectLessonStatus(page, "self_checked");
  await page.reload();
  await expect(explanation.getByRole("checkbox")).toBeChecked();
  await expectLessonStatus(page, "self_checked");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "重置本课进度", exact: true }).click();
  await expect(numeric.locator("[aria-live]")).toContainText("数值核对正确");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "重置本课进度", exact: true }).click();
  await expectLessonStatus(page, "not_started");
  await expect(numeric.getByRole("spinbutton")).toHaveValue("");
  await expect(numeric.locator("[aria-live]")).toHaveText("");
  await expect(choice.locator("[aria-live]")).toHaveText("");
  await expect(explanation.getByRole("checkbox")).not.toBeChecked();
  await expect(transfer.getByRole("checkbox")).not.toBeChecked();
  expect((await readState(page)).objectiveAttempts).toEqual([]);
  await page.reload();
  await expect(numeric.locator("[aria-live]")).toHaveText("");
  await expect(choice.locator("[aria-live]")).toHaveText("");
});

test("390px navigation starts collapsed, keyboard route changes close it and accessible formula typography stays inside the viewport", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLesson(page, "A01-A");
  const toggle = page.getByRole("button", {
    name: "课程与实验目录",
    exact: true,
  });
  const navigation = page.locator('nav[aria-label="课程目录"]');
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).toBeHidden();
  await toggle.focus();
  await toggle.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(navigation).toBeVisible();
  const lessonLink = navigation.getByRole("link").filter({ hasText: "A04-A" });
  await lessonLink.focus();
  await expect(lessonLink).toBeFocused();
  await lessonLink.press("Enter");
  await expect(page).toHaveURL(/#\/lesson\/A04-A$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "多一台设备，为什么不总多出同样的产量？",
  );
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).toBeHidden();
  await expect(page.locator("main")).toBeFocused();
  await expectNoOverflow(page);

  const formula = page.getByRole("math").first();
  await expect(formula).toHaveAccessibleName(/y=A k\^α/);
  await expect(formula).toHaveAttribute("aria-label", /kₜ₊₁=/);
  await expect(formula.locator("sup").first()).toBeVisible();
  await screenshot(page, "refinements-mobile-lesson.png");
  await formula.screenshot({ path: `${screenshots}/refinements-formula.png` });
  await expectNoOverflow(page);
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).toBeHidden();
  await expect(page.getByRole("math").first()).toBeVisible();
});
