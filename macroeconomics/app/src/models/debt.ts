import { assertNumber, assertRecord, EPSILON } from "./validation";

export interface DebtParameters {
  initialDebtRatio: number;
  initialGDP: number;
  /** 小数口径：.04表示4%；转换百分数只发生在UI边界。 */
  interestRate: number;
  growthRate: number;
  /** 正值为初级赤字，负值为初级盈余；分母为当期GDP。 */
  primaryDeficitRatio: number;
  periods: number;
}

export interface DebtPaths {
  interestRate?: number[];
  growthRate?: number[];
  primaryDeficitRatio?: number[];
}

export interface DebtPeriod {
  period: number;
  GDP: number;
  debt: number;
  debtRatio: number;
  interest: number;
  primaryDeficit: number;
  interestRate: number;
  growthRate: number;
  primaryDeficitRatio: number;
  ratioChange: number;
  interestGrowthEffect: number;
  position: "debt" | "net_asset";
}

export interface DebtResult {
  periods: DebtPeriod[];
  /** 负的B/b表示政府净资产头寸，未静默裁到零。 */
  negativeDebtConvention: "net_assets";
  omittedAdjustments: string[];
}

export const DEBT_MAX_PERIODS = 200;
export const DEBT_MAX_OUTPUT = 1_000_000_000_000;

export function defaultDebtParameters(): DebtParameters {
  return { initialDebtRatio: .6, initialGDP: 100, interestRate: .04, growthRate: .02, primaryDeficitRatio: .01, periods: 20 };
}

function finiteOutput(value: number, label: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > DEBT_MAX_OUTPUT)
    throw new Error(`${label}超出有限计算范围（绝对值最多${DEBT_MAX_OUTPUT}）；未裁剪轨迹。`);
  return value;
}

function validateRate(value: unknown, key: keyof DebtPaths): asserts value is number {
  assertNumber(value, key, { signed: true });
  if (key === "growthRate" && value <= -1) throw new Error("名义GDP增长率必须大于−1。");
  if (key === "interestRate" && value < -1) throw new Error("有效名义利率必须至少为−1，不能产生负的本金滚存系数。");
}

/** 同时计算债务金额预算约束与精确债务率递推，不使用r−g近似或逐期显示舍入。 */
export function simulateDebt(parameters: DebtParameters, paths: DebtPaths = {}): DebtResult {
  assertRecord(parameters, "债务参数");
  assertNumber(parameters.initialDebtRatio, "期初债务率", { signed: true });
  assertNumber(parameters.initialGDP, "期初GDP", { positive: true });
  if (!Number.isSafeInteger(parameters.periods) || parameters.periods < 1 || parameters.periods > DEBT_MAX_PERIODS)
    throw new Error(`模拟期数必须为1到${DEBT_MAX_PERIODS}的整数。`);
  assertRecord(paths as unknown, "债务路径");
  if (Object.keys(paths).some((key) => !["interestRate", "growthRate", "primaryDeficitRatio"].includes(key)))
    throw new Error("未知债务路径字段。");
  for (const key of ["interestRate", "growthRate", "primaryDeficitRatio"] as const) {
    validateRate(parameters[key], key);
    const path = paths[key];
    if (path !== undefined) {
      if (!Array.isArray(path) || path.length !== parameters.periods)
        throw new Error(`${key}路径必须恰好包含${parameters.periods}期；不能静默补值。`);
      for (const value of path) validateRate(value, key);
    }
  }
  const debt0 = finiteOutput(parameters.initialDebtRatio * parameters.initialGDP, "期初债务额");
  const periods: DebtPeriod[] = [{
    period: 0, GDP: parameters.initialGDP, debt: debt0, debtRatio: parameters.initialDebtRatio,
    interest: 0, primaryDeficit: 0, interestRate: 0, growthRate: 0, primaryDeficitRatio: 0,
    ratioChange: 0, interestGrowthEffect: 0, position: debt0 < 0 ? "net_asset" : "debt",
  }];
  for (let period = 1; period <= parameters.periods; period++) {
    const previous = periods[period - 1];
    const interestRate = paths.interestRate?.[period - 1] ?? parameters.interestRate;
    const growthRate = paths.growthRate?.[period - 1] ?? parameters.growthRate;
    const primaryDeficitRatio = paths.primaryDeficitRatio?.[period - 1] ?? parameters.primaryDeficitRatio;
    const GDP = finiteOutput(previous.GDP * (1 + growthRate), "名义GDP");
    if (GDP <= 0) throw new Error("名义GDP下溢至零，债务率无定义；未继续生成轨迹。");
    const interest = finiteOutput(interestRate * previous.debt, "利息");
    const primaryDeficit = finiteOutput(primaryDeficitRatio * GDP, "当期初级赤字");
    const debt = finiteOutput(previous.debt + interest + primaryDeficit, "债务额");
    const debtRatio = finiteOutput(((1 + interestRate) / (1 + growthRate)) * previous.debtRatio + primaryDeficitRatio, "债务率");
    const fromAmounts = finiteOutput(debt / GDP, "金额法债务率");
    if (Math.abs(fromAmounts - debtRatio) > EPSILON * Math.max(1, Math.abs(debtRatio)))
      throw new Error("债务额与债务率递推不一致。");
    const ratioChange = finiteOutput(debtRatio - previous.debtRatio, "债务率变化");
    const interestGrowthEffect = finiteOutput(((interestRate - growthRate) / (1 + growthRate)) * previous.debtRatio, "利息增长效应");
    periods.push({ period, GDP, debt, debtRatio, interest, primaryDeficit, interestRate, growthRate, primaryDeficitRatio, ratioChange, interestGrowthEffect, position: debt < 0 ? "net_asset" : "debt" });
  }
  return {
    periods,
    negativeDebtConvention: "net_assets",
    omittedAdjustments: ["汇率重估", "资产估值", "救助与债务承接", "其他存量流量调整"],
  };
}
