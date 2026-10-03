import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { lessons } from '../../src/content';

const STORAGE_KEY = 'courses:macroeconomics:v1';
const MICRO_KEY = 'courses:microeconomics:v1';
const extensionIds = Array.from({ length: 9 }, (_, i) => `A${String(i + 4).padStart(2, '0')}`)
  .flatMap(moduleId => [`${moduleId}-A`, `${moduleId}-B`]);
const externalByPage = new WeakMap<Page, string[]>();
const errorsByPage = new WeakMap<Page, string[]>();

// This is the shape actually exported by the first release, not a new-state factory.
function phase1Export() {
  const initial = {
    H: { deposit: 100, netWorth: 100 }, F: { deposit: 40, loan: 20, netWorth: 20 },
    B: { reserves: 160, loanAsset: 20, depositH: 100, depositF: 40, equity: 40 },
    flow: { householdIncome: 0, householdConsumption: 0, firmRevenue: 0, firmWages: 0, principalRepaid: 0 }, events: [],
  };
  const accounts = { inventory: 0, exports: 0, imports: 0, machine: false, transfer: 0, stock: 0, secondhand: 0, oldInventorySale: 0, openingInventory: 20 };
  const prices = { periods: [{ px: 2, py: 4, qx: 10, qy: 5 }, { px: 3, py: 5, qx: 12, qy: 5 }, { px: 3.06, py: 5.1, qx: 12, qy: 5 }], priceBase: 0, basketBase: 0, normalization: 100 };
  const lab = <T>(input: T) => ({ input, baseline: structuredClone(input), prediction: '', skipped: false, hasRun: false, explanation: '' });
  const oldIds = ['A01-A', 'A01-B', 'A02-A', 'A02-B', 'A03-A', 'A03-B'];
  return {
    schemaVersion: 1, courseId: 'macroeconomics', lastLessonId: 'A03-B',
    lessonStates: Object.fromEntries(oldIds.map(id => [id, { status: id === 'A03-B' ? 'self_checked' : 'not_started', confidence: id === 'A03-B' ? 3 : 0 }])),
    objectiveAttempts: [{ lessonId: 'A03-B', checkId: 'A03-B-number', answer: '140.25', correct: true, at: '2026-10-03T12:00:00.000Z' }],
    selfChecks: { 'A03-B-explain': true }, notes: { 'note:A03-B': '第一版记录：指数仍高于基期，通胀率可以下降。' },
    labStates: { LA01: lab({ initial, events: [] }), LA02: { ...lab(accounts), classifications: {} }, LA03: { ...lab(prices), prediction: '第一版的价格预测。', explanation: '归一化不改变通胀。' } },
    updatedAt: '2026-10-03T12:00:00.000Z',
  };
}

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const host = new URL(baseURL!).host;
  const external: string[] = [], errors: string[] = [];
  externalByPage.set(page, external); errorsByPage.set(page, errors);
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) external.push(request.url());
  });
  page.on('websocket', socket => { if (new URL(socket.url()).host !== host) external.push(socket.url()); });
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(externalByPage.get(page), 'Complete-course journeys remain entirely local').toEqual([]);
  expect(errorsByPage.get(page), 'Complete-course journeys have no uncaught errors').toEqual([]);
});

async function readState(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}
async function openLab(page: Page, id: string) {
  await page.goto(`/#/lab/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(id);
}
async function predictAndRun(page: Page, prediction: string) {
  await page.getByLabel('实验预测与理由', { exact: true }).fill(prediction);
  await page.getByRole('button', { name: '保存实验预测', exact: true }).click();
  await page.getByRole('button', { name: '运行实验', exact: true }).click();
}
async function noOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.width + 1);
  expect(sizes.body).toBeLessThanOrEqual(sizes.width + 1);
}
async function importJSON(page: Page, value: unknown, name: string) {
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('导入本课 JSON', { exact: true }).setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await expect(page.getByRole('status')).toContainText('导入成功');
}

test('all eighteen additional lessons can be studied, checked and restored through the course directory', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/');
  const courseNavigation = page.getByRole('navigation', { name: '课程目录', exact: true });
  await expect(courseNavigation.getByRole('link')).toHaveCount(24);
  await expect(page.getByRole('navigation', { name: '实验目录', exact: true }).getByRole('link')).toHaveCount(9);
  for (const id of extensionIds) {
    const lesson = lessons.find(item => item.id === id)!;
    expect(lesson, `${id} must contain actual learnable content`).toBeTruthy();
    await courseNavigation.getByRole('link').filter({ hasText: id }).click();
    await expect(page).toHaveURL(new RegExp(`#/lesson/${id}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(lesson.title);
    await expect(page.locator('.lesson-body section')).toHaveCount(7);
    await expect(page.getByRole('heading', { name: '走一遍具体例子', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '反例与边界', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: `打开 ${lesson.labId}，先预测再实验`, exact: true })).toHaveAttribute('href', `#/lab/${lesson.labId}`);
    await page.getByLabel('我的开场预测', { exact: true }).fill(`${id}：先确认对象、单位、外生参数及失效条件。`);
    await page.getByRole('button', { name: '保存开场预测', exact: true }).click();
    for (const check of lesson.checks) {
      const panel = page.getByTestId(`check-${check.id}`);
      if (check.kind === 'numeric') {
        await panel.getByRole('spinbutton').fill(String(check.value! + Math.max(1, check.tolerance! * 2)));
        await panel.getByRole('button', { name: '提交检查', exact: true }).click();
        await expect(panel.locator('[aria-live]')).toContainText('请重算');
        await panel.getByRole('spinbutton').fill(String(check.value));
        await panel.getByRole('button', { name: '提交检查', exact: true }).click();
        await expect(panel.locator('[aria-live]')).toContainText('数值核对正确');
      } else if (check.kind === 'choice') {
        const wrong = check.options!.findIndex(option => !option.correct);
        const correct = check.options!.findIndex(option => option.correct);
        await panel.getByRole('radio').nth(wrong).check();
        await panel.getByRole('button', { name: '提交检查', exact: true }).click();
        await expect(panel.locator('[aria-live]')).toHaveText(check.options![wrong].feedback);
        await panel.getByRole('radio').nth(correct).check();
        await panel.getByRole('button', { name: '提交检查', exact: true }).click();
        await expect(panel.locator('[aria-live]')).toHaveText(check.options![correct].feedback);
      } else {
        await panel.getByRole('textbox').fill('解释机制须给出行为假设；核算成立仍不能独自证明现实政策效果。');
        await panel.getByText('参考解释与自评标准', { exact: true }).click();
        await expect(panel.locator('details li')).toHaveCount(check.rubric.length);
        await panel.getByRole('checkbox').check();
      }
    }
    await page.getByLabel('学习笔记', { exact: true }).fill(`${id}：记录仍需证据区分的解释。`);
  }
  const beforeRefresh = await readState(page);
  expect(Object.keys(beforeRefresh.lessonStates)).toHaveLength(24);
  expect(beforeRefresh.objectiveAttempts).toHaveLength(72);
  expect(Object.values(beforeRefresh.selfChecks).filter(Boolean)).toHaveLength(36);
  for (const id of extensionIds) {
    expect(beforeRefresh.notes[`prediction:${id}`]).toContain(id);
    expect(beforeRefresh.notes[`note:${id}`]).toContain(id);
  }
  await page.reload();
  await expect(page.getByLabel('学习笔记', { exact: true })).toHaveValue('A12-B：记录仍需证据区分的解释。');
  expect((await readState(page)).objectiveAttempts).toEqual(beforeRefresh.objectiveAttempts);
});

