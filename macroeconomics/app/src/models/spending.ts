import { assertClose, assertNumber, assertRecord } from "./validation";

export interface SpendingParameters {
  C0: number;
  c: number;
  T: number;
  I0: number;
  G: number;
  eta: number;
  Y0: number;
  periods: number;
}

export interface SpendingSavings {
  privateSaving: number;
  governmentSaving: number;
  nationalSaving: number;
}

export interface SpendingPeriod extends SpendingSavings {
  period: number;
  Y: number;
  C: number;
  Z: number;
  unplannedInventory: number;
  actualInvestment: number;
  YNext: number;
}

export interface SpendingResult {
  equilibrium: SpendingSavings & { Y: number; C: number };
  multiplier: number;
  periods: SpendingPeriod[];
  assumptions: string;
}

export function defaultSpendingParameters(): SpendingParameters {
  return {
    C0: 20,
    c: 0.6,
    T: 20,
    I0: 30,
    G: 30,
    eta: 0.5,
    Y0: 100,
    periods: 30,
  };
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label}超出有限数值范围。`);
  return value;
}

function nonnegative(value: number, label: string): number {
  finite(value, label);
  if (value < 0)
    throw new Error(
      `${label}为负，超出此固定价格模型的可行域；请调整参数，模型不会自动裁剪。`,
    );
  return value;
}

function savings(Y: number, C: number, T: number, G: number): SpendingSavings {
  return {
    privateSaving: finite(Y - T - C, "私人储蓄"),
    governmentSaving: finite(T - G, "政府储蓄"),
    nationalSaving: finite(Y - C - G, "国民储蓄"),
  };
}

/** LA05: closed economy, fixed prices, idle capacity and exogenous planned investment.
 * Unplanned inventory is a FLOW, without a stock floor. A drawdown requires available
 * opening inventory in a richer model; this kernel cannot establish its feasibility.
 */
export function simulateSpending(input: SpendingParameters): SpendingResult {
  assertRecord(input, "计划支出模型参数");
  for (const key of Object.keys(
    defaultSpendingParameters(),
  ) as (keyof SpendingParameters)[])
    assertNumber(input[key], `支出参数 ${key}`);
  if (input.c >= 1)
    throw new Error("边际消费倾向c必须满足0≤c<1；c=1没有此有限乘数公式。");
  if (input.eta <= 0 || input.eta > 1)
    throw new Error("调整速度eta必须满足0<eta≤1。");
  if (
    !Number.isSafeInteger(input.periods) ||
    input.periods < 1 ||
    input.periods > 200
  )
    throw new Error("模拟时期数必须为1到200的整数。");
  const multiplier = finite(1 / (1 - input.c), "乘数");
  const equilibriumY = nonnegative(
    (input.C0 - input.c * input.T + input.I0 + input.G) * multiplier,
    "均衡产出",
  );
  const equilibriumC = nonnegative(
    input.C0 + input.c * (equilibriumY - input.T),
    "均衡消费",
  );
  const equilibrium = {
    Y: equilibriumY,
    C: equilibriumC,
    ...savings(equilibriumY, equilibriumC, input.T, input.G),
  };
  assertClose(
    equilibrium.Y,
    equilibrium.C + input.I0 + input.G,
    "均衡支出在当前量级无法可靠对账，请调整参数。",
  );
  assertClose(
    equilibrium.nationalSaving,
    input.I0,
    "均衡储蓄与外生投资在当前量级无法可靠对账，请调整参数。",
  );
  const periods: SpendingPeriod[] = [];
  let Y = input.Y0;
  for (let period = 0; period <= input.periods; period++) {
    const C = nonnegative(
      input.C0 + input.c * (Y - input.T),
      `第${period}期消费`,
    );
    const Z = nonnegative(C + input.I0 + input.G, `第${period}期计划支出`);
    const unplannedInventory = finite(Y - Z, "非计划存货变化");
    // Actual investment includes the inventory discrepancy even away from equilibrium.
    const actualInvestment = finite(input.I0 + unplannedInventory, "实际投资");
    const YNext = nonnegative((1 - input.eta) * Y + input.eta * Z, "下期产出");
    const realizedSavings = savings(Y, C, input.T, input.G);
    assertClose(
      Y,
      C + actualInvestment + input.G,
      "实现后GDP恒等式在当前量级无法可靠对账，请调整参数。",
    );
    assertClose(
      realizedSavings.nationalSaving,
      actualInvestment,
      "实现后储蓄投资在当前量级无法可靠对账，请调整参数。",
    );
    assertClose(
      realizedSavings.privateSaving + realizedSavings.governmentSaving,
      realizedSavings.nationalSaving,
      "部门储蓄在当前量级无法可靠对账，请调整参数。",
    );
    periods.push({
      period,
      Y,
      C,
      Z,
      unplannedInventory,
      actualInvestment,
      YNext,
      ...realizedSavings,
    });
    Y = YNext;
  }
  return {
    equilibrium,
    multiplier,
    periods,
    assumptions:
      "教学合成情景：封闭经济、固定价格、闲置产能、税与政府购买外生、计划投资I0不随收入和利率变化。实际投资含非计划存货，可能为负；存货流量没有期初库存约束，负变化需有可售库存才能实现。本模型不证明供给容量或库存可行，也不从S=I恒等式推断因果。",
  };
}
