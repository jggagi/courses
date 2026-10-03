import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createInitialState, STORAGE_KEY, type LearningState } from '../../src/persistence/store';

const artifactDirectory = path.resolve(import.meta.dirname, '../../../artifacts');
const lessonUrl = (id: string) => `/#/lesson/${id}`;

async function openLab(page: Page, lesson: string, lab: string) {
  await page.goto(lessonUrl(lesson));
  const region = page.getByTestId(lab);
  await region.getByRole('button', { name: '跳过预测并运行' }).click();
  return region;
}

async function storedState(page: Page): Promise<LearningState> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}

async function importJson(page: Page, value: unknown, filename = 'learning-record.json') {
  await page.getByLabel('导入 JSON 文件').setInputFiles({
    name: filename, mimeType: 'application/json',
    buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
  });
}

async function tabTo(page: Page, target: Locator) {
  // Use actual sequential keyboard navigation, including native radio/select controls.
  for (let i = 0; i < 180; i++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('The requested control was not reachable with Tab.');
}

async function takeScreenshot(page: Page, name: string) {
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({ path: path.join(artifactDirectory, name), fullPage: false });
}

test('M01 学习、针对性反馈、自评、下一课和预算图表形成闭环', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /开始第一课 M01-A/ }).click();
  await expect(page).toHaveURL(/#\/lesson\/M01-A$/);
  await page.getByLabel('本节学习笔记').fill('机会成本还包括稀缺时间及最佳替代。');
  const checks = page.locator('.check');
  for (const explanation of await checks.filter({ has: page.locator('textarea') }).all()) {
    await explanation.getByRole('textbox').fill('阅读使用了有限时间，最佳替代可能是制作作品；新增使用仍须比较未来时间成本。');
    await explanation.getByText('参考解释与自评 rubric', { exact: true }).click();
    await expect(explanation.locator('details')).toHaveAttribute('open', '');
    await explanation.getByRole('combobox').selectOption('clear');
  }
  for (const check of await checks.all()) {
    const form = check.locator('form');
    if (!await form.count()) continue;
    if (await check.getByRole('spinbutton').count()) await check.getByRole('spinbutton').fill('1');
    else await check.getByRole('radio').first().check();
    await check.getByRole('button', { name: '检查答案' }).click();
    await expect(check.getByRole('status')).toContainText('已记录 1 次客观尝试');
    await expect(check.getByRole('status').locator('p').first()).not.toBeEmpty();
  }
  await page.getByRole('button', { name: '记录本节已自评' }).click();
  expect((await storedState(page)).lessonStates['M01-A']).toBe('self_checked');
  await page.getByRole('link', { name: /下一节 M01-B/ }).click();
  const lab = page.getByTestId('ML01');
  await lab.getByLabel('ML01 实验预测').fill('x 价格翻倍时 x 截距减半，y 截距不变。');
  await lab.getByRole('button', { name: '保存预测并运行' }).click();
  const originalBudgetLines = await lab.locator('svg polyline').evaluateAll(nodes => nodes.map(n => n.getAttribute('points')));
  await lab.getByLabel('x 单价 px（货币 / x）', { exact: true }).fill('6');
  await expect(lab.getByTestId('x-intercept')).toHaveText('20');
  await expect(lab.getByTestId('y-intercept')).toHaveText('60');
  await expect(lab.getByTestId('bundle-result')).toContainText('支出 180');
  const changedBudgetLines = await lab.locator('svg polyline').evaluateAll(nodes => nodes.map(n => n.getAttribute('points')));
  expect(changedBudgetLines[0]).toEqual(originalBudgetLines[0]);
  expect(changedBudgetLines[1]).not.toEqual(originalBudgetLines[1]);
  await lab.getByRole('button', { name: '重置实验', exact: true }).click();
  await expect(lab.getByRole('button', { name: '保存预测并运行' })).toBeDisabled();
  await lab.getByRole('button', { name: '跳过预测并运行' }).click();
  await expect(lab.getByTestId('x-intercept')).toHaveText('40');
  await expect(lab.getByTestId('y-intercept')).toHaveText('60');
  expect((await storedState(page)).lessonStates['M01-A']).toBe('self_checked');
});

