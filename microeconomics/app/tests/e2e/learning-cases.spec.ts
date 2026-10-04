import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
const receipt = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../src/content/data/oi-source-receipt.json"), "utf8")) as { retrievedAtUTC: string; files: { file: string; sourceUrl: string; excerptSha256: string; upstreamSha256: string }[] };
import { createInitialState, STORAGE_KEY, type LearningState } from "../../src/persistence/store";

type SourceCase = { id: string; provenance: { provider: string; sourceUrl: string; retrievedAtUTC: string; snapshotSha256: string; upstreamSha256: string; rawSnapshotFile: string }; identificationBoundary: string; series: { id: string; unit: string; transform: number }[]; observations: { date: string; values: Record<string, number> }[]; raw: string };
const caseStudies: SourceCase[] = [
  { id: "card-spending-2020", provider: "Affinity Solutions", ids: ["spend_all", "spend_all_q1", "spend_all_q4"], unit: "%", transform: 100, dayColumn: "day", boundary: "不能识别需求弹性" },
  { id: "ui-claims-2020", provider: "美国劳工部", ids: ["initclaims_count_regular", "contclaims_count_regular"], unit: "百万件", transform: 1 / 1_000_000, dayColumn: "day_endofweek", boundary: "不能识别失业保险对劳动供给的因果效应" },
].map((item, index) => {
  const file = receipt.files[index];
  const raw = readFileSync(path.resolve(import.meta.dirname, "../../src/content/data", file.file), "utf8");
  const [header, ...lines] = raw.trim().split("\n");
  const columns = header.split(",");
  const observations = lines.map((line) => {
    const cells = line.split(",");
    const part = (key: string) => cells[columns.indexOf(key)];
    return { date: `${part("year")}-${part("month").padStart(2, "0")}-${part(item.dayColumn).padStart(2, "0")}`, values: Object.fromEntries(item.ids.map((id) => [id, Number(part(id))])) };
  });
  return { id: item.id, provenance: { provider: item.provider, sourceUrl: file.sourceUrl, retrievedAtUTC: receipt.retrievedAtUTC, snapshotSha256: file.excerptSha256, upstreamSha256: file.upstreamSha256, rawSnapshotFile: file.file }, identificationBoundary: item.boundary, series: item.ids.map((id) => ({ id, unit: item.unit, transform: item.transform })), observations, raw };
});
function getCaseFigure(study: SourceCase) {
  const table = study.observations.map((row) => ({ date: row.date, values: Object.fromEntries(study.series.map((series) => [series.id, row.values[series.id] * series.transform])) }));
  const values = table.flatMap((row) => Object.values(row.values));
  const min = Math.min(0, ...values), max = Math.max(0, ...values), pad = Math.max((max - min) * .12, 1);
  return { table, yMin: min - pad, yMax: max + pad, firstDay: Date.parse(`${table[0].date}T00:00:00Z`), lastDay: Date.parse(`${table.at(-1)!.date}T00:00:00Z`) };
}
function compareCaseDates(study: SourceCase, start: string, end: string) {
  const rows = getCaseFigure(study).table;
  const a = rows.find((row) => row.date === start)!, b = rows.find((row) => row.date === end)!;
  return study.series.map((series) => ({ ...series, start: a.values[series.id], end: b.values[series.id], difference: b.values[series.id] - a.values[series.id], differenceUnit: series.unit === "%" ? "百分点" : "百万件" }));
}
const artifacts = path.resolve(import.meta.dirname, "../../../artifacts");
const format = (value: number | null) => value === null ? "缺失（未补值）" : Number(value.toFixed(3)).toString();
const note = "案例练习：<script>window.caseScriptRan=true</script><img src=x onerror=window.caseScriptRan=true>，地区分组不能识别个体弹性。";

async function getState(page: Page): Promise<LearningState> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}

