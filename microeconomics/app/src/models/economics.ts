/** Pure, deterministic kernels for the synthetic Phase 1 consumer models.
 * Prices and expenditure use one common currency unit; x and y use good units.
 * UI teaching ranges are separate from these mathematical domains.
 */
export type Budget = { m: number; px: number; py: number };
export type Point = { x: number; y: number };
export type Preference = {
  kind: "cd" | "linear" | "complements";
  alpha: number;
  a: number;
  b: number;
};
export type Representation = "u" | "u2";
export type Ranking = "a_preferred" | "b_preferred" | "indifferent";
export type BudgetGeometry = {
  xIntercept: number;
  yIntercept: number;
  slope: number;
  vertices: Point[];
};
export type BundleEvaluation = {
  spending: number;
  balance: number;
  feasible: boolean;
  boundary: boolean;
};
export type MrsResult = {
  defined: boolean;
  value: number | null;
  reason: string;
};
type ChoiceCommon = {
  utility: number;
  representedUtility: number;
  spending: number;
  explanation: string;
};
export type UniqueChoice = ChoiceCommon & {
  kind: "unique";
  point: Point;
  solutionType: "interior" | "corner" | "kink" | "degenerate";
};
export type OptimalSet = ChoiceCommon & {
  kind: "optimal_set";
  endpoints: [Point, Point];
  solutionType: "tie";
};
export type Choice = UniqueChoice | OptimalSet;
export type DemandEntry = {
  price: number;
  choice: Choice;
  xRange: [number, number];
};
export type CurveBounds = { xMax: number; yMax: number };

export const DEFAULT_BUDGET: Budget = { m: 120, px: 3, py: 2 };
export const DEFAULT_PREFERENCE: Preference = {
  kind: "cd",
  alpha: 0.5,
  a: 1,
  b: 1,
};

function finite(value: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${name} 必须是有限数值。`);
  }
  return value;
}

function nonnegative(value: number, name: string): void {
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} 不能小于 0。`);
}