test('ML01 验证计价变换、零预算、超域价格和预设错误', async ({ page }) => {
  const lab = await openLab(page, 'M01-B', 'ML01');
  await lab.getByRole('button', { name: '全部货币数值 ×10' }).click();
  await expect(lab.getByTestId('x-intercept')).toHaveText('40');
  await expect(lab.getByTestId('bundle-result')).toContainText('支出 1200');
  await lab.getByLabel('x 单价 px（货币 / x）', { exact: true }).fill('0');
  await expect(lab.getByRole('alert')).toContainText('未应用无效值');
  await expect(lab.getByTestId('x-intercept')).toHaveText('40');
  await lab.getByLabel('x 单价 px（货币 / x）', { exact: true }).fill('20');
  await lab.getByRole('button', { name: 'x 价格变为 2 倍' }).click();
  await expect(lab.getByRole('alert')).toContainText('不能应用');
  await expect(lab.getByLabel('x 单价 px（货币 / x）', { exact: true })).toHaveValue('20');
  await lab.getByLabel('预算 m（货币单位）', { exact: true }).fill('0');
  await expect(lab.getByTestId('x-intercept')).toHaveText('0');
  await expect(lab.getByTestId('y-intercept')).toHaveText('0');
  await expect(lab.getByTestId('bundle-result')).toContainText('不可行');
  await expect(lab).not.toContainText(/NaN|Infinity/);
});

test('M02-A 排序与 u/u²、真实偏好变化及互补拐角', async ({ page }) => {
  const lab = await openLab(page, 'M02-A', 'ML02');
  await expect(lab.getByTestId('ranking')).toContainText('无差别');
  await expect(lab.getByTestId('utility-0')).toHaveText('10');
  await expect(lab.getByTestId('utility-1')).toHaveText('10');
  const originalCurves = await lab.locator('svg polyline').evaluateAll(nodes => nodes.map(n => n.getAttribute('points')));
  await lab.getByLabel('效用表示', { exact: true }).selectOption('square');
  await expect(lab.getByTestId('utility-0')).toHaveText('100');
  await expect(lab.getByTestId('utility-1')).toHaveText('100');
  await expect(lab.getByTestId('ranking')).toContainText('无差别');
  expect(await lab.locator('svg polyline').evaluateAll(nodes => nodes.map(n => n.getAttribute('points')))).toEqual(originalCurves);
  await lab.getByLabel('组合 B 的 x', { exact: true }).fill('12');
  await lab.getByLabel('组合 B 的 y', { exact: true }).fill('12');
  await expect(lab.getByTestId('utility-1')).toHaveText('144');
  await expect(lab.getByTestId('ranking')).toContainText('组合 B 更受偏好');
  await lab.getByLabel('偏好模型', { exact: true }).selectOption('complements');
  await expect(lab.getByRole('table')).toContainText('未定义 / 不适用');
  expect(await lab.locator('svg polyline').first().getAttribute('points')).toMatch(/\S+ \S+ \S+$/);
  await expect(lab).not.toContainText(/NaN|Infinity/);
});

