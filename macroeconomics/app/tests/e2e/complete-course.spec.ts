import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { lessons } from '../../src/content';

const STORAGE_KEY = 'courses:macroeconomics:v1';
const MICRO_KEY = 'courses:microeconomics:v1';
const screenshotDirectory = fileURLToPath(new URL('../screenshots/', import.meta.url));
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
async function screenshot(page: Page, name: string) {
  await mkdir(screenshotDirectory, { recursive: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${screenshotDirectory}/${name}`, fullPage: true });
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

async function summary(page: Page, id: string, label: string, expectedB: string, expectedA?: string) {
  const row = page.getByTestId(`${id.toLowerCase()}-summary`).getByRole('row').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) });
  await expect(row.getByRole('cell').nth(1)).toHaveText(expectedB);
  if (expectedA !== undefined) await expect(row.getByRole('cell').nth(0)).toHaveText(expectedA);
}
async function dataRow(page: Page, id: string, label: string, values: string[]) {
  const row = page.getByTestId(`${id.toLowerCase()}-results`).getByRole('row').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) });
  const cells = row.getByRole('cell');
  for (let index = 0; index < values.length; index++) await expect(cells.nth(index)).toHaveText(values[index]);
}
async function runAgain(page: Page) {
  await page.getByRole('button', { name: '运行实验', exact: true }).click();
}

test('LA04 shows the actual transition, savings level effects and undefined fixed-A reference under ongoing technical growth', async ({ page }) => {
  await openLab(page, 'LA04');
  await predictAndRun(page, '更高储蓄率先降低本期消费，再改变资本路径与稳态水平。');
  await summary(page, 'LA04', '稳态 k*', '4', '4');
  await summary(page, 'LA04', '稳态 y*', '2');
  await summary(page, 'LA04', '稳态 c*', '1.6');
  await dataRow(page, 'LA04', '0期', ['1', '1', '1', '1', '1', '0.8', '1.1']);
  await page.getByRole('button', { name: '提高储蓄率至40%', exact: true }).click();
  await runAgain(page);
  await summary(page, 'LA04', '稳态 k*', '16', '4');
  await summary(page, 'LA04', '稳态 c*', '2.4', '1.6');
  await dataRow(page, 'LA04', '0期', ['1', '1', '1', '1', '1', '0.6', '1.3']);
  await page.getByRole('button', { name: '设A为当前情景', exact: true }).click();
  const frozen = (await readState(page)).labStates.LA04.baseline;
  await page.getByRole('button', { name: '持续技术增长2%', exact: true }).click();
  await runAgain(page);
  await summary(page, 'LA04', '稳态 k*', '未定义', '16');
  await expect(page.getByRole('alert')).toContainText('固定A');
  expect((await readState(page)).labStates.LA04.baseline).toEqual(frozen);
  await page.getByLabel('实验解释', { exact: true }).fill('长期技术趋势需要新标准化，不沿用固定A稳态。');
  await page.getByRole('button', { name: '重置实验', exact: true }).click();
  await expect(page.getByLabel('实验预测与理由', { exact: true })).toHaveValue('更高储蓄率先降低本期消费，再改变资本路径与稳态水平。');
  await runAgain(page);
  await summary(page, 'LA04', '稳态 k*', '4', '4');
  await expect(page.getByLabel('实验解释', { exact: true })).toHaveValue('长期技术趋势需要新标准化，不沿用固定A稳态。');
});

test('LA05 keeps realized accounts valid during adjustment and distinguishes government purchases from planned saving changes', async ({ page }) => {
  await openLab(page, 'LA05');
  await predictAndRun(page, '消费意愿减少可以降低收入，而外生计划投资下的均衡国民储蓄仍等于30。');
  await summary(page, 'LA05', '均衡产出 Y*', '170', '170');
  await summary(page, 'LA05', '均衡消费 C*', '110');
  await summary(page, 'LA05', '均衡私人储蓄', '40');
  await summary(page, 'LA05', '均衡政府储蓄', '-10');
  await summary(page, 'LA05', '均衡国民储蓄', '30');
  // C=20+.6*(100−20)=68; realized I=30+(100−128)=2.
  // The tax adjustment belongs inside consumption, and eta=.5 gives YNext114.
  await dataRow(page, 'LA05', '0期', ['100', '68', '128', '-28', '2', '2', '114']);
  await page.getByLabel('期初产出 Y₀', { exact: true }).fill('50');
  await runAgain(page);
  // C38 + actual I(-18) + G30 = Y50; negative inventory investment is retained.
  await dataRow(page, 'LA05', '0期', ['50', '38', '98', '-48', '-18', '-18', '74']);
  await page.getByRole('button', { name: '政府购买增加10', exact: true }).click();
  await runAgain(page);
  await summary(page, 'LA05', '均衡产出 Y*', '195', '170');
  await page.getByRole('button', { name: '设A为当前情景', exact: true }).click();
  const frozen = (await readState(page)).labStates.LA05.baseline;
  await page.getByRole('button', { name: '自主消费减少10', exact: true }).click();
  await runAgain(page);
  await summary(page, 'LA05', '均衡产出 Y*', '145', '195');
  await summary(page, 'LA05', '均衡国民储蓄', '30', '30');
  expect((await readState(page)).labStates.LA05.baseline).toEqual(frozen);
  const validRaw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.getByLabel('边际消费倾向 c', { exact: true }).fill('1');
  await expect(page.getByRole('alert')).toContainText(/0.*c.*1|消费倾向/);
  await expect(page.getByRole('button', { name: '运行实验', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '设A为当前情景', exact: true })).toBeDisabled();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(validRaw);
});

test('LA06 demand and cost shocks follow the declared timing and leave the frozen demand benchmark intact', async ({ page }) => {
  await openLab(page, 'LA06');
  await predictAndRun(page, '成本冲击先提高通胀，政策利率通过上一期变量在下一期影响缺口。');
  await summary(page, 'LA06', '第1期产出缺口', '1', '1');
  await summary(page, 'LA06', '第1期通胀', '2.25');
  await summary(page, 'LA06', '第1期预期通胀', '2.125');
  await summary(page, 'LA06', '第1期操作利率', '3.875');
  await page.getByRole('button', { name: '设A为当前情景', exact: true }).click();
  const frozen = (await readState(page)).labStates.LA06.baseline;
  await page.getByRole('button', { name: '成本冲击 +1', exact: true }).click();
  await runAgain(page);
  await summary(page, 'LA06', '第1期产出缺口', '0', '1');
  await summary(page, 'LA06', '第1期通胀', '3', '2.25');
  await summary(page, 'LA06', '第1期预期通胀', '2.5', '2.125');
  await summary(page, 'LA06', '第1期操作利率', '4.5', '3.875');
  await dataRow(page, 'LA06', '2期', ['-0.5', '2.375', '2.4375', '3.3125']);
  expect((await readState(page)).labStates.LA06.baseline).toEqual(frozen);
  await page.getByRole('button', { name: '无冲击基准', exact: true }).click();
  await runAgain(page);
  await dataRow(page, 'LA06', '1期', ['0', '2', '2', '3']);
});

test('LA07 executes all four bank events, replays undo, rejects unsupported payment and exposes negative equity', async ({ page }) => {
  await openLab(page, 'LA07');
  await predictAndRun(page, '发放创造存款；跨行支付转移准备金；偿还减少存款；历史减值减少权益。');
  await page.getByRole('button', { name: '运行10/7/3/8示例', exact: true }).click();
  await dataRow(page, 'LA07', 'A', ['13', '79', '90', '2']);
  await dataRow(page, 'LA07', 'B', ['27', '80', '97', '10']);
  await summary(page, 'LA07', '系统存款', '187', '180');
  await summary(page, 'LA07', '系统净贷款', '159', '160');
  await expect(page.getByTestId('la07-lab').locator('ol li')).toHaveCount(4);
  await page.getByRole('button', { name: '设A为当前情景', exact: true }).click();
  const frozen = (await readState(page)).labStates.LA07.baseline;
  await page.getByRole('button', { name: '撤销最后银行事件', exact: true }).click();
  await dataRow(page, 'LA07', 'A', ['13', '87', '90', '10']);
  await summary(page, 'LA07', '系统净贷款', '167', '159');
  const validRaw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.getByLabel('银行事件金额', { exact: true }).fill('1');
  await page.getByRole('button', { name: '跨行支付', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('存款');
  await expect(page.getByTestId('la07-lab').locator('ol li')).toHaveCount(3);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(validRaw);
  await page.getByLabel('银行事件金额', { exact: true }).fill('12');
  await page.getByRole('button', { name: '确认历史贷款损失', exact: true }).click();
  await dataRow(page, 'LA07', 'A', ['13', '75', '90', '-2']);
  await expect(page.getByRole('alert')).toContainText('权益为负');
  expect((await readState(page)).labStates.LA07.baseline).toEqual(frozen);
  await page.reload();
  await dataRow(page, 'LA07', 'A', ['13', '75', '90', '-2']);
  await page.getByRole('button', { name: '重置实验', exact: true }).click();
  await expect(page.getByLabel('实验预测与理由', { exact: true })).toHaveValue('发放创造存款；跨行支付转移准备金；偿还减少存款；历史减值减少权益。');
  await runAgain(page);
  await dataRow(page, 'LA07', 'A', ['20', '80', '90', '10']);
});

test('LA08 calculates debt amounts and exact ratios and refuses the zero-GDP growth boundary without overwriting records', async ({ page }) => {
  await openLab(page, 'LA08');
  await predictAndRun(page, '比较利率和增长之外，还需保留当期初级赤字口径。');
  await summary(page, 'LA08', '第1期债务率', '62.17647059', '62.17647059');
  await dataRow(page, 'LA08', '1期', ['102', '63.42', '62.17647059', '2.4', '1.02']);
  await page.getByRole('button', { name: '名义增长升至6%', exact: true }).click();
  await runAgain(page);
  await summary(page, 'LA08', '第1期债务率', '59.86792453', '62.17647059');
  await dataRow(page, 'LA08', '1期', ['106', '63.46', '59.86792453', '2.4', '1.06']);
  await page.getByRole('button', { name: '设A为当前情景', exact: true }).click();
  const frozen = (await readState(page)).labStates.LA08.baseline;
  await page.getByRole('button', { name: '初级赤字升至4%', exact: true }).click();
  await runAgain(page);
  await summary(page, 'LA08', '第1期债务率', '65.17647059', '59.86792453');
  expect((await readState(page)).labStates.LA08.baseline).toEqual(frozen);
  const validRaw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.getByLabel('名义 GDP 增长 g', { exact: true }).fill('-100');
  await expect(page.getByRole('alert')).toContainText(/增长率.*大于/);
  await expect(page.getByRole('button', { name: '运行实验', exact: true })).toBeDisabled();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(validRaw);
  await screenshot(page, 'complete-error-la08.png');
});

test('LA09 separates current-account flows from valuation changes and exchange-rate movements from trade-volume responses', async ({ page }) => {
  await openLab(page, 'LA09');
  await predictAndRun(page, '实际贬值只改变相对价格，不在本模型内自动改变进出口量。');
  await summary(page, 'LA09', '经常账户 CA', '-2', '-2');
  await summary(page, 'LA09', '外部净资产变化', '2');
  await summary(page, 'LA09', '实际汇率 q', '7');
  await dataRow(page, 'LA09', '净出口 NX', ['-5', '货币单位/期']);
  await dataRow(page, 'LA09', '可支配国民收入 YD', ['103', '货币单位/期']);
  await dataRow(page, 'LA09', '国民储蓄 S', ['23', '货币单位/期']);
  await page.getByRole('button', { name: '本币价格每外币7.7', exact: true }).click();
  await runAgain(page);
  await summary(page, 'LA09', '实际汇率 q', '7.7', '7');
  await dataRow(page, 'LA09', 'q相对基准变化', ['10', '%']);
  await summary(page, 'LA09', '经常账户 CA', '-2', '-2');
  await page.getByRole('button', { name: '设A为当前情景', exact: true }).click();
  const frozen = (await readState(page)).labStates.LA09.baseline;
  await page.getByRole('button', { name: '进口消费同时增加30', exact: true }).click();
  await runAgain(page);
  await summary(page, 'LA09', '经常账户 CA', '-32', '-2');
  await dataRow(page, 'LA09', '净出口 NX', ['-35', '货币单位/期']);
  expect((await readState(page)).labStates.LA09.baseline).toEqual(frozen);
  const validRaw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.getByLabel('国内生产 Y', { exact: true }).fill('101');
  await expect(page.getByRole('alert')).toContainText('生产与最终使用不一致');
  await expect(page.getByRole('button', { name: '设A为当前情景', exact: true })).toBeDisabled();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(validRaw);
  await expect(page.locator('main')).not.toContainText(/NaN|Infinity/);
});

test('new experiment inputs and scrollable numeric alternatives work with keyboard at 390px and 1440px', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLab(page, 'LA04');
  await page.getByLabel('实验预测与理由', { exact: true }).focus();
  await page.keyboard.type('用键盘改变储蓄率并核对完整数字表。');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '保存实验预测', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByLabel('储蓄率 s', { exact: true }).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('40');
  await page.getByRole('button', { name: '运行实验', exact: true }).focus();
  await page.keyboard.press('Enter');
  await summary(page, 'LA04', '稳态 k*', '16');
  await noOverflow(page);
  const numericTable = page.getByTestId('la04-results').locator('..');
  await numericTable.focus();
  await expect(numericTable).toBeFocused();
  expect(await numericTable.evaluate(element => getComputedStyle(element).overflowX)).toBe('auto');
  expect(await numericTable.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => numericTable.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await expect(page.getByTestId('la04-lab').getByRole('img')).toHaveCount(3);
  for (const svg of await page.getByTestId('la04-lab').getByRole('img').all()) expect(await svg.getAttribute('aria-label')).toBeTruthy();
  await screenshot(page, 'complete-mobile-la04.png');
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const id of ['LA05', 'LA06', 'LA07', 'LA08', 'LA09']) {
    await openLab(page, id);
    await page.getByRole('button', { name: '跳过预测', exact: true }).click();
    await runAgain(page);
    await noOverflow(page);
    await expect(page.getByTestId(`${id.toLowerCase()}-results`)).toBeVisible();
  }
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await screenshot(page, 'complete-desktop-la09.png');
});

const REPORT_SECTIONS = ['发生了什么', '如何测量', '核算约束', '机制比较', '支持与反对的证据', '政策作用及代价', '目前不知道'];
const CAPSTONE_RUBRIC = ['区分定义、核算、行为与价值判断', '完成名义—实际转换和账表对账', '比较至少两个模型的机制与边界', '记录参数敏感性与可区分解释的证据', '注明合成数据、来源与观测时期', '明确不确定性并避免把反事实当预测'];

async function capstoneRow(page: Page, table: string, label: string | RegExp, values: string[]) {
  const row = page.getByTestId(table).getByRole('row').filter({ has: page.getByRole('rowheader', { name: label, exact: typeof label === 'string' }) });
  for (let index = 0; index < values.length; index++) await expect(row.getByRole('cell').nth(index)).toHaveText(values[index]);
}

test('the capstone recomputes measurement, balances, four mechanisms and sensitivity and preserves the report through refresh and export', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/lesson/A12-B');
  await page.getByLabel('学习笔记', { exact: true }).fill('A12-B测试笔记：比较机制与证据。');
  await page.getByRole('link', { name: '终课作品 · 宏观诊断', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('宏观诊断工作台');
  await capstoneRow(page, 'capstone-measurement', '1期', ['67.1', '44', '152.5']);
  await capstoneRow(page, 'capstone-balance', 'A', ['13', '79', '90', '2']);
  await capstoneRow(page, 'capstone-balance', 'B', ['27', '80', '97', '10']);
  // Independent arithmetic: k1=1.1, y1=A*sqrt(k1); demand multiplier=2.5;
  // joint demand(-1)/cost(+1) gives pi1=2.75, and loss8 leaves A equity2.
  await capstoneRow(page, 'capstone-comparison', /^长期供给/, ['1.04880885', '1.25857062', '1.37869504', '产出/工人/期']);
  await capstoneRow(page, 'capstone-comparison', /^短期需求/, ['170', '145', '132.5', '货币单位/期']);
  await capstoneRow(page, 'capstone-comparison', /^成本与预期/, ['2', '2.75', '3.125', '百分数']);
  await capstoneRow(page, 'capstone-comparison', /^金融约束/, ['10', '2', '-2', '货币单位']);
  await page.getByLabel('作品标题', { exact: true }).fill('教学测试：成本冲击与需求不足的机制比较');
  for (const section of REPORT_SECTIONS) await page.getByLabel(`终课报告 ${section}`, { exact: true }).fill(`${section}：只使用教学合成情景，区分对象、核算、条件与可检验证据。`);
  await page.getByLabel('终课不确定性清单', { exact: true }).fill('潜在产出、实际政策规则和冲击来源未经现实识别。');
  for (const criterion of CAPSTONE_RUBRIC) await page.getByRole('checkbox', { name: criterion, exact: true }).check();
  await expect(page.getByText('6 / 6 项由你自评', { exact: false })).toBeVisible();
  const beforeRefresh = await readState(page);
  expect(beforeRefresh.capstone.models).toHaveLength(4);
  expect(Object.values(beforeRefresh.capstone.rubric).filter(Boolean)).toHaveLength(6);
  await page.reload();
  await expect(page.getByLabel('作品标题', { exact: true })).toHaveValue('教学测试：成本冲击与需求不足的机制比较');
  for (const section of REPORT_SECTIONS) await expect(page.getByLabel(`终课报告 ${section}`, { exact: true })).toHaveValue(beforeRefresh.capstone.report[section]);
  expect((await readState(page)).capstone).toEqual(beforeRefresh.capstone);
  await noOverflow(page);
  await screenshot(page, 'complete-desktop-capstone.png');
  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出作品文本', exact: true }).click();
  const reportPath = test.info().outputPath('synthetic-capstone.txt');
  await (await reportDownload).saveAs(reportPath);
  const report = await readFile(reportPath, 'utf8');
  expect(report).toContain('教学合成情景 synthetic');
  expect(report).toContain('敏感性');
  const nominalMatch = report.match(/名义—实际：第1期 N=([^，]+)，R=([^\n]+)/);
  expect(nominalMatch).not.toBeNull();
  expect(Number(nominalMatch![1])).toBeCloseTo(67.1, 8);
  expect(Number(nominalMatch![2])).toBeCloseTo(44, 8);
  for (const section of REPORT_SECTIONS) expect(report).toContain(beforeRefresh.capstone.report[section]);
  await page.getByRole('checkbox', { name: '长期供给 / 资本与技术', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: '金融约束 / 银行损失', exact: true }).uncheck();
  await expect(page.getByTestId('capstone-comparison').locator('tbody tr')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '导出作品文本', exact: true })).toBeEnabled();
  await page.getByRole('checkbox', { name: '短期需求 / 计划支出', exact: true }).uncheck();
  await expect(page.getByRole('alert')).toContainText('至少两个模型');
  await expect(page.getByRole('button', { name: '导出作品文本', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: '短期需求 / 计划支出', exact: true }).check();
  const saved = await readState(page);
  await page.getByRole('link', { name: '导出含全部原始参数的学习 JSON', exact: true }).click();
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出本课 JSON', exact: true }).click();
  const jsonPath = test.info().outputPath('capstone-roundtrip.json');
  await (await jsonDownload).saveAs(jsonPath);
  const exported = JSON.parse(await readFile(jsonPath, 'utf8'));
  expect(exported.capstone).toEqual(saved.capstone);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '清空本课全部记录', exact: true }).click();
  await importJSON(page, exported, 'capstone-roundtrip.json');
  await page.goto('/#/capstone');
  await expect(page.getByLabel('终课不确定性清单', { exact: true })).toHaveValue(saved.capstone.uncertainty);
  expect((await readState(page)).capstone).toEqual(saved.capstone);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '重置终课作品', exact: true }).click();
  expect((await readState(page)).notes['note:A12-B']).toBe('A12-B测试笔记：比较机制与证据。');
  await expect(page.getByLabel('终课报告 发生了什么', { exact: true })).toHaveValue('');
});

test('invalid capstone drafts and invalid bank benchmark imports leave valid local records intact', async ({ page }) => {
  await page.goto('/#/capstone');
  const validRaw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.getByLabel('终课历史贷款损失', { exact: true }).fill('41');
  await expect(page.getByRole('alert')).toContainText('creditLoss');
  await expect(page.getByRole('button', { name: '导出作品文本', exact: true })).toBeDisabled();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(validRaw);
  await page.getByLabel('终课历史贷款损失', { exact: true }).fill('8');
  await expect(page.getByRole('button', { name: '导出作品文本', exact: true })).toBeEnabled();
  await page.goto('/#/records');
  const valid = await readState(page);
  const validBeforeImport = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  valid.labStates.LA07.baseline.initial.A.equity += 1;
  await page.getByLabel('导入本课 JSON', { exact: true }).setInputFiles({ name: 'unbalanced-bank-baseline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(valid)) });
  await expect(page.getByRole('status')).toContainText(/银行资产|账表|资产应等于/);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(validBeforeImport);
  await page.goto('/#/capstone');
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.getByLabel('终课需求冲击', { exact: true }).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('0');
  await capstoneRow(page, 'capstone-comparison', /^成本与预期/, ['2', '3', '3.5', '百分数']);
  await noOverflow(page);
  await page.reload();
  await expect(page.getByLabel('终课需求冲击', { exact: true })).toHaveValue('0');
  await screenshot(page, 'complete-mobile-capstone.png');
});

test('LA07 continues an imported event sequence with gaps and rejects a payment beyond available reserves', async ({ page }) => {
  await page.goto('/#/records');
  const imported = await readState(page);
  imported.labStates.LA07.input.events = [{ id: 'imported-loan-10', sequence: 10, type: 'loan', amount: 30 }];
  imported.labStates.LA07.prediction = '新增存款超过准备金不意味着可以无限跨行支付。';
  imported.labStates.LA07.hasRun = true;
  await importJSON(page, imported, 'bank-sequence-gap.json');
  await openLab(page, 'LA07');
  await dataRow(page, 'LA07', 'A', ['20', '110', '120', '10']);
  const validBeforePayment = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.getByLabel('银行事件金额', { exact: true }).fill('21');
  await page.getByRole('button', { name: '跨行支付', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('准备金');
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(validBeforePayment);
  await page.getByLabel('银行事件金额', { exact: true }).fill('7');
  await page.getByRole('button', { name: '跨行支付', exact: true }).click();
  await dataRow(page, 'LA07', 'A', ['13', '110', '113', '10']);
  await dataRow(page, 'LA07', 'B', ['27', '80', '97', '10']);
  const validEvents = (await readState(page)).labStates.LA07.input.events;
  expect(validEvents.map((event: { sequence: number }) => event.sequence)).toEqual([10, 11]);
  await page.reload();
  expect((await readState(page)).labStates.LA07.input.events).toEqual(validEvents);
  await page.getByRole('button', { name: '撤销最后银行事件', exact: true }).click();
  await dataRow(page, 'LA07', 'A', ['20', '110', '120', '10']);
});
