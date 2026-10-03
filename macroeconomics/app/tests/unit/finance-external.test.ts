import { describe, expect, it } from "vitest";
import {
  applyCreditEvent, creditRisk, defaultCreditState, replayCreditEvents, validateCreditState,
  type CreditEvent, type CreditState,
} from "../../src/models/credit";
import { defaultDebtParameters, simulateDebt } from "../../src/models/debt";
import { calculateExternal, defaultExternalParameters } from "../../src/models/external";

const sequence: CreditEvent[] = [
  { id: "loan-1", sequence: 1, type: "loan", amount: 10 },
  { id: "payment-1", sequence: 2, type: "payment", amount: 7 },
  { id: "repayment-1", sequence: 3, type: "repayment", amount: 3 },
  { id: "loss-1", sequence: 4, type: "loss", amount: 8 },
];

function event(type: CreditEvent["type"], amount: number, n = 1): CreditEvent {
  return { id: `test-${n}`, sequence: n, type, amount };
}

function totals(state: CreditState): { deposits: number; loans: number; reserves: number } {
  return { deposits: state.A.depositLiability + state.B.depositLiability, loans: state.A.loanAsset + state.B.loanAsset, reserves: state.A.reserves + state.B.reserves };
}

describe("LA07 客户分户、贷款、结算与损失", () => {
  it("起始历史客户完整，六张客户账表与两家银行逐一平衡", () => {
    const state = defaultCreditState();
    expect(Object.keys(state.customers)).toHaveLength(6);
    expect(totals(state)).toEqual({ deposits: 180, loans: 160, reserves: 40 });
    expect(() => validateCreditState(state)).not.toThrow();
    for (const customer of Object.values(state.customers))
      expect(customer.deposit + customer.otherAssets).toBe(customer.loan + customer.netWorth);
  });

  it("四步oracle分别来自独立的源账户变动", () => {
    const initial = defaultCreditState();
    const states = sequence.map((_, index) => replayCreditEvents(initial, sequence.slice(0, index + 1)));
    expect(states.map(totals)).toEqual([
      { deposits: 190, loans: 170, reserves: 40 },
      { deposits: 190, loans: 170, reserves: 40 },
      { deposits: 187, loans: 167, reserves: 40 },
      { deposits: 187, loans: 159, reserves: 40 },
    ]);
    const state = states[3];
    expect([state.A.reserves, state.A.loanAsset, state.A.depositLiability, state.A.equity]).toEqual([13, 79, 90, 2]);
    expect([state.B.reserves, state.B.loanAsset, state.B.depositLiability, state.B.equity]).toEqual([27, 80, 97, 10]);
    expect(state.customers.newBorrower).toEqual({ bank: "A", deposit: 0, loan: 7, otherAssets: 0, netWorth: -7 });
    expect(state.customers.recipient).toEqual({ bank: "B", deposit: 7, loan: 0, otherAssets: 0, netWorth: 7 });
    for (const step of states) expect(() => validateCreditState(step)).not.toThrow();
  });

  it("确认历史债权减值保留合同本金，用显式减值桥接双边；不扣存款", () => {
    const state = applyCreditEvent(defaultCreditState(), event("loss", 8));
    expect(state.A.loans.historicalBorrowerA).toBe(72);
    expect(state.A.lossAllowances.historicalBorrowerA).toBe(8);
    expect(state.customers.historicalBorrowerA.loan).toBe(80);
    expect(state.customers.historicalBorrowerA.netWorth).toBe(0);
    expect(state.A.depositLiability).toBe(90);
    expect(state.A.equity).toBe(2);
  });

  it("跨行支付改变银行准备金与存款归属，系统准备金和存款不变", () => {
    const before = replayCreditEvents(defaultCreditState(), sequence.slice(0, 1));
    const after = applyCreditEvent(before, sequence[1]);
    expect(totals(after)).toEqual(totals(before));
    expect(after.A.deposits.newBorrower).toBe(3);
    expect(after.B.deposits.recipient).toBe(7);
    expect(after.A.equity).toBe(before.A.equity);
    expect(after.B.equity).toBe(before.B.equity);
  });

  it("本金偿还同比减少存款与贷款，双方净值不变", () => {
    const before = replayCreditEvents(defaultCreditState(), sequence.slice(0, 2));
    const after = applyCreditEvent(before, sequence[2]);
    expect(totals(after).deposits - totals(before).deposits).toBe(-3);
    expect(totals(after).loans - totals(before).loans).toBe(-3);
    expect(after.customers.newBorrower.netWorth).toBe(before.customers.newBorrower.netWorth);
    expect(after.A.equity).toBe(before.A.equity);
  });

  it("冻结A、调用reducer与重放撤销均不修改源对象或事件", () => {
    const initial = defaultCreditState();
    const copy = structuredClone(initial);
    const eventsCopy = structuredClone(sequence);
    const A = replayCreditEvents(initial, sequence.slice(0, 3));
    const frozen = structuredClone(A);
    applyCreditEvent(A, sequence[3]);
    expect(A).toEqual(frozen);
    expect(replayCreditEvents(initial, sequence.slice(0, 3))).toEqual(A);
    expect(replayCreditEvents(initial, [])).toEqual(copy);
    expect(initial).toEqual(copy);
    expect(sequence).toEqual(eventsCopy);
  });

  it("分单位运算消除0.1+0.2残差", () => {
    const state = replayCreditEvents(defaultCreditState(), [event("loan", .1), event("loan", .2, 2)]);
    expect(state.customers.newBorrower.deposit).toBe(.3);
    expect(state.A.loanAsset).toBe(80.3);
    expect(state.A.depositLiability).toBe(90.3);
    expect(() => validateCreditState(state)).not.toThrow();
  });

  it("准备金不足时拒绝支付，存款充足不能代替结算能力", () => {
    const state = applyCreditEvent(defaultCreditState(), event("loan", 30));
    const before = structuredClone(state);
    expect(() => applyCreditEvent(state, event("payment", 21, 2))).toThrow(/准备金/);
    expect(state).toEqual(before);
    const exact = applyCreditEvent(state, event("payment", 20, 2));
    expect(exact.A.reserves).toBe(0);
    expect(creditRisk(exact).A).toEqual({ negativeEquity: false, exhaustedReserves: true });
  });

  it("负权益保持在账本并单列风险，不自动注资；与准备金耗尽不同", () => {
    const state = applyCreditEvent(defaultCreditState(), event("loss", 11));
    expect(state.A.equity).toBe(-1);
    expect(state.A.reserves).toBe(20);
    expect(creditRisk(state).A).toEqual({ negativeEquity: true, exhaustedReserves: false });
    expect(() => validateCreditState(state)).not.toThrow();
    expect(applyCreditEvent(defaultCreditState(), event("loss", 80)).A.loanAsset).toBe(0);
  });

  it("损失只针对历史债权，不能以新增贷款扩大可核销的历史余额", () => {
    const state = applyCreditEvent(defaultCreditState(), event("loan", 100));
    expect(() => applyCreditEvent(state, event("loss", 80.01, 2))).toThrow(/历史债权/);
    const firstLoss = applyCreditEvent(state, event("loss", 79, 2));
    expect(() => applyCreditEvent(firstLoss, event("loss", 2, 3))).toThrow(/历史债权/);
  });

  it.each(["payment", "repayment"] as const)("无可用存款时拒绝%s", (type) => {
    expect(() => applyCreditEvent(defaultCreditState(), event(type, .01))).toThrow(/存款/);
  });

  it("本金上限独立于客户存款", () => {
    const state = defaultCreditState();
    state.customers.newBorrower.deposit = 5;
    state.customers.newBorrower.netWorth = 5;
    state.A.deposits.newBorrower = 5;
    state.A.depositLiability = 95;
    state.A.reserves = 25;
    expect(() => validateCreditState(state)).not.toThrow();
    expect(() => applyCreditEvent(state, event("repayment", 1))).toThrow(/贷款/);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, .001, 1e-9, 1_000_000_001])("非法金额%j被拒绝", (amount) => {
    expect(() => applyCreditEvent(defaultCreditState(), event("loan", amount))).toThrow();
  });

  it("重复ID、倒序、未知类型与带事件的期初不能绕过验证", () => {
    const state = applyCreditEvent(defaultCreditState(), sequence[0]);
    expect(() => applyCreditEvent(state, { ...sequence[1], id: sequence[0].id })).toThrow(/重复/);
    expect(() => applyCreditEvent(state, { ...sequence[1], sequence: 1 })).toThrow(/递增/);
    expect(() => applyCreditEvent(defaultCreditState(), { ...sequence[0], type: "unknown" } as unknown as CreditEvent)).toThrow(/未知/);
    expect(() => replayCreditEvents(state, [])).toThrow(/初始/);
  });

  it("对称改合计不能掩盖客户分户不匹配或缺少历史客户", () => {
    const state = defaultCreditState();
    state.A.loanAsset -= 1;
    state.A.equity -= 1;
    expect(() => validateCreditState(state)).toThrow(/分户/);
    const state2 = defaultCreditState();
    state2.A.loans.historicalBorrowerA -= 1;
    state2.A.loanAsset -= 1;
    state2.A.equity -= 1;
    expect(() => validateCreditState(state2)).toThrow(/双边/);
    const state3 = defaultCreditState();
    delete (state3.customers as Partial<CreditState["customers"]>).historicalDepositorA;
    expect(() => validateCreditState(state3)).toThrow(/完整/);
  });
});