test('M03 求解和需求表共享结果，并明确线性多解与互补拐角', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const lab = await openLab(page, 'M03-A', 'ML03');
  await expect(lab.getByTestId('choice-result')).toHaveText('B 最优选择 (20, 30)');
  await lab.getByLabel('x 单价 px（货币 / x）', { exact: true }).fill('6');
  await expect(lab.getByTestId('choice-result')).toHaveText('B 最优选择 (10, 30)');
  await lab.getByText('展开需求图的精确替代表格', { exact: true }).click();
  const demandTable = lab.getByRole('table', { name: /保持 m、py、偏好不变/ });
  await expect(demandTable.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '6', exact: true }) })).toHaveText('61010');
  await lab.getByLabel('偏好模型', { exact: true }).selectOption('linear');
  await lab.getByLabel('x 单价 px（货币 / x）', { exact: true }).fill('2');
  await expect(lab.getByTestId('choice-result')).toContainText('最优集合');
  await expect(lab.getByTestId('choice-result')).toContainText('(60, 0)');
  await expect(lab.getByTestId('choice-result')).toContainText('(0, 60)');
  await expect(demandTable.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '2', exact: true }) })).toContainText('[0, 60]');
  await lab.getByTestId('choice-result').scrollIntoViewIfNeeded();
  await takeScreenshot(page, 'multiple-optima.png');
  await lab.getByLabel('偏好模型', { exact: true }).selectOption('complements');
  await lab.getByLabel('x 单价 px（货币 / x）', { exact: true }).fill('3');
  await expect(lab.getByTestId('choice-result')).toHaveText('B 最优选择 (24, 24)');
  await lab.getByLabel('x 单价 px（货币 / x）', { exact: true }).fill('6');
  await expect(lab.getByTestId('choice-result')).toHaveText('B 最优选择 (15, 15)');
  await lab.getByLabel('预算 m（货币单位）', { exact: true }).fill('0');
  await expect(lab.getByTestId('choice-result')).toHaveText('B 最优选择 (0, 0)');
  await expect(lab).not.toContainText(/NaN|Infinity/);
  await page.getByRole('link', { name: /下一节 M03-B/ }).click();
  await expect(page.getByTestId('ML03').getByTestId('choice-result')).toHaveText('B 最优选择 (0, 0)');
});

test('预测、实验、笔记在刷新/深链接与导出-清空-导入后恢复', async ({ page }) => {
  await page.goto(lessonUrl('M03-B'));
  await page.getByLabel('本节学习笔记').fill('涨价影响相对价格与实际购买力，分解须指定补偿。');
  const lab = page.getByTestId('ML03');
  await lab.getByLabel('ML03 实验预测').fill('x 数量减半；y 仍为30不等于购买力不变。');
  await lab.getByRole('button', { name: '保存预测并运行' }).click();
  await lab.getByLabel('x 单价 px（货币 / x）', { exact: true }).fill('6');
  await page.reload();
  await expect(page.getByLabel('本节学习笔记')).toHaveValue('涨价影响相对价格与实际购买力，分解须指定补偿。');
  await expect(lab.getByLabel('ML03 实验预测')).toHaveValue('x 数量减半；y 仍为30不等于购买力不变。');
  await expect(lab.getByTestId('choice-result')).toHaveText('B 最优选择 (10, 30)');
  await page.goto('/');
  await page.getByRole('link', { name: /继续学习 M03-B/ }).click();
  await expect(lab.getByTestId('choice-result')).toHaveText('B 最优选择 (10, 30)');
  await page.getByRole('link', { name: '本地记录', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON' }).click();
  const download = await downloadPromise;
  const exported = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(exported).labStates.ML03.scenario.px).toBe(6);
  await page.getByRole('button', { name: '清空本课程记录' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '确认清空', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
  await importJson(page, exported);
  await expect(page.getByRole('alert')).toContainText('已导入本课记录');
  expect(await storedState(page)).toEqual(JSON.parse(exported));
  await page.goto(lessonUrl('M03-B'));
  await expect(page.getByLabel('本节学习笔记')).toHaveValue('涨价影响相对价格与实际购买力，分解须指定补偿。');
  await expect(lab.getByTestId('choice-result')).toHaveText('B 最优选择 (10, 30)');
});

test('无效 JSON、未知版本、跨课文件及过大文件均不覆盖记录', async ({ page }) => {
  await page.goto(lessonUrl('M01-A'));
  await page.getByLabel('本节学习笔记').fill('不能被坏文件覆盖的笔记。');
  const before = await storedState(page);
  await page.getByRole('link', { name: '本地记录', exact: true }).click();
  for (const [payload, error] of [
    ['{broken JSON', 'JSON 无法解析'],
    [{ ...before, schemaVersion: 999 }, '未知 schemaVersion'],
    [{ ...before, courseId: 'macroeconomics' }, '课程不匹配'],
    [{ ...before, notes: { 'M01-A': 42 } }, '必须是长度不超过'],
    [' '.repeat(1024 * 1024 + 1), '文件超出 1 MiB'],
  ] as const) {
    await importJson(page, payload);
    await expect(page.getByRole('alert')).toContainText(error);
    expect(await storedState(page)).toEqual(before);
  }
});

for (const [name, raw, message] of [
  ['损坏 JSON', '{broken local data', 'JSON 无法解析'],
  ['未知 schemaVersion', JSON.stringify({ ...createInitialState(), schemaVersion: 99 }), '未知 schemaVersion'],
] as const) {
  test(`${name} 加载显示恢复入口并保留原始数据`, async ({ page }) => {
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: raw });
    await page.goto(lessonUrl('M01-A'));
    await expect(page.getByRole('status').first()).toContainText(message);
    await page.getByLabel('本节学习笔记').fill('损坏记录时仍能在内存学习。');
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);
    const backupPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '备份原始记录' }).click();
    const backup = await backupPromise;
    expect(await readFile((await backup.path())!, 'utf8')).toBe(raw);
    await page.getByRole('link', { name: '本地记录', exact: true }).click();
    const restored = createInitialState();
    restored.notes['M01-A'] = '来自有效备份的笔记。';
    await importJson(page, restored);
    await expect(page.getByRole('alert')).toContainText('已导入本课记录');
    await expect(page.getByText(/本地记录无法读取/)).toHaveCount(0);
    expect((await storedState(page)).notes['M01-A']).toBe('来自有效备份的笔记。');
  });
}