async function checkChartAndTable(page: Page, caseIndex: number) {
  const study = caseStudies[caseIndex];
  const figure = getCaseFigure(study);
  const table = page.getByRole("table").filter({ has: page.locator("caption", { hasText: "固定来源快照" }) });
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(study.observations.length);
  const circles = page.locator("article .case-figure svg circle");
  await expect(circles).toHaveCount(study.observations.length * study.series.length);
  for (const [rowIndex, row] of figure.table.entries()) {
    await expect(rows.nth(rowIndex).locator("th")).toHaveText(row.date);
    for (const [seriesIndex, series] of study.series.entries()) {
      const value = row.values[series.id]!;
      await expect(rows.nth(rowIndex).locator("td").nth(seriesIndex)).toHaveText(format(value));
      const circle = circles.nth(seriesIndex * study.observations.length + rowIndex);
      const expectedX = 65 + (Date.parse(`${row.date}T00:00:00Z`) - figure.firstDay) / (figure.lastDay - figure.firstDay) * 455;
      const expectedY = 38 + 218 - (value - figure.yMin) / (figure.yMax - figure.yMin) * 218;
      expect(Number(await circle.getAttribute("cx"))).toBeCloseTo(expectedX, 8);
      expect(Number(await circle.getAttribute("cy"))).toBeCloseTo(expectedY, 8);
    }
  }
}

test("两个历史案例保留来源、时期、单位与共用原始值的图表", async ({ page }) => {
  await page.goto("/#/cases");
  await expect(page.getByRole("heading", { name: "现实案例：从观测到机制" })).toBeVisible();
  for (const [index, study] of caseStudies.entries()) {
    await page.getByLabel("选择现实案例").selectOption(study.id);
    await expect(page.locator("article")).toContainText(study.provenance.provider);
    await expect(page.locator("article")).toContainText("2020-02-29 至 2020-06-06");
    await expect(page.locator("article")).toContainText(study.provenance.retrievedAtUTC);
    await expect(page.locator("article")).toContainText(study.identificationBoundary);
    await expect(page.getByRole("link", { name: "打开固定版本的来源 CSV" })).toHaveAttribute("href", study.provenance.sourceUrl);
    await checkChartAndTable(page, index);
    await expect(page.locator("article .case-figure svg")).toHaveAttribute("role", "img");
    await expect(page.locator("article")).not.toContainText(/NaN|Infinity/);
  }
  await expect(page.locator("article")).toContainText("未明确所选常规计数的季调口径");
});

test("日期比较区分百分点和百万件，并可反向比较而不插补", async ({ page }) => {
  await page.goto("/#/cases");
  for (const study of caseStudies) {
    await page.getByLabel("选择现实案例").selectOption(study.id);
    await page.getByLabel("案例比较起点日期").selectOption("2020-03-28");
    await page.getByLabel("案例比较终点日期").selectOption("2020-05-09");
    const table = page.getByRole("table").filter({ has: page.locator("caption", { hasText: "描述性差值" }) });
    const comparison = compareCaseDates(study, "2020-03-28", "2020-05-09");
    for (const [index, row] of comparison.entries()) {
      const cells = table.locator("tbody tr").nth(index).locator("td");
      await expect(cells.nth(0)).toHaveText(`${format(row.start)} ${row.unit}`);
      await expect(cells.nth(1)).toHaveText(`${format(row.end)} ${row.unit}`);
      await expect(cells.nth(2)).toHaveText(`${format(row.difference)} ${row.differenceUnit}`);
    }
    // Available options remain the six saved observations, never an interpolated day.
    await expect(page.getByLabel("案例比较终点日期").locator("option")).toHaveCount(6);
    await page.getByLabel("案例比较起点日期").selectOption("2020-05-09");
    await page.getByLabel("案例比较终点日期").selectOption("2020-03-28");
    await expect(table.locator("tbody tr").first().locator("td").nth(2)).toHaveText(`${format(-comparison[0].difference!)} ${comparison[0].differenceUnit}`);
  }
});