describe("LA08 债务金额与精确债务率", () => {
  it("设计oracle b1=.6217647059，pd乘当期GDP", () => {
    const result = simulateDebt({ ...defaultDebtParameters(), periods: 1 });
    expect(result.periods).toHaveLength(2);
    expect(result.periods[0].debt).toBe(60);
    const next = result.periods[1];
    expect(next.GDP).toBe(102);
    expect(next.interest).toBeCloseTo(2.4, 12);
    expect(next.primaryDeficit).toBeCloseTo(1.02, 12);
    expect(next.debt).toBeCloseTo(63.42, 12);
    expect(next.debtRatio).toBeCloseTo(.6217647058823529, 12);
    expect(next.debtRatio).toBeCloseTo(next.debt / next.GDP, 12);
    expect(result.omittedAdjustments).toContain("汇率重估");
  });

  it("多期金额预算约束与率变化分解分别成立", () => {
    const { periods } = simulateDebt(defaultDebtParameters());
    for (let t = 1; t < periods.length; t++) {
      const previous = periods[t - 1];
      const next = periods[t];
      expect(next.debt).toBeCloseTo(previous.debt + next.interest + next.primaryDeficit, 10);
      expect(next.debtRatio).toBeCloseTo(next.debt / next.GDP, 10);
      expect(next.ratioChange).toBeCloseTo(next.interestGrowthEffect + next.primaryDeficitRatio, 12);
    }
  });

  it("按各期原始路径计算；不把未来利率提前使用", () => {
    const parameters = { ...defaultDebtParameters(), periods: 3 };
    const paths = { interestRate: [0, .1, .02], growthRate: [0, 0, .1], primaryDeficitRatio: [0, .01, -.02] };
    const result = simulateDebt(parameters, paths);
    expect(result.periods[1].debt).toBe(60);
    expect(result.periods[2].debt).toBe(67);
    expect(result.periods[3].GDP).toBeCloseTo(110, 12);
    expect(result.periods[3].debt).toBeCloseTo(66.14, 12);
    expect(result.periods[3].debtRatio).toBeCloseTo(66.14 / 110, 12);
    expect(paths).toEqual({ interestRate: [0, .1, .02], growthRate: [0, 0, .1], primaryDeficitRatio: [0, .01, -.02] });
  });

  it("i=g且初级余额零使债务率固定，债务额仍随GDP增长", () => {
    const result = simulateDebt({ ...defaultDebtParameters(), interestRate: .1, growthRate: .1, primaryDeficitRatio: 0 });
    for (const row of result.periods) expect(row.debtRatio).toBeCloseTo(.6, 12);
    expect(result.periods[20].debt).toBeGreaterThan(60);
  });

  it("高增长也不能抵消任意赤字，不使用安全或违约评分", () => {
    const result = simulateDebt({ ...defaultDebtParameters(), growthRate: .1, interestRate: .02, primaryDeficitRatio: .2, periods: 1 });
    expect(result.periods[1].debtRatio).toBeGreaterThan(.6);
  });

  it("初级盈余可穿过零，负债额明示净资产而非裁零", () => {
    const result = simulateDebt({ ...defaultDebtParameters(), initialDebtRatio: .01, interestRate: 0, growthRate: 0, primaryDeficitRatio: -.02, periods: 2 });
    expect(result.negativeDebtConvention).toBe("net_assets");
    expect(result.periods[1].debt).toBe(-1);
    expect(result.periods[2].debtRatio).toBeCloseTo(-.03, 12);
    expect(result.periods[2].position).toBe("net_asset");
  });

  it("名义GDP金额重标不改变债务率路径", () => {
    const A = simulateDebt(defaultDebtParameters());
    const B = simulateDebt({ ...defaultDebtParameters(), initialGDP: 1000 });
    for (let t = 0; t < A.periods.length; t++) {
      expect(B.periods[t].debtRatio).toBe(A.periods[t].debtRatio);
      expect(B.periods[t].debt).toBeCloseTo(10 * A.periods[t].debt, 9);
    }
  });

  it.each([-1, -1.1, Number.NaN, Number.POSITIVE_INFINITY])("非法g=%j被拒绝", (growthRate) => {
    expect(() => simulateDebt({ ...defaultDebtParameters(), growthRate })).toThrow();
  });

  it.each([0, .5, 201, Number.POSITIVE_INFINITY])("非法期数%j被拒绝", (periods) => {
    expect(() => simulateDebt({ ...defaultDebtParameters(), periods })).toThrow(/期数/);
  });

  it("非正GDP、不可解释利率、缺失路径与非有限值被拒绝", () => {
    expect(() => simulateDebt({ ...defaultDebtParameters(), initialGDP: 0 })).toThrow();
    expect(() => simulateDebt({ ...defaultDebtParameters(), interestRate: -1.1 })).toThrow(/利率/);
    expect(() => simulateDebt(defaultDebtParameters(), { growthRate: [0] })).toThrow(/恰好/);
    expect(() => simulateDebt({ ...defaultDebtParameters(), periods: 1 }, { primaryDeficitRatio: [Number.NaN] })).toThrow();
    expect(() => simulateDebt(defaultDebtParameters(), { bad: [] } as never)).toThrow(/未知/);
  });

  it("发散与极小分母明确失败，不产出Infinity/NaN或裁剪曲线", () => {
    expect(() => simulateDebt({ ...defaultDebtParameters(), interestRate: 100, growthRate: 0 })).toThrow(/范围/);
    expect(() => simulateDebt({ ...defaultDebtParameters(), growthRate: -.9999999999999999, periods: 1 })).toThrow(/范围/);
    expect(() => simulateDebt({ ...defaultDebtParameters(), initialGDP: Number.MIN_VALUE })).toThrow();
  });
});

