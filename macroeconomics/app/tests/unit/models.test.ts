import { describe, expect, it } from 'vitest';
import {
  computeAccounts, computePrices, defaultAccountsInput, defaultPriceInput, initialLedger,
  pricePresets, reduceLedger, replayLedger, syntheticMetadata, validateLedger,
  type AccountsInput, type LedgerEvent, type LedgerState,
} from '../../src/models';
import { productionFixture } from '../../src/data/synthetic';

const events: LedgerEvent[] = [
  { id: 'w20', sequence: 1, type: 'wage', amount: 20 },
  { id: 'c10', sequence: 2, type: 'service', amount: 10 },
  { id: 'r5', sequence: 3, type: 'repayment', amount: 5 },
];
const totalDeposits = (state: LedgerState) => state.H.deposit + state.F.deposit;
const accounts = (patch: Partial<AccountsInput> = {}) => computeAccounts({ ...defaultAccountsInput(), ...patch });
const equalThreeMethods = (input: Partial<AccountsInput>, oracle: number) => {
  const result = accounts(input);
  expect(result.production).toBeCloseTo(oracle, 8);
  expect(result.expenditure).toBeCloseTo(oracle, 8);
  expect(result.income).toBeCloseTo(oracle, 8);
  return result;
};

describe('LA01 事件驱动账本', () => {
  it('默认三步oracle，包括独立收入/费用与本金科目', () => {
    const result = replayLedger(initialLedger(), events);
    expect(result.H).toEqual({ deposit: 110, netWorth: 110 });
    expect(result.F).toEqual({ deposit: 25, loan: 15, netWorth: 10 });
    expect(result.B).toEqual({ reserves: 160, loanAsset: 15, depositH: 110, depositF: 25, equity: 40 });
    expect(result.flow).toEqual({ householdIncome: 20, householdConsumption: 10, firmRevenue: 10, firmWages: 20, principalRepaid: 5 });
    expect(result.flow.householdIncome - result.flow.householdConsumption).toBe(result.H.netWorth - 100);
    expect(result.flow.firmRevenue - result.flow.firmWages).toBe(result.F.netWorth - 20);
  });

  it('每步核验三张账表、贷款与存款双边', () => {
    let state = initialLedger();
    for (const event of events) {
      state = reduceLedger(state, event);
      expect(() => validateLedger(state)).not.toThrow();
      expect(state.H.deposit).toBe(state.H.netWorth);
      expect(state.F.deposit).toBe(state.F.loan + state.F.netWorth);
      expect(state.B.reserves + state.B.loanAsset).toBe(state.B.depositH + state.B.depositF + state.B.equity);
      expect(state.H.deposit).toBe(state.B.depositH);
      expect(state.F.deposit).toBe(state.B.depositF);
      expect(state.F.loan).toBe(state.B.loanAsset);
    }
  });

  it('工资和消费保持总存款；本金偿还减少总存款，不减少净值', () => {
    const wage = reduceLedger(initialLedger(), events[0]);
    const service = reduceLedger(wage, events[1]);
    const repayment = reduceLedger(service, events[2]);
    expect(totalDeposits(wage)).toBe(140);
    expect(totalDeposits(service)).toBe(140);
    expect(totalDeposits(repayment)).toBe(135);
    expect(repayment.F.netWorth).toBe(service.F.netWorth);
    expect(repayment.B.equity).toBe(service.B.equity);
    expect(repayment.flow.firmWages).toBe(service.flow.firmWages);
    expect(repayment.flow.householdConsumption).toBe(service.flow.householdConsumption);
  });

  it('每种交易可以单独应用，不能把工资/消费误当纯资产交换', () => {
    expect(reduceLedger(initialLedger(), { ...events[0], amount: 20 }).F.netWorth).toBe(0);
    expect(reduceLedger(initialLedger(), { ...events[1], sequence: 1 }).F.netWorth).toBe(30);
    const repaid = reduceLedger(initialLedger(), { ...events[2], sequence: 1 });
    expect(repaid.F).toEqual({ deposit: 35, loan: 15, netWorth: 20 });
    expect(repaid.B.equity).toBe(40);
  });

  it('通过源事件重放撤销，重置恢复初始且不污染原数据', () => {
    const initial = initialLedger();
    const initialCopy = structuredClone(initial);
    const eventsCopy = structuredClone(events);
    const final = replayLedger(initial, events);
    const undone = replayLedger(initial, events.slice(0, -1));
    expect(undone.F).toEqual({ deposit: 30, loan: 20, netWorth: 10 });
    expect(totalDeposits(undone)).toBe(140);
    expect(replayLedger(initial, [])).toEqual(initial);
    expect(initial).toEqual(initialCopy); expect(events).toEqual(eventsCopy);
    final.H.deposit = 1;
    expect(initial.H.deposit).toBe(100);
  });

  it('两位小数按整数最小单位精确结算，保留负净值的合法资产负债表', () => {
    const result = replayLedger(initialLedger(), [
      { id: 'a', sequence: 1, type: 'wage', amount: 0.1 },
      { id: 'b', sequence: 2, type: 'wage', amount: 0.2 },
    ]);
    expect(result.H.deposit).toBe(100.3); expect(result.F.deposit).toBe(39.7);
    expect(result.flow.householdIncome).toBe(0.3);
    expect(reduceLedger(initialLedger(), { ...events[0], amount: 40 }).F.netWorth).toBe(-20);
  });

  it.each([
    ['wage', 41, '企业可用存款'], ['service', 101, '家庭可用存款'],
    ['repayment', 41, '企业可用存款'], ['repayment', 21, '未偿贷款'],
  ] as const)('拒绝超约束 %s %s', (type, amount, message) => {
    expect(() => reduceLedger(initialLedger(), { id: 'invalid', sequence: 1, type, amount })).toThrow(message);
  });

  it.each([0, -1, NaN, Infinity, -Infinity, 1_000_000_001, 0.001, 1e-9, Number.MIN_VALUE])('拒绝非法交易金额 %s', amount => {
    expect(() => reduceLedger(initialLedger(), { ...events[0], amount })).toThrow();
  });

  it('重复事件不能执行两次，顺序不可重复或倒置', () => {
    const state = reduceLedger(initialLedger(), events[0]);
    expect(() => reduceLedger(state, events[0])).toThrow('重复');
    expect(() => replayLedger(initialLedger(), [events[0], { ...events[0], sequence: 2 }])).toThrow('重复');
    expect(() => replayLedger(initialLedger(), [events[1], events[0]])).toThrow('顺序');
    expect(() => reduceLedger(state, { ...events[1], sequence: 1 })).toThrow('顺序');
    expect(() => reduceLedger(initialLedger(), { ...events[0], sequence: 0 })).toThrow('顺序');
  });

  it('拒绝未知事件、无ID、坏初始账表，不用调整项补平', () => {
    expect(() => reduceLedger(initialLedger(), { ...events[0], type: 'loan' } as unknown as LedgerEvent)).toThrow('未知事件');
    expect(() => reduceLedger(initialLedger(), { ...events[0], id: '' })).toThrow('ID');
    const bad = initialLedger(); bad.F.netWorth = 21;
    expect(() => replayLedger(bad, [])).toThrow('企业源账表不平衡');
    const mismatch = initialLedger(); mismatch.B.depositH = 101; mismatch.B.equity = 39;
    expect(() => replayLedger(mismatch, [])).toThrow('存款双边');
    const wrongLoan = initialLedger(); wrongLoan.B.loanAsset = 21; wrongLoan.B.equity = 41;
    expect(() => replayLedger(wrongLoan, [])).toThrow('贷款双边');
    const invalid = initialLedger(); invalid.H.deposit = NaN;
    expect(() => replayLedger(invalid, [])).toThrow('有限数');
    expect(() => replayLedger(reduceLedger(initialLedger(), events[0]), [])).toThrow('初始账表');
    const phantomFlow = initialLedger(); phantomFlow.flow.householdIncome = 20;
    expect(() => replayLedger(phantomFlow, [])).toThrow('收入费用双边');
    phantomFlow.flow.firmWages = 20;
    expect(() => replayLedger(phantomFlow, [])).toThrow('本期流量必须为0');
  });
});

