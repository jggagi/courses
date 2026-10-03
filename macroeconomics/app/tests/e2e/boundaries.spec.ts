import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const STORAGE_KEY = 'courses:macroeconomics:v1';
const errorsByPage = new WeakMap<Page, string[]>();
const externalByPage = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, baseURL }) => {
  const runtimeOrigin = new URL(baseURL!).origin;
  const runtimeHost = new URL(baseURL!).host;
  const errors: string[] = [];
  const external: string[] = [];
  errorsByPage.set(page, errors);
  externalByPage.set(page, external);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== runtimeOrigin) external.push(request.url());
  });
  page.on('websocket', socket => {
    if (new URL(socket.url()).host !== runtimeHost) external.push(socket.url());
  });
});

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page), 'Boundary handling must not throw browser exceptions').toEqual([]);
  expect(externalByPage.get(page), 'Boundary handling must remain local').toEqual([]);
});

test('invalid combined GDP inputs cannot replace A, overwrite a valid record or export an invalid state', async ({ page }) => {
  await page.goto('/#/lab/LA02');
  await page.getByRole('button', { name: '跳过预测', exact: true }).click();
  await page.getByLabel('本期未售存货', { exact: true }).fill('80');
  const validRecord = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  const initialBaseline = JSON.parse(validRecord!).labStates.LA02.baseline;
  await page.getByLabel('出口', { exact: true }).fill('80');
  await expect(page.getByRole('button', { name: '设 A 为当前情景', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert').last()).toContainText(/100|存货|出口/);
  const protectedRecord = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  expect(protectedRecord).toBe(validRecord);
  expect(JSON.parse(protectedRecord!).labStates.LA02.baseline).toEqual(initialBaseline);
  await page.getByRole('link', { name: '个人记录与导入 / 导出', exact: true }).click();
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.getByRole('button', { name: '导出本课 JSON', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('无法导出');
  expect(downloaded).toBe(false);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(validRecord);
  await page.getByRole('navigation', { name: '实验目录' }).getByRole('link', { name: /LA02/ }).click();
  await expect(page.getByLabel('出口', { exact: true })).toHaveValue('80');
  await page.getByLabel('出口', { exact: true }).fill('0');
  for (const control of await page.locator('select[aria-label$=" 分类"]').all()) await control.selectOption('current');
  await page.getByRole('button', { name: '运行实验', exact: true }).click();
  await expect(page.getByTestId('accounts-results')).toContainText('生产 100＝最终支出 100');
});

test('imported A with one period and B with three explains the comparison boundary and leaves A observations undefined', async ({ page }, testInfo) => {
  await page.goto('/#/records');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出本课 JSON', exact: true }).click();
  const file = testInfo.outputPath('period-boundary.json');
  await (await downloadPromise).saveAs(file);
  const exported = JSON.parse(await readFile(file, 'utf8'));
  const baseline = exported.labStates.LA03.baseline;
  baseline.periods = baseline.periods.slice(0, 1);
  baseline.priceBase = 0;
  baseline.basketBase = 0;
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('导入本课 JSON', { exact: true }).setInputFiles({ name: 'one-period-baseline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.getByRole('status')).toContainText('导入成功');
  await page.getByRole('navigation', { name: '实验目录' }).getByRole('link', { name: /LA03/ }).click();
  await page.getByRole('button', { name: '跳过预测', exact: true }).click();
  await page.getByRole('button', { name: '运行实验', exact: true }).click();
  const results = page.getByTestId('price-results');
  await expect(results).toContainText(/A 有 1 个时期，B 有\s*3 个时期/);
  await expect(results.locator('[data-testid^="price-row-"]')).toHaveCount(3);
  await expect(page.getByTestId('price-row-1').getByRole('cell').nth(0)).toHaveText('61');
  await expect(page.getByTestId('price-row-2').getByRole('cell').nth(0)).toHaveText('62.22');
  const comparison = page.getByRole('table').filter({ has: page.getByText('N／R／D／L 四个分离指标的数字替代表：A/B 水平与同指标同比', { exact: true }) });
  for (const period of ['第1期', '第2期']) {
    const rows = comparison.getByRole('row').filter({ hasText: period });
    await expect(rows).toHaveCount(4);
    for (const row of await rows.all()) {
      await expect(row.getByRole('cell').nth(0)).toHaveText('未定义');
      await expect(row.getByRole('cell').nth(2)).toHaveText('未定义');
      await expect(row.getByRole('cell').nth(4)).toHaveText('未定义');
    }
  }
  const charts = results.getByRole('img');
  await expect(charts).toHaveCount(4);
  for (const chart of await charts.all()) {
    await expect(chart.locator('g[stroke-dasharray] circle')).toHaveCount(1);
    await expect(chart.locator('g[stroke-width="2.5"]:not([stroke-dasharray]) circle')).toHaveCount(3);
    for (const path of await chart.locator('path').all()) expect(await path.getAttribute('d')).not.toMatch(/NaN|Infinity|undefined/);
  }
  await page.reload();
  await expect(page.getByTestId('price-row-2')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/NaN|Infinity/);
});