test('用户文本保持纯文本，清空仅影响本课程；本节重置保留实验', async ({ page }) => {
  const maliciousText = '<img src=x onerror="window.__executed=true"><script>window.__executed=true</script>';
  await page.addInitScript(() => localStorage.setItem('courses:macroeconomics:v1', 'another-course-record'));
  await page.goto('/#/records');
  const state = createInitialState();
  state.lastLessonId = 'M01-A';
  state.notes['M01-A'] = maliciousText;
  state.notes['M01-B'] = '另一节笔记保留。';
  state.labStates.ML01.revealed = true;
  state.labStates.ML01.prediction = maliciousText;
  state.labStates.ML01.scenario.px = 6;
  state.selfChecks['M01-A-explain'] = { answer: maliciousText, rating: 'partial' };
  await importJson(page, state);
  await page.goto(lessonUrl('M01-A'));
  await expect(page.getByLabel('本节学习笔记')).toHaveValue(maliciousText);
  await expect(page.getByLabel('ML01 实验预测')).toHaveValue(maliciousText);
  await expect(page.getByRole('textbox', { name: '为什么买书价格不是阅读的全部机会成本？', exact: true })).toHaveValue(maliciousText);
  await expect(page.locator('main img, main script')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __executed?: boolean }).__executed)).toBeUndefined();
  await page.getByRole('button', { name: '重置本节记录' }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByLabel('本节学习笔记')).toHaveValue(maliciousText);
  await page.getByRole('button', { name: '重置本节记录' }).click();
  await page.getByRole('button', { name: '确认清空', exact: true }).click();
  await expect(page.getByLabel('本节学习笔记')).toHaveValue('');
  const afterLessonReset = await storedState(page);
  expect(afterLessonReset.notes['M01-B']).toBe('另一节笔记保留。');
  expect(afterLessonReset.labStates.ML01.scenario.px).toBe(6);
  expect(afterLessonReset.labStates.ML01.prediction).toBe(maliciousText);
  await page.getByRole('link', { name: '本地记录', exact: true }).click();
  await page.getByRole('button', { name: '清空本课程记录' }).click();
  await page.getByRole('button', { name: '确认清空', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('courses:macroeconomics:v1'))).toBe('another-course-record');
});

test('localStorage 不可用时明确内存回退，仍可学习与导出', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
  });
  await page.goto(lessonUrl('M01-A'));
  await expect(page.getByRole('status').first()).toContainText('本地存储不可用');
  await page.getByLabel('本节学习笔记').fill('内存模式也能保存本次页面中的想法。');
  await page.getByRole('link', { name: '下一节 M01-B →', exact: true }).click();
  await page.getByRole('link', { name: '← 上一节 M01-A', exact: true }).click();
  await expect(page.getByLabel('本节学习笔记')).toHaveValue('内存模式也能保存本次页面中的想法。');
  await page.getByRole('link', { name: '本地记录', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON' }).click();
  const backup = await downloadPromise;
  expect(JSON.parse(await readFile((await backup.path())!, 'utf8')).notes['M01-A']).toBe('内存模式也能保存本次页面中的想法。');
});