describe("LA09 贸易、国民收入、外部净资产与汇率约定", () => {
  it("默认oracle同一原始记录派生NX−5/YD103/S23/CA−2/NFA变化2", () => {
    const result = calculateExternal(defaultExternalParameters());
    expect(result.production).toBe(100);
    expect(result.expenditure).toBe(100);
    expect(result.NX).toBe(-5);
    expect(result.YD).toBe(103);
    expect(result.S).toBe(23);
    expect(result.CA).toBe(-2);
    expect(result.CAFromSaving).toBe(-2);
    expect(result.NFAChange).toBe(2);
    expect(result.closingNFA).toBe(2);
    expect(result.q).toBe(7);
    expect(result.realMovement).toBe("unchanged");
  });

  it("汇率7→7.7提高q10%，倒数定义下降1−1/1.1；同一经济方向不翻转", () => {
    const initial = defaultExternalParameters();
    const result = calculateExternal({ ...initial, exchangeRate: 7.7 });
    expect(result.q).toBe(7.7);
    expect(result.qChange).toBeCloseTo(.1, 12);
    expect(result.reciprocalQ).toBeCloseTo(1 / 7.7, 12);
    expect(result.reciprocalQChange).toBeCloseTo(1 / 1.1 - 1, 12);
    expect(result.realMovement).toBe("depreciation");
    expect(result.CA).toBe(-2);
    expect(result.NX).toBe(-5);
    expect(initial.exchangeRate).toBe(7);
  });

  it("本国价格上涨在该约定下为实际升值；相对价格冲击不暗中创造贸易反应", () => {
    const result = calculateExternal({ ...defaultExternalParameters(), domesticPrice: 110 });
    expect(result.qChange).toBeCloseTo(1 / 1.1 - 1, 12);
    expect(result.realMovement).toBe("appreciation");
    expect(result.CA).toBe(-2);
  });

  it("双方价格同比例改变不改实际汇率", () => {
    const result = calculateExternal({ ...defaultExternalParameters(), foreignPrice: 200, domesticPrice: 200 });
    expect(result.q).toBe(7);
    expect(result.qChange).toBe(0);
  });

  it("共同价格刻度重标和真正改参考时期是不同操作", () => {
    const result = calculateExternal({ ...defaultExternalParameters(), foreignPrice: 1000, domesticPrice: 1000, baseForeignPrice: 1000, baseDomesticPrice: 1000 });
    expect(result.qChange).toBe(0);
    const otherBase = calculateExternal({ ...defaultExternalParameters(), baseExchangeRate: 5 });
    expect(otherBase.qChange).toBeCloseTo(.4, 12);
  });

  it("贸易流必须与生产和最终使用对账，不能单独改进口并假造GDP损失", () => {
    expect(() => calculateExternal({ ...defaultExternalParameters(), imports: 50 })).toThrow(/生产与最终使用/);
    const result = calculateExternal({ ...defaultExternalParameters(), consumption: 90, imports: 50 });
    expect(result.production).toBe(100);
    expect(result.NX).toBe(-35);
    expect(result.S).toBe(-7);
    expect(result.CA).toBe(-32);
  });

  it("净初次收入和转移改变经常账户而不改变国内生产与净出口", () => {
    const result = calculateExternal({ ...defaultExternalParameters(), netPrimaryIncome: 20, netCurrentTransfers: -1 });
    expect(result.production).toBe(100);
    expect(result.NX).toBe(-5);
    expect(result.YD).toBe(119);
    expect(result.CA).toBe(14);
    expect(result.S).toBe(39);
  });

  it("经常账户赤字与净资产增加并存；重估不是当期GDP或收入", () => {
    const result = calculateExternal({ ...defaultExternalParameters(), openingNFA: -20, valuationChange: 10 });
    expect(result.CA).toBe(-2);
    expect(result.NFAChange).toBe(8);
    expect(result.closingNFA).toBe(-12);
    expect(result.production).toBe(100);
    expect(result.YD).toBe(103);
  });

  it("小数原始流以分对账，巨大进口和同额消费相抵不受浮点残差干扰", () => {
    const result = calculateExternal({ ...defaultExternalParameters(), consumption: 100_000_060.1, imports: 100_000_020.1, valuationChange: 4.01 });
    expect(result.production).toBe(100);
    expect(result.expenditure).toBe(100);
    expect(result.NFAChange).toBe(-99_999_998.09);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("非法汇率/价格%j被拒绝", (value) => {
    expect(() => calculateExternal({ ...defaultExternalParameters(), exchangeRate: value })).toThrow();
    expect(() => calculateExternal({ ...defaultExternalParameters(), domesticPrice: value })).toThrow();
    expect(() => calculateExternal({ ...defaultExternalParameters(), baseForeignPrice: value })).toThrow();
  });

  it("极小正分母、无效金额和源记录缺失被明确拒绝", () => {
    expect(() => calculateExternal({ ...defaultExternalParameters(), domesticPrice: Number.MIN_VALUE })).toThrow(/范围/);
    expect(() => calculateExternal({ ...defaultExternalParameters(), exchangeRate: Number.MIN_VALUE, foreignPrice: Number.MIN_VALUE })).toThrow(/下溢/);
    expect(() => calculateExternal({ ...defaultExternalParameters(), consumption: 60.001 })).toThrow(/两位/);
    expect(() => calculateExternal({ ...defaultExternalParameters(), netCurrentTransfers: Number.NaN })).toThrow();
    expect(() => calculateExternal({ ...defaultExternalParameters(), exports: undefined } as never)).toThrow();
  });
});
