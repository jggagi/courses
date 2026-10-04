import { assertNumber, assertRecord } from "./validation";

/** LA06: x, inflation and interest rates use percentage points / percent numbers.
 * For example piTarget=2 means 2%, while rho=.5 is a dimensionless coefficient.
 */
export interface PolicyParameters {
  rho: number;
  a: number;
  kappa: number;
  lambda: number;
  phiPi: number;
  phiX: number;
  rStar: number;
  piTarget: number;
  iMin: number;
  x0: number;
  pi0: number;
  expectedPi0: number;
  i0: number;
  demandShock: number;
  supplyShock: number;
  shockPeriod: number;
  shockDuration: number;
  periods: number;
}

export interface PolicyPeriod {
  period: number;
  x: number;
  pi: number;
  expectedPi: number;
  i: number;
  demandShock: number;
  supplyShock: number;
  /** Current nominal rate less current expected inflation, not the lagged input. */
  realRate: number;
  lowerBoundBinding: boolean;
}

export interface PolicyResult {
  periods: PolicyPeriod[];
  status: "completed" | "unstable";
  unstableReason: string | null;
  /** Null if all requested periods were computed; a failed next step is not fabricated. */
  stoppedAtPeriod: number | null;
  stability: {
    spectralRadius: number;
    classification: "stable" | "neutral" | "unstable";
    scope: string;
  };
}

export function defaultPolicyParameters(): PolicyParameters {
  return {
    rho: 0.5,
    a: 0.5,
    kappa: 0.25,
    lambda: 0.5,
    phiPi: 1.5,
    phiX: 0.5,
    rStar: 1,
    piTarget: 2,
    iMin: 0,
    x0: 0,
    pi0: 2,
    expectedPi0: 2,
    i0: 3,
    demandShock: 1,
    supplyShock: 0,
    shockPeriod: 1,
    shockDuration: 1,
    periods: 30,
  };
}

// Once the rule is active, eliminate i_(t-1) using the previous adaptive-expectation
// equation. The two-state Jacobian is [[b,c],[lambda*kappa*b,1+lambda*kappa*c]],
// with determinant b. This tests LOCAL unconstrained stability, not a bound regime.
function ruleStability(input: PolicyParameters): PolicyResult["stability"] {
  const b =
    input.rho -
    input.a * (input.phiX + input.phiPi * input.kappa * (1 - input.lambda));
  const c = input.a * (1 - input.phiPi);
  const trace = b + 1 + input.lambda * input.kappa * c;
  const discriminant = trace * trace - 4 * b;
  const spectralRadius =
    discriminant >= 0
      ? Math.max(
          Math.abs((trace + Math.sqrt(discriminant)) / 2),
          Math.abs((trace - Math.sqrt(discriminant)) / 2),
        )
      : Math.sqrt(b);
  if (!Number.isFinite(spectralRadius))
    throw new Error("政策稳定性计算超出有限数值范围。");
  return {
    spectralRadius,
    classification:
      spectralRadius > 1 + 1e-10
        ? "unstable"
        : spectralRadius < 1 - 1e-10
          ? "stable"
          : "neutral",
    scope:
      "利率下限未绑定时的局部线性化；不证明受下限约束的全局稳定性，也不是现实政策预测。",
  };
}

export function simulatePolicy(input: PolicyParameters): PolicyResult {
  assertRecord(input, "需求供给政策模型参数");
  const signed = new Set<keyof PolicyParameters>([
    "rStar",
    "piTarget",
    "iMin",
    "x0",
    "pi0",
    "expectedPi0",
    "i0",
    "demandShock",
    "supplyShock",
  ]);
  for (const key of Object.keys(
    defaultPolicyParameters(),
  ) as (keyof PolicyParameters)[])
    assertNumber(input[key], `政策参数 ${key}`, { signed: signed.has(key) });
  if (input.rho > 1 || input.lambda > 1)
    throw new Error("rho和lambda必须在0到1之间。");
  if (input.i0 < input.iMin)
    throw new Error("初始政策利率不能低于本情景的利率下限。");
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
    throw new Error("冲击时期必须为模拟范围内从第1期开始的整数。");
  if (
    !Number.isSafeInteger(input.shockDuration) ||
    input.shockDuration < 1 ||
    input.shockDuration > 200
  )
    throw new Error("冲击持续时间必须为1到200期的整数。");
  const stability = ruleStability(input);
  let unstableReason: string | null =
    stability.classification === "unstable"
      ? "利率下限未绑定时的政策规则局部不稳定（特征根模大于1）；实际路径仍按方程计算，不能把这个判据当作全局或现实预测。"
      : null;
  const periods: PolicyPeriod[] = [
    {
      period: 0,
      x: input.x0,
      pi: input.pi0,
      expectedPi: input.expectedPi0,
      i: input.i0,
      demandShock: 0,
      supplyShock: 0,
      realRate: input.i0 - input.expectedPi0,
      lowerBoundBinding: input.i0 === input.iMin,
    },
  ];
  for (let period = 1; period <= input.periods; period++) {
    const previous = periods[period - 1];
    const shocked =
      period >= input.shockPeriod &&
      period < input.shockPeriod + input.shockDuration;
    const demandShock = shocked ? input.demandShock : 0;
    const supplyShock = shocked ? input.supplyShock : 0;
    // The previous policy rate and previous expectation enter x_t. Current i_t
    // cannot affect current x_t: this ordering is the model's one-period lag.
    const x =
      input.rho * previous.x -
      input.a * (previous.i - previous.expectedPi - input.rStar) +
      demandShock;
    const pi = previous.expectedPi + input.kappa * x + supplyShock;
    const expectedPi =
      (1 - input.lambda) * previous.expectedPi + input.lambda * pi;
    const ruleRate =
      input.rStar +
      input.piTarget +
      input.phiPi * (pi - input.piTarget) +
      input.phiX * x;
    const i = Math.max(input.iMin, ruleRate);
    const realRate = i - expectedPi;
    if (![x, pi, expectedPi, ruleRate, i, realRate].every(Number.isFinite)) {
      return {
        periods,
        status: "unstable",
        stoppedAtPeriod: period,
        stability,
        unstableReason: `第${period}期超出有限数值范围；路径已停止并保留最后有限结果，没有裁剪或伪造收敛。`,
      };
    }
    if (
      Math.max(Math.abs(x), Math.abs(pi), Math.abs(expectedPi), Math.abs(i)) >
      1_000_000
    )
      unstableReason =
        "模拟轨迹量级超过100万个百分点，标记为数值发散/模型域警报；路径没有裁剪，该阈值只是教学警报，不是经济制度标准。";
    periods.push({
      period,
      x,
      pi,
      expectedPi,
      i,
      demandShock,
      supplyShock,
      realRate,
      lowerBoundBinding: ruleRate <= input.iMin,
    });
  }
  return {
    periods,
    status: unstableReason ? "unstable" : "completed",
    unstableReason,
    stoppedAtPeriod: null,
    stability,
  };
}