describe('LA02 活动源记录派生GDP三法', () => {
  it('基础GDP100，消除中间重复计入，收入不是额外GDP', () => {
    const result = equalThreeMethods({}, 100);
    expect(result.productionRows.map(row => row.valueAdded)).toEqual([30, 20, 50]);
    expect(result.salesTotal).toBe(180);
    expect(result.wages).toBe(65); expect(result.surplus).toBe(35);
    expect(result.components).toEqual({ C: 100, I: 0, G: 0, X: 0, M: 0 });
    expect(result.production).not.toBe(result.salesTotal);
    expect(result.income).not.toBe(result.components.C + result.wages);
  });

  it('当期未售20转入存货，不能在消费100之外重复加入', () => {
    const result = equalThreeMethods({ inventory: 20 }, 100);
    expect(result.components.C).toBe(80); expect(result.components.I).toBe(20);
    expect(result.expenditure).not.toBe(120);
  });

  it('出口20且未售10：C70/I10/X20', () => {
    expect(equalThreeMethods({ inventory: 10, exports: 20 }, 100).components).toEqual({ C: 70, I: 10, G: 0, X: 20, M: 0 });
  });

  it('进口最终消费30：C130/M30，遗漏进口冲销会误算', () => {
    const result = equalThreeMethods({ imports: 30 }, 100);
    expect(result.components.C).toBe(130); expect(result.components.M).toBe(30);
    expect(result.components.C + result.components.I + result.components.G + result.components.X).toBe(130);
    expect(result.activities.find(row => row.id === 'imports')?.origin).toBe('foreign');
  });

  it('本国新增机器40：明确新增生产、资本形成和工资25/盈余15', () => {
    const result = equalThreeMethods({ machine: true }, 140);
    expect(result.components.I).toBe(40);
    expect(result.productionRows.find(row => row.id === 'machine')).toMatchObject({ output: 40, valueAdded: 40, wages: 25, surplus: 15 });
    expect(result.wages).toBe(90); expect(result.surplus).toBe(50);
  });

  it.each([
    ['transfer', 10, 'transfer'], ['stock', 50, 'financial'], ['secondhand', 20, 'financial'],
  ] as const)('%s不直接计入新增生产，解释有明确原因', (key, amount, kind) => {
    const result = equalThreeMethods({ [key]: amount }, 100);
    expect(result.components.I).toBe(0); expect(result.components.G).toBe(0);
    const activity = result.activities.find(row => row.id === key);
    expect(activity?.kind).toBe(kind);
    expect(activity?.explanation.length).toBeGreaterThan(20);
  });

  it('前期库存销售20：C+20/I−20，期初明确且期末库存0', () => {
    const result = equalThreeMethods({ oldInventorySale: 20 }, 100);
    expect(result.components.C).toBe(120); expect(result.components.I).toBe(-20);
    expect(result.closingInventory).toBe(0);
    expect(result.activities.find(row => row.id === 'old-inventory-sale')).toMatchObject({ period: 'previous', use: 'inventory', amount: 20 });
  });

  it('全部事件组合仍一致，活动与三侧表可追溯且不污染源', () => {
    const source = structuredClone(productionFixture);
    const result = equalThreeMethods({ inventory: 10, exports: 20, imports: 30, machine: true, transfer: 10, stock: 50, secondhand: 20, oldInventorySale: 20 }, 140);
    expect(result.components).toEqual({ C: 120, I: 30, G: 0, X: 20, M: 30 });
    expect(result.closingInventory).toBe(10);
    const ids = result.activities.map(activity => activity.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of [...result.productionRows, ...result.expenditureRows, ...result.incomeRows]) {
      expect(row.sourceIds.length).toBeGreaterThan(0);
      row.sourceIds.forEach(id => expect(ids).toContain(id));
    }
    expect(productionFixture).toEqual(source);
  });

  it('期初库存下限与当期成品总值约束', () => {
    expect(() => accounts({ oldInventorySale: 21 })).toThrow('期初库存');
    expect(() => accounts({ openingInventory: 0, oldInventorySale: 1 })).toThrow('期初库存');
    expect(() => accounts({ openingInventory: -1 })).toThrow('有限数');
    expect(() => accounts({ inventory: 80, exports: 30 })).toThrow('超过100');
    expect(equalThreeMethods({ inventory: 100 }, 100).components.C).toBe(0);
  });

  it.each([-1, NaN, Infinity, 1_000_000_001])('拒绝非法金额 %s', imports => {
    expect(() => accounts({ imports })).toThrow('有限数');
  });

  it('拒绝收入与生产矛盾、最终使用不匹配或重复生产的源记录', () => {
    const wrongIncome = structuredClone(productionFixture); wrongIncome[0].wages = 21;
    expect(() => computeAccounts(defaultAccountsInput(), wrongIncome)).toThrow('源记录不平衡');
    const wrongProduction = structuredClone(productionFixture); wrongProduction[2].output = 101; wrongProduction[2].surplus = 21;
    expect(() => computeAccounts(defaultAccountsInput(), wrongProduction)).toThrow('源记录不平衡');
    expect(() => computeAccounts(defaultAccountsInput(), [...productionFixture, productionFixture[0]])).toThrow('重复');
    const badSource = structuredClone(productionFixture); badSource[0].output = Infinity;
    expect(() => computeAccounts(defaultAccountsInput(), badSource)).toThrow('有限数');
    expect(() => computeAccounts({ ...defaultAccountsInput(), machine: 40 } as unknown as AccountsInput)).toThrow('是或否');
  });

  it('即使三法表面合计100，也拒绝不匹配的中间供应与隐含最终使用', () => {
    const source = [
      { id: 'raw', label: '原料商', output: 40, intermediate: 0, wages: 30, surplus: 10 },
      { id: 'processor', label: '加工商', output: 50, intermediate: 30, wages: 15, surplus: 5 },
      { id: 'final', label: '成品商', output: 90, intermediate: 50, wages: 25, surplus: 15 },
    ];
    expect(source.reduce((sum, row) => sum + row.output - row.intermediate, 0)).toBe(100);
    expect(() => computeAccounts(defaultAccountsInput(), source)).toThrow('源记录不平衡');
  });
});