test("案例来源加入终课作品保留原文、避免重复；笔记纯文本刷新恢复", async ({ page }) => {
  const initial = createInitialState();
  initial.capstone.evidence = "原有分析：政策效果仍需可比对照，不删除这段。";
  await page.addInitScript(({ key, data }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
  }, { key: STORAGE_KEY, data: initial });
  await page.goto("/#/cases");
  await page.getByLabel("案例比较起点日期").selectOption("2020-03-28");
  await page.getByLabel("案例比较终点日期").selectOption("2020-05-09");
  await page.getByRole("button", { name: "将当前来源与日期比较加入终课作品" }).click();
  const first = (await getState(page)).capstone.evidence;
  expect(first).toContain(initial.capstone.evidence);
  expect(first).toContain(caseStudies[0].provenance.sourceUrl);
  expect(first).toContain("2020-03-28 → 2020-05-09");
  expect(first).toContain("不能识别需求弹性");
  await page.getByRole("button", { name: "将当前来源与日期比较加入终课作品" }).click();
  expect((await getState(page)).capstone.evidence).toBe(first);
  await expect(page.getByRole("status").filter({ hasText: "已经加入" })).toBeVisible();
  await page.getByLabel("选择现实案例").selectOption(caseStudies[1].id);
  await page.getByRole("button", { name: "将当前来源与日期比较加入终课作品" }).click();
  const combined = (await getState(page)).capstone.evidence;
  expect(combined.startsWith(first)).toBe(true);
  expect(combined).toContain(caseStudies[1].provenance.sourceUrl);
  await page.getByLabel("M12-B 案例笔记").fill(note);
  await expect.poll(async () => (await getState(page)).notes["M12-B"]).toBe(note);
  await page.reload();
  await expect(page.getByLabel("M12-B 案例笔记")).toHaveValue(note);
  expect(await page.evaluate(() => "caseScriptRan" in window)).toBe(false);
  await expect(page.locator("article script, article img[src='x']")).toHaveCount(0);
  await page.goto("/#/capstone");
  await expect(page.getByLabel("5 · 来源、证据与可反驳命题", { exact: true })).toHaveValue(combined);
});

test("CSV 与来源说明由显式下载获得，字节散列及转换可复核", async ({ page }) => {
  await page.goto("/#/cases");
  for (const study of caseStudies) {
    await page.getByLabel("选择现实案例").selectOption(study.id);
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出原始 CSV 摘录", exact: true }).click();
    const csv = await csvDownload;
    expect(csv.suggestedFilename()).toBe(study.provenance.rawSnapshotFile);
    const bytes = await readFile((await csv.path())!);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(study.provenance.snapshotSha256);
    expect(bytes.toString("utf8")).toBe(study.raw);
    const metadataDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出来源说明", exact: true }).click();
    const metadata = await metadataDownload;
    expect(metadata.suggestedFilename()).toBe(`${study.id}-provenance.json`);
    const provenance = JSON.parse(await readFile((await metadata.path())!, "utf8"));
    expect(provenance).toMatchObject({ sourceUrl: study.provenance.sourceUrl, retrievedAtUTC: receipt.retrievedAtUTC, snapshotSha256: study.provenance.snapshotSha256, upstreamSha256: study.provenance.upstreamSha256, rawSnapshotFile: study.provenance.rawSnapshotFile });
    expect(provenance.provider).toContain(study.provenance.provider);
    expect(provenance.seriesId).toBe(study.series.map((series) => series.id).join("；"));
    for (const field of ["provider", "seriesId", "sourceUrl", "observationPeriod", "frequency", "units", "nominalReal", "seasonalAdjustment", "retrievedAtUTC", "vintageRevision", "transformation", "licenseNote"]) expect(typeof provenance[field]).toBe("string");
    expect(provenance.transformation).toMatch(study.id === "card-spending-2020" ? /乘 100/ : /1,000,000/);
  }
});

test("案例探索不自动请求外站，390px无页面溢出，桌面图表可见", async ({ page, baseURL }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  const origin = new URL(baseURL!).origin;
  page.on("request", (request) => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/cases");
  for (const study of caseStudies) {
    await page.getByLabel("选择现实案例").selectOption(study.id);
    await page.getByRole("button", { name: "将当前来源与日期比较加入终课作品" }).click();
    await page.locator("article details").filter({ hasText: "对照参考解释与自评标准" }).first().locator("summary").click();
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(width.scroll).toBeLessThanOrEqual(width.viewport + 1);
    await expect(page.locator("article .case-figure svg")).toBeVisible();
    await expect(page.getByRole("table").filter({ has: page.locator("caption", { hasText: "固定来源快照" }) })).toBeVisible();
  }
  await page.getByLabel("选择现实案例").focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("选择现实案例")).toHaveValue(caseStudies[1].id);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("选择现实案例").selectOption(caseStudies[0].id);
  await page.locator("article .case-figure").evaluate((figure) => window.scrollTo(0, figure.getBoundingClientRect().top + window.scrollY - 100));
  await mkdir(artifacts, { recursive: true });
  await page.screenshot({ path: path.join(artifacts, "learning-cases-desktop.png"), fullPage: false });
});
