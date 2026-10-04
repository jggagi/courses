import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const key = "courses:macroeconomics:v1";
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, baseURL }) => {
  const seen: string[] = [];
  errors.set(page, seen);
  page.on("pageerror", (error) => seen.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      ["http:", "https:"].includes(url.protocol) &&
      url.origin !== new URL(baseURL!).origin
    )
      seen.push(`External request: ${url}`);
  });
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
test("noncanonical imported answers receive the same feedback in a lesson and review, then can be replaced by valid answers", async ({
  page,
}) => {
  await page.goto("/#/records");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出本课 JSON", exact: true })
    .click();
  const record = JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
  record.objectiveAttempts = [
    {
      lessonId: "A01-A",
      checkId: "A01-A-number",
      answer: "0x6e",
      correct: true,
      at: record.updatedAt,
    },
    {
      lessonId: "A01-A",
      checkId: "A01-A-choice",
      answer: "01",
      correct: true,
      at: record.updatedAt,
    },
  ];
  record.notes["response:A01-A-number"] = "0x6e";
  record.notes["response:A01-A-choice"] = "01";
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByLabel("导入本课 JSON", { exact: true })
    .setInputFiles({
      name: "synthetic-format.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(record)),
    });
  await expect(page.getByRole("status")).toContainText("导入成功");
  await page.goto("/#/lesson/A01-A");
  const numeric = page.getByTestId("check-A01-A-number");
  const choice = page.getByTestId("check-A01-A-choice");
  await expect(numeric).toContainText("不能按当前题目核对");
  await expect(choice).toContainText("不能对应当前选项");
  await numeric.getByRole("button", { name: "提交检查", exact: true }).click();
  await expect(numeric).toContainText("不能按当前题目核对");
  expect(
    (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key))
      .objectiveAttempts,
  ).toHaveLength(2);
  await page.goto("/#/review");
  await expect(page.getByTestId("review-A01-A-number")).toContainText(
    "不能按当前题目核对",
  );
  await expect(page.getByTestId("review-A01-A-choice")).toContainText(
    "不能对应当前选项",
  );
  await page.goto("/#/lesson/A01-A");
  await numeric
    .getByLabel("A01-A-number 数值答案", { exact: true })
    .fill("110");
  await numeric.getByRole("button", { name: "提交检查", exact: true }).click();
  await expect(numeric).toContainText("数值核对正确");
  await choice.getByRole("radio").nth(1).check();
  await choice.getByRole("button", { name: "提交检查", exact: true }).click();
  await page.goto("/#/review");
  await expect(page.getByTestId("review-workbench")).toContainText(
    "待复习 0 题",
  );
});
test("saved note and prediction drafts count as learning records while keeping self-evaluation separate", async ({
  page,
}) => {
  await page.goto("/#/lesson/A02-A");
  await page
    .getByLabel("学习笔记", { exact: true })
    .fill("教学测试：尚未做题，已保存口径疑问。");
  await page.goto("/#/home");
  await expect(
    page.getByText("1 节有学习记录；这不是掌握率。", { exact: true }),
  ).toBeVisible();
  await page.goto("/#/records");
  await expect(
    page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: "A02-A", exact: true }) }),
  ).toContainText("学习中");
  await page.goto("/#/lesson/A03-A");
  await page
    .getByLabel("我的开场预测", { exact: true })
    .fill("教学测试：只写了草稿。");
  await page.goto("/#/home");
  await expect(
    page.getByText("2 节有学习记录；这不是掌握率。", { exact: true }),
  ).toBeVisible();
});