describe('LA03 原始p/q唯一源的产出、指数与增长', () => {
  it('三期N/R/D/L完整oracle', () => {
    const result = computePrices(defaultPriceInput()).periods;
    const oracle = [
      { N: 40, R: 40, D: 100, L: 100 },
      { N: 61, R: 44, D: 138.63636363636363, L: 137.5 },
      { N: 62.22, R: 44, D: 141.4090909090909, L: 140.25 },
    ];
    result.forEach((period, index) => {
      for (const key of ['N', 'R', 'D', 'L'] as const) expect(period[key]).toBeCloseTo(oracle[index][key], 8);
    });
    expect(result[0].gN).toBeNull(); expect(result[0].piL).toBeNull();
    expect(result[1].gN).toBeCloseTo(0.525, 8); expect(result[1].gR).toBeCloseTo(0.1, 8);
    expect(result[1].piD).toBeCloseTo(0.38636363636363635, 8); expect(result[1].piL).toBeCloseTo(0.375, 8);
    expect(result[2].gN).toBeCloseTo(0.02, 8); expect(result[2].gR).toBeCloseTo(0, 8);
    expect(result[2].piD).toBeCloseTo(0.02, 8); expect(result[2].piL).toBeCloseTo(0.02, 8);
    expect(result[2].L).toBeGreaterThan(100);
  });

  it('增长为精确乘法关系，简单相减不是平减指数通胀', () => {
    const result = computePrices(defaultPriceInput()).periods;
    for (const period of result.slice(1)) {
      expect(1 + period.gN!).toBeCloseTo((1 + period.gR!) * (1 + period.piD!), 8);
    }
    expect(result[1].gN! - result[1].gR!).not.toBeCloseTo(result[1].piD!, 8);
  });

  it('价格变而数量不变，实际产出不变', () => {
    const result = computePrices(pricePresets.priceOnly()).periods;
    expect(result.map(period => period.R)).toEqual([40, 40, 40]);
    expect(result[1].gR).toBe(0); expect(result[1].N).toBe(55);
  });

  it('数量全按1.2倍变而价格不变，名义/实际同增且指数不变', () => {
    const result = computePrices(pricePresets.quantityOnly()).periods;
    expect(result[1]).toMatchObject({ N: 48, R: 48, D: 100, L: 100 });
    expect(result[1].gN).toBeCloseTo(0.2, 8); expect(result[1].gR).toBeCloseTo(0.2, 8);
    expect(result[1].piD).toBe(0); expect(result[1].piL).toBe(0);
  });

  it('改变数量组合可保持固定价格总值，却改变商品构成', () => {
    const result = computePrices(pricePresets.composition()).periods;
    expect(result[0].R).toBe(40); expect(result[1].R).toBe(40);
    expect(result[0].realContributions).toEqual({ x: 20, y: 20 });
    expect(result[1].realContributions).toEqual({ x: 24, y: 16 });
  });

  it('100→1000只是表示变更，不改变任何增长或通胀', () => {
    const input = defaultPriceInput();
    const a = computePrices(input).periods;
    const b = computePrices({ ...input, normalization: 1000 }).periods;
    a.forEach((period, i) => {
      expect(b[i].N).toBe(period.N); expect(b[i].R).toBe(period.R);
      expect(b[i].D).toBeCloseTo(period.D! * 10, 8); expect(b[i].L).toBeCloseTo(period.L! * 10, 8);
      for (const key of ['gN', 'gR', 'piD', 'piL'] as const) {
        if (period[key] === null) expect(b[i][key]).toBeNull();
        else expect(b[i][key]).toBeCloseTo(period[key]!, 8);
      }
    });
  });

  it('真正更改实际价格权重，可以把实际增长10%变为10.90909%', () => {
    const original = defaultPriceInput();
    const a = computePrices(original).periods;
    const b = computePrices({ ...original, priceBase: 1 }).periods;
    expect(a[1].gR).toBeCloseTo(0.1, 8);
    expect(b[1].gR).toBeCloseTo(6 / 55, 8);
    expect(b[1].gR).not.toBeCloseTo(a[1].gR!, 8);
    expect(b[1].N).toBe(a[1].N);
    expect(b[1].L).toBe(a[1].L);
  });

  it('更改篮子影响固定篮子指数，其权重由基准支出生成', () => {
    const input = defaultPriceInput();
    const a = computePrices(input).periods;
    const b = computePrices({ ...input, basketBase: 1 }).periods;
    expect(a[0].basketWeights).toEqual({ x: 0.5, y: 0.5 });
    expect(b[1].L).toBe(100);
    expect(b[0].basketWeights.x).toBeCloseTo(36 / 61, 8);
    expect(b[1].piL).not.toBeCloseTo(a[1].piL!, 8);
  });

  it('零实际产出/零篮子/前期水平0时返回未定义，不伪装成0或Infinity', () => {
    const input = defaultPriceInput(); input.periods[0].qx = 0; input.periods[0].qy = 0;
    const result = computePrices(input).periods;
    expect(result[0]).toMatchObject({ N: 0, R: 0, D: null, L: null });
    expect(result[1].gN).toBeNull(); expect(result[1].gR).toBeNull(); expect(result[1].piD).toBeNull();
    expect(result.every(period => period.L === null && period.piL === null)).toBe(true);
    expect(result[0].basketWeights).toEqual({ x: null, y: null });
    expect(JSON.stringify(result)).not.toContain('Infinity');
    expect(result[2].gN).toBeCloseTo(0.02, 8);
  });

  it('中途零产出不会令下一期增长从0伪装成0%', () => {
    const input = defaultPriceInput(); input.periods[1].qx = 0; input.periods[1].qy = 0;
    const periods = computePrices(input).periods;
    expect(periods[1].gN).toBe(-1); expect(periods[1].D).toBeNull();
    expect(periods[2].gN).toBeNull(); expect(periods[2].gR).toBeNull(); expect(periods[2].piD).toBeNull();
  });

  it.each([0, -1, NaN, Infinity, 1_000_000_001])('拒绝非法价格 %s', px => {
    const input = defaultPriceInput(); input.periods[1].px = px;
    expect(() => computePrices(input)).toThrow('第1期x价格');
  });

  it.each([-1, NaN, Infinity, 1_000_000_001])('拒绝非法数量 %s', qy => {
    const input = defaultPriceInput(); input.periods[1].qy = qy;
    expect(() => computePrices(input)).toThrow('第1期y数量');
  });

  it('拒绝非法时期/基准/归一化，不改变原始输入和冻结基准', () => {
    const original = defaultPriceInput(); const copy = structuredClone(original);
    computePrices(original);
    expect(original).toEqual(copy);
    expect(() => computePrices({ ...original, priceBase: 3 })).toThrow('合成时期');
    expect(() => computePrices({ ...original, basketBase: -1 })).toThrow('合成时期');
    expect(() => computePrices({ ...original, periods: [] })).toThrow('1到12');
    expect(() => computePrices({ ...original, normalization: 1 } as never)).toThrow('100或1000');
    const preset = pricePresets.priceOnly(); preset.periods[0].px = 99;
    expect(pricePresets.priceOnly().periods[0].px).toBe(2);
    expect(defaultPriceInput().periods[0].px).toBe(2);
  });

  it('有限原始数据造成派生上溢或下溢时明确报错，不返回Infinity或伪零', () => {
    expect(() => computePrices({ periods: [
      { px: Number.MIN_VALUE, py: 1, qx: 1, qy: 0 }, { px: 1, py: 1, qx: 1, qy: 0 },
    ], priceBase: 0, basketBase: 0, normalization: 100 })).toThrow('有限数值范围');
    expect(() => computePrices({ periods: [
      { px: Number.MIN_VALUE, py: 1, qx: Number.MIN_VALUE, qy: 0 },
    ], priceBase: 0, basketBase: 0, normalization: 100 })).toThrow('数值精度');
  });
});

it('数据显著合成标注、明确单位/合成时期/生成规则', () => {
  expect(syntheticMetadata.dataKind).toBe('synthetic');
  expect(syntheticMetadata.label).toBe('教学合成数据');
  expect(syntheticMetadata.periodLabels).toEqual(['第0期', '第1期', '第2期']);
  expect(syntheticMetadata.units.ledger).toContain('存量');
  expect(syntheticMetadata.generationRules.LA01).toContain('边界外');
});