test('键盘独立完成进入、预测、数值输入、选择、检查、自评及下一节', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await tabTo(page, page.getByRole('link', { name: /开始第一课 M01-A/ }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByLabel('本节学习笔记'));
  await page.keyboard.insertText('用键盘写下我的预测和学习理由。');
  const lab = page.getByTestId('ML01');
  await tabTo(page, lab.getByLabel('ML01 实验预测'));
  await page.keyboard.insertText('涨价后 x 截距减半。');
  await tabTo(page, lab.getByRole('button', { name: '保存预测并运行' }));
  await page.keyboard.press('Enter');
  await tabTo(page, lab.getByLabel('x 单价 px（货币 / x）', { exact: true }));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('6');
  await expect(lab.getByTestId('x-intercept')).toHaveText('20');
  const checks = page.locator('.check');
  for (const check of await checks.all()) {
    if (await check.getByRole('textbox').count()) {
      await tabTo(page, check.getByRole('textbox'));
      await page.keyboard.insertText('稀缺时间可用于制作，机会成本是放弃的最佳替代。');
      await tabTo(page, check.getByText('参考解释与自评 rubric', { exact: true }));
      await page.keyboard.press('Enter');
      await tabTo(page, check.getByRole('combobox'));
      await page.keyboard.press('End');
    } else {
      const input = await check.getByRole('spinbutton').count() ? check.getByRole('spinbutton') : check.getByRole('radio').first();
      await tabTo(page, input);
      if (await check.getByRole('spinbutton').count()) await page.keyboard.insertText('1');
      else await page.keyboard.press('Space');
      await tabTo(page, check.getByRole('button', { name: '检查答案' }));
      await page.keyboard.press('Enter');
      await expect(check.getByRole('status')).toBeVisible();
    }
  }
  await tabTo(page, page.getByRole('button', { name: '记录本节已自评' }));
  await page.keyboard.press('Enter');
  expect((await storedState(page)).lessonStates['M01-A']).toBe('self_checked');
  await tabTo(page, page.getByRole('link', { name: /下一节 M01-B/ }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/lesson\/M01-B$/);
  await tabTo(page, page.getByTestId('ML01').getByRole('button', { name: '重置实验', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('ML01').getByRole('button', { name: '跳过预测并运行' })).toBeVisible();
});

test('390px 正文不溢出、图形有替代表格；1440px 公式/目录/空态/错误态可用', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mobileLab = await openLab(page, 'M03-B', 'ML03');
  await mobileLab.getByText('展开需求图的精确替代表格', { exact: true }).click();
  await expect(mobileLab.getByRole('table')).toHaveCount(2);
  await expect(mobileLab.getByRole('img')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('main').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await mobileLab.getByTestId('choice-result').scrollIntoViewIfNeeded();
  await takeScreenshot(page, 'mobile.png');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(lessonUrl('M03-A'));
  await expect(page.locator('.formula').first()).toBeVisible();
  const formulaFits = await page.locator('.formula').evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth));
  expect(formulaFits).toBe(true);
  await page.getByTestId('ML03').getByTestId('choice-result').scrollIntoViewIfNeeded();
  await takeScreenshot(page, 'desktop.png');
  await page.getByRole('link', { name: '本地记录', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('0 次');
  await importJson(page, '{bad');
  await expect(page.getByRole('alert')).toContainText('JSON 无法解析');
  await page.goto('/');
  await page.getByText('M04 ·', { exact: false }).first().click();
  await expect(page.locator('aside .planned')).toHaveCount(18);
  await expect(page.locator('aside .planned a')).toHaveCount(0);
  await page.goto(lessonUrl('M04-A'));
  await expect(page.getByRole('heading', { name: '没有可学习的这节课' })).toBeVisible();
});