function positive(value: number, name: string): void {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} 必须大于 0。`);
}

export function validateBudget(budget: Budget): void {
  nonnegative(budget.m, "预算 m");
  positive(budget.px, "价格 px");
  positive(budget.py, "价格 py");
}

export function validatePoint(point: Point): void {
  nonnegative(point.x, "数量 x");
  nonnegative(point.y, "数量 y");
}

export function validatePreference(preference: Preference): void {
  // All persisted numeric fields must remain finite, including inactive controls.
  finite(preference.alpha, "权重 α");
  finite(preference.a, "权重 a");
  finite(preference.b, "权重 b");
  if (preference.kind === "cd") {
    if (preference.alpha <= 0 || preference.alpha >= 1) {
      throw new RangeError("Cobb–Douglas 要求 0 < α < 1。");
    }
  } else if (preference.kind === "linear") {
    positive(preference.a, "权重 a");
    positive(preference.b, "权重 b");
  } else if (preference.kind !== "complements") {
    throw new RangeError("未知偏好模式。");
  }
}

function validateRepresentation(representation: Representation): void {
  if (representation !== "u" && representation !== "u2") {
    throw new RangeError("表示只能是 u 或 u²。");
  }
}

// Roundoff allowance, not a pedagogical or displayed-decimal tolerance.
function roundoff(a: number, b: number): number {
  return (
    16 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE)
  );
}

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= roundoff(a, b);
}

export function budgetGeometry(budget: Budget): BudgetGeometry {
  validateBudget(budget);
  const xIntercept = finite(budget.m / budget.px, "x 截距");
  const yIntercept = finite(budget.m / budget.py, "y 截距");
  return {
    xIntercept,
    yIntercept,
    slope: finite(-budget.px / budget.py, "预算线斜率"),
    vertices:
      budget.m === 0
        ? [{ x: 0, y: 0 }]
        : [
            { x: 0, y: 0 },
            { x: xIntercept, y: 0 },
            { x: 0, y: yIntercept },
          ],
  };
}

export function evaluateBundle(budget: Budget, point: Point): BundleEvaluation {
  validateBudget(budget);
  validatePoint(point);
  const spending = finite(budget.px * point.x + budget.py * point.y, "总支出");
  const balance = finite(budget.m - spending, "余额");
  // Zero budget has exactly one feasible point, even at tiny positive quantities.
  const feasible =
    budget.m === 0
      ? point.x === 0 && point.y === 0
      : spending <= budget.m || almostEqual(spending, budget.m);
  return {
    spending,
    balance,
    feasible,
    boundary: feasible && almostEqual(spending, budget.m),
  };
}

export function utility(preference: Preference, point: Point): number {
  validatePreference(preference);
  validatePoint(point);
  if (preference.kind === "cd") {
    if (point.x === 0 || point.y === 0) return 0;
    // Geometric mean in logs avoids intermediate powers overflowing separately.
    return finite(
      Math.exp(
        preference.alpha * Math.log(point.x) +
          (1 - preference.alpha) * Math.log(point.y),
      ),
      "效用",
    );
  }
  if (preference.kind === "linear") {
    return finite(preference.a * point.x + preference.b * point.y, "效用");
  }
  return Math.min(point.x, point.y);
}

export function representedUtility(
  preference: Preference,
  point: Point,
  representation: Representation = "u",
): number {
  validateRepresentation(representation);
  const u = utility(preference, point);
  return representation === "u" ? u : finite(u * u, "平方后的效用");
}

export function compareBundles(
  preference: Preference,
  a: Point,
  b: Point,
  representation: Representation = "u",
): Ranking {
  validateRepresentation(representation);
  // Compare the underlying ordering, rather than introducing extra rounding
  // through the display transformation. u² is strictly increasing for u >= 0.
  const ua = utility(preference, a);
  const ub = utility(preference, b);
  if (almostEqual(ua, ub)) return "indifferent";
  return ua > ub ? "a_preferred" : "b_preferred";
}

export function mrs(preference: Preference, point: Point): MrsResult {
  validatePreference(preference);
  validatePoint(point);
  if (point.x === 0 || point.y === 0) {
    return {
      defined: false,
      value: null,
      reason: "轴上不使用内点的边际替代率公式。",
    };
  }
  if (preference.kind === "cd") {
    const value =
      (preference.alpha / (1 - preference.alpha)) * (point.y / point.x);
    return Number.isFinite(value)
      ? {
          defined: true,
          value,
          reason: "MRS = [α/(1−α)] · y/x，单位为 y单位/x单位。",
        }
      : {
          defined: false,
          value: null,
          reason: "该局部比率超出可表示的有限数值范围。",
        };
  }
  if (preference.kind === "linear") {
    const value = preference.a / preference.b;
    return Number.isFinite(value)
      ? { defined: true, value, reason: "MRS = a/b，为固定的局部替代率。" }
      : {
          defined: false,
          value: null,
          reason: "该局部比率超出可表示的有限数值范围。",
        };
  }
  if (point.x === point.y) {
    return {
      defined: false,
      value: null,
      reason: "互补拐角不可微，没有唯一 MRS。",
    };
  }
  if (point.x < point.y) {
    return {
      defined: false,
      value: null,
      reason: "此处 MUy = 0，MUx/MUy 没有有限值。",
    };
  }
  return {
    defined: true,
    value: 0,
    reason: "此处 x 有剩余，局部 MUx = 0、MUy = 1，因此 MRS = 0。",
  };
}

export function solveChoice(
  budget: Budget,
  preference: Preference,
  representation: Representation = "u",
): Choice {
  validateBudget(budget);
  validatePreference(preference);
  validateRepresentation(representation);
  const unique = (
    point: Point,
    solutionType: UniqueChoice["solutionType"],
    explanation: string,
  ): UniqueChoice => ({
    kind: "unique",
    point,
    solutionType,
    explanation,
    utility: utility(preference, point),
    representedUtility: representedUtility(preference, point, representation),
    spending: evaluateBundle(budget, point).spending,
  });
  if (budget.m === 0) {
    return unique(
      { x: 0, y: 0 },
      "degenerate",
      "正价格和零预算使可行集退化为原点。",
    );
  }
  if (preference.kind === "cd") {
    const point = {
      x: finite((preference.alpha * budget.m) / budget.px, "最优 x"),
      y: finite(((1 - preference.alpha) * budget.m) / budget.py, "最优 y"),
    };
    return unique(
      point,
      "interior",
      "正预算、正价格和 0<α<1 下，CD 内点解分别支出 αm 与 (1−α)m。",
    );
  }
  if (preference.kind === "complements") {
    // Rearrangement avoids overflow in px + py for extreme finite inputs.
    const maxPrice = Math.max(budget.px, budget.py);
    const quantity = finite(
      budget.m / maxPrice / (budget.px / maxPrice + budget.py / maxPrice),
      "互补最优数量",
    );
    return unique(
      { x: quantity, y: quantity },
      "kink",
      "1:1 互补只增加较短的一边才改善效用，最优为 x=y=m/(px+py)。",
    );
  }
  const xReturn = finite(preference.a / budget.px, "x 的每货币效用");
  const yReturn = finite(preference.b / budget.py, "y 的每货币效用");
  if (almostEqual(xReturn, yReturn)) {
    const endpoints: [Point, Point] = [
      { x: 0, y: finite(budget.m / budget.py, "最优边界 y 截距") },
      { x: finite(budget.m / budget.px, "最优边界 x 截距"), y: 0 },
    ];
    return {
      kind: "optimal_set",
      endpoints,
      solutionType: "tie",
      utility: utility(preference, endpoints[0]),
      representedUtility: representedUtility(
        preference,
        endpoints[0],
        representation,
      ),
      spending: budget.m,
      explanation:
        "a/px=b/py，两种商品的每货币效用相同；两个端点之间的整段预算边界都最优。",
    };
  }
  return xReturn > yReturn
    ? unique(
        { x: finite(budget.m / budget.px, "最优 x"), y: 0 },
        "corner",
        "a/px>b/py，全部预算购买 x 的角点最优。",
      )
    : unique(
        { x: 0, y: finite(budget.m / budget.py, "最优 y") },
        "corner",
        "a/px<b/py，全部预算购买 y 的角点最优。",
      );
}

/** Returns a relation, including a full quantity interval at a linear tie.
 * Inserts the tie price if it lies between the supplied prices; callers must
 * not interpolate a single continuous line through that set-valued entry.
 */
export function demandSeries(
  budget: Budget,
  preference: Preference,
  prices: number[],
): DemandEntry[] {
  validateBudget(budget);
  validatePreference(preference);
  if (prices.length === 0) return [];
  for (const price of prices) positive(price, "扫描价格");
  const scan = [...new Set(prices)].sort((a, b) => a - b);
  if (preference.kind === "linear") {
    const tie = (preference.a / preference.b) * budget.py;
    if (
      Number.isFinite(tie) &&
      tie >= scan[0] &&
      tie <= scan[scan.length - 1] &&
      !scan.includes(tie)
    ) {
      scan.push(tie);
      scan.sort((a, b) => a - b);
    }
  }
  return scan.map((price) => {
    const choice = solveChoice({ ...budget, px: price }, preference);
    const xRange: [number, number] =
      choice.kind === "unique"
        ? [choice.point.x, choice.point.x]
        : [choice.endpoints[0].x, choice.endpoints[1].x];
    return { price, choice, xRange };
  });
}

/** Clipped indifference sets in a chart rectangle. Separate polylines preserve
 * zero-utility axes; complement curves always have a literal L-shaped corner.
 * Geometry clipping is explicit and never changes an economic input.
 */
export function indifferenceCurve(
  preference: Preference,
  throughPoint: Point,
  bounds: CurveBounds = { xMax: 60, yMax: 60 },
  samples = 100,
): Point[][] {
  validatePreference(preference);
  validatePoint(throughPoint);
  positive(bounds.xMax, "图形 x 上界");
  positive(bounds.yMax, "图形 y 上界");
  if (!Number.isInteger(samples) || samples < 2 || samples > 5000) {
    throw new RangeError("曲线采样点数须是 2 至 5000 的整数。");
  }
  const level = utility(preference, throughPoint);
  if (preference.kind === "complements") {
    if (level > Math.min(bounds.xMax, bounds.yMax)) return [];
    return [
      [
        { x: level, y: bounds.yMax },
        { x: level, y: level },
        { x: bounds.xMax, y: level },
      ],
    ];
  }
  if (preference.kind === "linear") {
    const start = Math.max(
      0,
      (level - preference.b * bounds.yMax) / preference.a,
    );
    const end = Math.min(bounds.xMax, level / preference.a);
    if (start > end) return [];
    return [
      [
        {
          x: start,
          y: Math.min(
            bounds.yMax,
            Math.max(0, (level - preference.a * start) / preference.b),
          ),
        },
        {
          x: end,
          y: Math.min(
            bounds.yMax,
            Math.max(0, (level - preference.a * end) / preference.b),
          ),
        },
      ],
    ];
  }
  if (level === 0) {
    return [
      [
        { x: 0, y: 0 },
        { x: bounds.xMax, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: bounds.yMax },
      ],
    ];
  }
  const logLevel = Math.log(level);
  const start = Math.exp(
    (logLevel - (1 - preference.alpha) * Math.log(bounds.yMax)) /
      preference.alpha,
  );
  if (!Number.isFinite(start) || start > bounds.xMax || start <= 0) return [];
  const points: Point[] = [];
  for (let i = 0; i < samples; i += 1) {
    // Log spacing resolves the steep part of a CD curve near an axis.
    const x = Math.exp(
      Math.log(start) +
        ((Math.log(bounds.xMax) - Math.log(start)) * i) / (samples - 1),
    );
    const y = Math.exp(
      (logLevel - preference.alpha * Math.log(x)) / (1 - preference.alpha),
    );
    points.push({ x: Math.min(bounds.xMax, x), y: Math.min(bounds.yMax, y) });
  }
  return [points];
}