test('first-release JSON migrates without losing notes, self-checks or price inputs and initializes all new lessons and labs', async ({ page }) => {
  await page.goto('/#/records');
  await page.evaluate(key => localStorage.setItem(key, 'another-course-must-survive'), MICRO_KEY);
  await importJSON(page, phase1Export(), 'phase1-original.json');
  const migrated = await readState(page);
  expect(Object.keys(migrated.lessonStates)).toHaveLength(24);
  expect(Object.keys(migrated.labStates)).toHaveLength(9);
  expect(migrated.lessonStates['A03-B']).toEqual({ status: 'self_checked', confidence: 3 });
  expect(migrated.lessonStates['A12-B']).toEqual({ status: 'not_started', confidence: 0 });
  expect(migrated.objectiveAttempts[0].correct).toBe(true);
  expect(migrated.selfChecks['A03-B-explain']).toBe(true);
  expect(migrated.notes['note:A03-B']).toBe(phase1Export().notes['note:A03-B']);
  expect(migrated.labStates.LA03.input).toEqual(phase1Export().labStates.LA03.input);
  expect(migrated.labStates.LA03.prediction).toBe('第一版的价格预测。');
  await page.goto('/#/lesson/A03-B');
  await expect(page.getByLabel('学习笔记', { exact: true })).toHaveValue(phase1Export().notes['note:A03-B']);
  await page.reload();
  await expect(page.getByLabel('学习笔记', { exact: true })).toHaveValue(phase1Export().notes['note:A03-B']);
  await openLab(page, 'LA09');
  await predictAndRun(page, 'NX与CA覆盖范围不同。');
  await page.goto('/#/records');
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出本课 JSON', exact: true }).click();
  const path = test.info().outputPath('complete-course-roundtrip.json');
  await (await exported).saveAs(path);
  const saved = JSON.parse(await readFile(path, 'utf8'));
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '清空本课全部记录', exact: true }).click();
  await importJSON(page, saved, 'complete-course-roundtrip.json');
  await openLab(page, 'LA09');
  await expect(page.getByLabel('实验预测与理由', { exact: true })).toHaveValue('NX与CA覆盖范围不同。');
  await page.reload();
  expect((await readState(page)).labStates.LA09).toEqual(saved.labStates.LA09);
  expect(await page.evaluate(key => localStorage.getItem(key), MICRO_KEY)).toBe('another-course-must-survive');
});

test('a complete set of notes and model cards exceeds the first-release dictionary limit and remains exportable', async ({ page }) => {
  await page.goto('/#/records');
  const full = await readState(page);
  const noteEntries: [string, string][] = [];
  for (let module = 1; module <= 12; module++) {
    const moduleId = `A${String(module).padStart(2, '0')}`;
    for (const suffix of ['A', 'B']) {
      const id = `${moduleId}-${suffix}`;
      noteEntries.push([`prediction:${id}`, `${id}的预测`], [`note:${id}`, `${id}的笔记`]);
      for (const check of ['explain', 'number', 'transfer', 'choice']) noteEntries.push([`response:${id}-${check}`, `${id}的练习记录`]);
    }
    for (const label of ['研究对象', '已知条件', '待求变量', '核心关系', '推导', '反例', '我仍不确定的地方']) noteEntries.push([`card:${moduleId}:${label}`, `${moduleId}的模型卡：${label}`]);
  }
  full.notes = Object.fromEntries(noteEntries);
  expect(Object.keys(full.notes)).toHaveLength(228);
  await importJSON(page, full, 'full-course-notes.json');
  await page.reload();
  expect((await readState(page)).notes).toEqual(full.notes);
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出本课 JSON', exact: true }).click();
  const path = test.info().outputPath('228-notes.json');
  await (await exported).saveAs(path);
  expect(JSON.parse(await readFile(path, 'utf8')).notes).toEqual(full.notes);
});
