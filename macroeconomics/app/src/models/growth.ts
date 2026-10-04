import { assertNumber, assertRecord } from "./validation";

/** LA04: ratios, not percent inputs. One period is a synthetic year. */
export interface GrowthParameters {
  A: number;
  alpha: number;
  s: number;
  delta: number;
  n: number;
  K0: number;
  L0: number;
  technologyGrowth: number;
  /** Permanent multiplicative A-level change, applied at shockPeriod. */
  technologyShock: number;
  shockPeriod: number;
  periods: number;
}

export interface GrowthPeriod {
  period: number;
  A: number;
  K: number;
  L: number;
  Y: number;
  k: number;
  y: number;
  c: number;
  investment: number;
  depreciation: number;
  kNext: number;
  KNext: number;
  LNext: number;
  /** Ratios; null when the previous output is zero or does not exist. */
  gY: number | null;
  gy: number | null;
}

export interface GrowthResult {
  periods: GrowthPeriod[];
  steadyState: {
    A: number;
    k: number;
    y: number;
    c: number;
    appliesFromPeriod: number;
  } | null;
  steadyStateReason: string;
}

/** A fresh parameter object makes reset and A/B baselines independent. */
export function defaultGrowthParameters(): GrowthParameters {
  return {
    A: 1,
    alpha: 0.5,
    s: 0.2,
    delta: 0.1,
    n: 0,
    K0: 1,
    L0: 1,
    technologyGrowth: 0,
    technologyShock: 1,
    shockPeriod: 1,
    periods: 30,
  };
}

function finiteNonnegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${label}超出有限非负数值范围；请缩短时期或调整量级。`);
  return value;
}

function positiveProduct(
  value: number,
  expectedPositive: boolean,
  label: string,
): number {
  finiteNonnegative(value, label);
  if (expectedPositive && value === 0)
    throw new Error(`${label}低于数值精度，不能把正值伪装成零。`);
  return value;
}

function outputGrowth(
  current: number,
  previous: number | undefined,
): number | null {
  if (previous === undefined || previous === 0) return null;
  const value = current / previous - 1;
  if (!Number.isFinite(value)) throw new Error("增长率超出有限数值范围。");
  return value;
}

export function simulateGrowth(input: GrowthParameters): GrowthResult {
  assertRecord(input, "增长模型参数");
  for (const key of Object.keys(
    defaultGrowthParameters(),
  ) as (keyof GrowthParameters)[])
    assertNumber(input[key], `增长参数 ${key}`, {
      signed: key === "technologyGrowth",
    });
  if (input.A <= 0 || input.L0 <= 0 || input.technologyShock <= 0)
    throw new Error("A、初始劳动L0和技术水平倍率必须大于0。");
  if (input.alpha <= 0 || input.alpha >= 1)
    throw new Error("资本弹性alpha必须在0与1之间。");
  if (input.s >= 1) throw new Error("储蓄率s必须满足0≤s<1。");
  if (input.delta <= 0 || input.delta > 1)
    throw new Error("折旧率delta必须满足0<delta≤1。");
  if (input.technologyGrowth <= -1) throw new Error("技术增长率必须大于−1。");
  if (
    !Number.isSafeInteger(input.periods) ||
    input.periods < 1 ||
    input.periods > 200
  )
    throw new Error("模拟时期数必须为1到200的整数。");
  if (
    !Number.isSafeInteger(input.shockPeriod) ||
    input.shockPeriod < 1 ||
    input.shockPeriod > input.periods
  )
    throw new Error("技术冲击时期必须为模拟范围内从第1期开始的整数。");

  const periods: GrowthPeriod[] = [];
  let K = input.K0;
  let L = input.L0;
  for (let period = 0; period <= input.periods; period++) {
    const A = positiveProduct(
      input.A *
        Math.pow(1 + input.technologyGrowth, period) *
        (period >= input.shockPeriod ? input.technologyShock : 1),
      true,
      `第${period}期技术水平`,
    );
    const k = positiveProduct(K / L, K > 0, `第${period}期每工人资本`);
    const Y = positiveProduct(
      A * Math.pow(K, input.alpha) * Math.pow(L, 1 - input.alpha),
      K > 0,
      `第${period}期总产出`,
    );
    const y = positiveProduct(
      A * Math.pow(k, input.alpha),
      k > 0,
      `第${period}期每工人产出`,
    );
    const c = positiveProduct(
      (1 - input.s) * y,
      y > 0,
      `第${period}期每工人消费`,
    );
    const investment = positiveProduct(
      input.s * Y,
      input.s > 0 && Y > 0,
      `第${period}期投资`,
    );
    const depreciation = positiveProduct(
      input.delta * K,
      K > 0,
      `第${period}期折旧`,
    );
    const KNext = positiveProduct(
      (1 - input.delta) * K + investment,
      (input.delta < 1 && K > 0) || investment > 0,
      "下期总资本",
    );
    const LNext = positiveProduct((1 + input.n) * L, true, "下期劳动");
    // Independently derive the per-worker equation; no denominator n+delta approximation.
    const kNext = positiveProduct(
      ((1 - input.delta) * k + input.s * y) / (1 + input.n),
      KNext > 0,
      "下期每工人资本",
    );
    if (Math.abs(KNext / LNext - kNext) > 1e-10 * Math.max(1, kNext))
      throw new Error("总量与每工人积累计算不一致，数值量级不可靠。");
    const previous = periods[period - 1];
    periods.push({
      period,
      A,
      K,
      L,
      Y,
      k,
      y,
      c,
      investment,
      depreciation,
      kNext,
      KNext,
      LNext,
      gY: outputGrowth(Y, previous?.Y),
      gy: outputGrowth(y, previous?.y),
    });
    K = KNext;
    L = LNext;
  }

  if (input.technologyGrowth !== 0)
    return {
      periods,
      steadyState: null,
      steadyStateReason:
        "技术水平持续变化，此处的每工人资本不存在固定A稳态参考；需另定义有效劳动并重新推导，不能沿用固定A公式。",
    };
  const A = input.A * input.technologyShock;
  const k =
    input.s === 0
      ? 0
      : positiveProduct(
          Math.pow(
            (input.s * A) / (input.n + input.delta),
            1 / (1 - input.alpha),
          ),
          true,
          "固定A稳态资本",
        );
  const y = positiveProduct(
    A * Math.pow(k, input.alpha),
    k > 0,
    "固定A稳态产出",
  );
  const c = positiveProduct((1 - input.s) * y, y > 0, "固定A稳态消费");
  return {
    periods,
    steadyState: {
      A,
      k,
      y,
      c,
      appliesFromPeriod: input.technologyShock === 1 ? 0 : input.shockPeriod,
    },
    steadyStateReason:
      "固定A稳态是每工人量的固定点，人口增长时总量仍可增长；技术水平冲击后的参考使用新A。K0=0且无额外资本时另有零资本吸收态。更高储蓄率不是自动的福利判断。",
  };
}
