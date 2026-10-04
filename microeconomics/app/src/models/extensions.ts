/** Pure, synthetic extension kernels. Suggested control ranges are not the
 * mathematical domain. No parameter is clamped; undefined values use null.
 * These models do not import UI, storage, network, or another course.
 */
import type { AdvancedLabResult } from "./advanced";

export const EXTENSION_LAB_IDS = ["MX01", "MX02", "MX03"] as const;
export type ExtensionLabId = (typeof EXTENSION_LAB_IDS)[number];
export type ExtensionParameters = Record<string, number>;
export type ExtensionLabResult = AdvancedLabResult;
export type ExtensionLabDefinition = {
  id: ExtensionLabId;
  title: string;
  modelId: string;
  question: string;
  assumptions: string[];
  fields: { key: string; label: string; unit: string; min: number; max: number; step: number }[];
  defaults: ExtensionParameters;
  presets?: { label: string; parameters: ExtensionParameters }[];
};
const field = (key: string, label: string, unit: string, min: number, max: number, step = 1) => ({ key, label, unit, min, max, step });
const pennies = { r00: 1, c00: -1, r01: -1, c01: 1, r10: -1, c10: 1, r11: 1, c11: -1 };
const repeatedPD = { R: 3, S: 0, T: 5, P: 1, delta: .75 };

export const extensionLabDefinitions: ExtensionLabDefinition[] = [
  {
    id: "MX01", title: "有限价格变化：两种补偿与分解", modelId: "cobb-douglas-finite-compensation",
    question: "价格变化后，保持原组合买得起，与保持原效用不变，是同一种补偿吗？",
    assumptions: ["synthetic：两种可分商品，u=x^α y^(1−α)，0<α<1，正价格，m≥0。", "只改变 x 的价格；偏好、y 价格和原名义收入保持不变。", "Slutsky 补偿保留原组合的购买力；Hicks 补偿保留原效用。有限变化的两种分解不同，微小变化的极限一致。"],
    fields: [field("m", "原收入 m", "货币", 0, 300), field("px0", "x 原价 px₀", "货币/x", .1, 20, .1), field("px1", "x 新价 px₁", "货币/x", .1, 20, .1), field("py", "y 价格 py", "货币/y", .1, 20, .1), field("alpha", "x 效用权重 α", "比例", .05, .95, .05)],
    defaults: { m: 120, px0: 3, px1: 6, py: 2, alpha: .5 },
    presets: [{ label: "x 价格降低", parameters: { px1: 1.5 } }, { label: "价格不变", parameters: { px1: 3 } }, { label: "零预算退化", parameters: { m: 0 } }],
  },
  {
    id: "MX02", title: "长期进入退出：连续基准与整数企业", modelId: "quadratic-cost-long-run-entry",
    question: "零利润价格可以吸引多少家企业？企业数必须为整数时，还会精确零利润吗？",
    assumptions: ["synthetic：同型价格接受企业，C(q)=F+cq+dq²/2；F≥0、c≥0、d>0。", "需求 Q=max(0,A−Bp)，A≥0、B>0，无容量约束；长期 F 可避免，退出收益为零。", "连续企业数是分割企业的分析基准。整数条件在每个 n 与 n+1 下重新计算市场；不是 Cournot 或现实进入动态。", "自由进入的弱条件允许零利润进入；边界上可能有两个整数企业数。F=0 且存在正需求时没有有限企业数的零利润均衡。"],
    fields: [field("F", "可避免固定成本 F", "货币/家", 0, 300), field("c", "初始边际成本 c", "货币/商品", 0, 30), field("d", "边际成本斜率 d", "货币/商品²", .1, 10, .1), field("A", "需求数量截距 A", "商品", 0, 500), field("B", "需求价格响应 B", "商品²/货币", .1, 30, .1), field("n", "初始短期企业数 n", "家（整数）", 1, 100)],
    defaults: { F: 20, c: 2, d: 1, A: 100, B: 5, n: 10 },
    presets: [{ label: "固定成本增加", parameters: { F: 60 } }, { label: "整数边界：10 家零利润", parameters: { F: 18 } }, { label: "零固定成本的进入极限", parameters: { F: 0 } }, { label: "无交易需求", parameters: { A: 5 } }],
  },
  {
    id: "MX03", title: "混合策略与无限重复的条件", modelId: "two-by-two-support-and-grim-trigger",
    question: "没有纯策略均衡时怎样混合？未来惩罚何时让合作可以维持？",
    assumptions: ["synthetic：矩阵面板为同时行动、完整信息的有限 2×2 博弈；p 为玩家 1 选行 0 的概率，q 为玩家 2 选列 0 的概率。", "枚举全部支持及其最佳回应条件，保留并列导致的概率区间/矩形；不把连续解集算成有限个混合均衡。", "重复面板独立使用 T>R>P>S 的囚徒困境收益，无限期、共同 δ∈[0,1)、完美监测和可信永远惩罚。", "合作可维持表示 grim-trigger 满足单次偏离约束，不证明唯一均衡。已知有限期限下不能直接套用该条件。"],
    fields: [...["00", "01", "10", "11"].flatMap(cell => [field(`r${cell}`, `格 ${cell} 玩家 1 收益`, "收益单位", -20, 20), field(`c${cell}`, `格 ${cell} 玩家 2 收益`, "收益单位", -20, 20)]), field("R", "互相合作收益 R", "收益单位/期", -20, 20), field("S", "单方合作收益 S", "收益单位/期", -20, 20), field("T", "单次背离收益 T", "收益单位/期", -20, 20), field("P", "互相背离收益 P", "收益单位/期", -20, 20), field("delta", "共同折现因子 δ", "比例", 0, .99, .01)],
    defaults: { ...pennies, ...repeatedPD },
    presets: [
      { label: "正反面零和", parameters: { ...pennies } },
      { label: "协调", parameters: { r00: 2, c00: 2, r01: 0, c01: 0, r10: 0, c10: 0, r11: 1, c11: 1 } },
      { label: "囚徒困境矩阵", parameters: { r00: 3, c00: 3, r01: 0, c01: 5, r10: 5, c10: 0, r11: 1, c11: 1 } },
      { label: "全部并列：连续均衡", parameters: { r00: 1, c00: 1, r01: 1, c01: 1, r10: 1, c10: 1, r11: 1, c11: 1 } },
      { label: "缺乏耐心：合作不能维持", parameters: { delta: .25 } },
    ],
  },
];

function finite(value: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError(`${name} 必须是有限数值。`);
  return value;
}
function nonnegative(value: number, name: string): void { if (finite(value, name) < 0) throw new RangeError(`${name} 不能小于 0。`); }
function positive(value: number, name: string): void { if (finite(value, name) <= 0) throw new RangeError(`${name} 必须大于 0。`); }
function definition(id: ExtensionLabId): ExtensionLabDefinition {
  const result = extensionLabDefinitions.find(entry => entry.id === id);
  if (!result) throw new RangeError("未知进阶实验 ID。");
  return result;
}
export function extensionDefaults(id: ExtensionLabId): ExtensionParameters { return { ...definition(id).defaults }; }
function validateShape(id: ExtensionLabId, input: ExtensionParameters): ExtensionParameters {
  const defaults = definition(id).defaults;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new RangeError("实验参数必须是数值对象。");
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(defaults, key)) throw new RangeError(`未知参数 ${key}。`);
    finite(input[key], key);
  }
  for (const key of Object.keys(defaults)) if (!Object.hasOwn(input, key)) throw new RangeError(`缺少参数 ${key}。`);
  return { ...input };
}
const row = (key: string, label: string, value: number | string | null, unit = "") => ({ key, label, value, unit });
const numericRows = (metrics: Record<string, number | null>, labels: Record<string, [string, string]>) => Object.entries(labels).map(([key, [label, unit]]) => row(key, label, metrics[key], unit));
const curve = (label: string, fn: (x: number) => number, low = 0, high = 1) => ({ label, points: Array.from({ length: 61 }, (_, i) => { const x = low + (high - low) * i / 60; return { x, y: fn(x) }; }) });
function checkedResult(result: ExtensionLabResult): ExtensionLabResult {
  for (const [key, value] of Object.entries(result.metrics)) if (value !== null) finite(value, `计算结果 ${key}`);
  for (const entry of result.rows) if (typeof entry.value === "number") finite(entry.value, `表格 ${entry.key}`);
  for (const line of result.curves) for (const point of line.points) { finite(point.x, `曲线 ${line.label} x`); finite(point.y, `曲线 ${line.label} y`); }
  return result;
}

function compensation(p: ExtensionParameters): ExtensionLabResult {
  const { m, px0, px1, py, alpha } = p;
  nonnegative(m, "收入 m"); positive(px0, "原价 px₀"); positive(px1, "新价 px₁"); positive(py, "价格 py");
  if (alpha <= 0 || alpha >= 1) throw new RangeError("α 必须严格在 (0,1) 内。");
  const choice = (income: number, price: number) => ({ x: alpha * income / price, y: (1 - alpha) * income / py });
  const utility = (x: number, y: number) => x === 0 || y === 0 ? 0 : Math.exp(alpha * Math.log(x) + (1 - alpha) * Math.log(y));
  const original = choice(m, px0), changed = choice(m, px1);
  const slutskyIncome = px1 * original.x + py * original.y;
  // The dual e(p,u)=u*(px/α)^α*(py/(1−α))^(1−α).
  // With only px changing, e(p1,u0)=m*(px1/px0)^α. Logarithms
  // avoid overflow in the price ratio, without changing the economic inputs.
  const hicksIncome = m === 0 || px1 === px0 ? m : Math.exp(Math.log(m) + alpha * (Math.log(px1) - Math.log(px0)));
  const slutsky = choice(slutskyIncome, px1), hicks = choice(hicksIncome, px1);
  if (m > 0) for (const [key, value] of Object.entries({ x0: original.x, y0: original.y, x1: changed.x, y1: changed.y, hicksIncome, hicksX: hicks.x, hicksY: hicks.y })) positive(value, `正预算内点 ${key}（数值范围不足时请换计价单位）`);
  const metrics = {
    x0: original.x, y0: original.y, x1: changed.x, y1: changed.y,
    slutskyIncome, slutskyX: slutsky.x, slutskyY: slutsky.y,
    slutskySubstitution: slutsky.x - original.x, slutskyIncomeEffect: changed.x - slutsky.x,
    hicksIncome, hicksX: hicks.x, hicksY: hicks.y,
    hicksSubstitution: hicks.x - original.x, hicksIncomeEffect: changed.x - hicks.x,
    totalEffect: changed.x - original.x,
    u0: utility(original.x, original.y), u1: utility(changed.x, changed.y),
    slutskyUtility: utility(slutsky.x, slutsky.y), hicksUtility: utility(hicks.x, hicks.y),
  };
  const budget = (label: string, income: number, price: number) => ({ label, points: [{ x: 0, y: income / py }, { x: income / price, y: 0 }] });
  return {
    status: m === 0 ? "零预算：所有补偿与数量退化为零；不取 log(0)" : px1 === px0 ? "价格不变：两种分解均为零" : "有限价格变化：两种补偿各自加总为同一总效应",
    metrics,
    rows: numericRows(metrics, {
      x0: ["原价选择 x₀", "x"], y0: ["原价选择 y₀", "y"], x1: ["新价原收入选择 x₁", "x"], y1: ["新价原收入选择 y₁", "y"],
      slutskyIncome: ["Slutsky 补偿收入（买得起原组合）", "货币"], slutskyX: ["Slutsky 补偿选择 xˢ", "x"], slutskyY: ["Slutsky 补偿选择 yˢ", "y"],
      slutskySubstitution: ["Slutsky 替代效应 xˢ−x₀", "x"], slutskyIncomeEffect: ["Slutsky 收入效应 x₁−xˢ", "x"],
      hicksIncome: ["Hicks 最低补偿收入（保持原效用）", "货币"], hicksX: ["Hicks 补偿选择 xʰ", "x"], hicksY: ["Hicks 补偿选择 yʰ", "y"],
      hicksSubstitution: ["Hicks 替代效应 xʰ−x₀", "x"], hicksIncomeEffect: ["Hicks 收入效应 x₁−xʰ", "x"], totalEffect: ["总效应 x₁−x₀", "x"],
      u0: ["原选择效用 u₀", "本表示刻度"], u1: ["新价原收入效用", "本表示刻度"], slutskyUtility: ["Slutsky 补偿后的效用", "本表示刻度"], hicksUtility: ["Hicks 补偿后的效用（=u₀）", "本表示刻度"],
    }),
    curves: [budget("原价预算", m, px0), budget("新价原收入", m, px1), budget("Slutsky 补偿预算", slutskyIncome, px1), budget("Hicks 补偿预算", hicksIncome, px1)],
    xLabel: "x 数量（x）", yLabel: "y 数量（y）",
    notes: ["Slutsky：mˢ=px₁x₀+pyy₀；原组合在新预算线上，但重新优化后的效用通常更高。Hicks：mʰ=e(px₁,py,u₀)，最低支出保持原效用。", "分别有 Δx=(xˢ−x₀)+(x₁−xˢ)=(xʰ−x₀)+(x₁−xʰ)。有限变化不能把两种补偿的替代效应互换。", "价格上升时本 CD 模型的两种替代效应和收入效应均非正；这是该偏好族的条件性结论，不排除其他模型中的劣等品或 Giffen 情形。", "价格与全部收入同乘正数不改变实际组合；单独缩放 m 按比例缩放数量。m=0 时只有原点，效用为零，无须对数内点条件。"],
  };
}

function entry(p: ExtensionParameters): ExtensionLabResult {
  const { F, c, d, A, B, n } = p;
  nonnegative(F, "F"); nonnegative(c, "c"); positive(d, "d"); nonnegative(A, "A"); positive(B, "B");
  if (!Number.isSafeInteger(n) || n < 1 || n > Number.MAX_SAFE_INTEGER - 2) throw new RangeError("初始企业数 n 必须是可表示的正整数，并保留 n+1 的精确范围。");
  const gap = finite(A - B * c, "净需求截距 A−Bc");
  const dB = finite(d * B, "供给需求斜率乘积 dB");
  const market = (count: number) => {
    const q = gap <= 0 ? 0 : gap / (count + dB);
    if (gap > 0) positive(q, "正交易企业产量（数值范围不足时请换计价单位）");
    const price = q > 0 ? c + d * q : null;
    return { q, price, Q: count * q, profit: d * q * q / 2 - F };
  };
  const short = market(n);
  const qFirm = F === 0 ? 0 : Math.sqrt(2 * F / d);
  if (F > 0) positive(qFirm, "长期单家产量（数值范围不足时请換计价单位）");
  const pLR = c + d * qFirm, QLR = Math.max(0, A - B * pLR);
  const nLR = F === 0 ? (QLR > 0 ? null : 0) : QLR / qFirm;
  // A finite integer count solves π(n)>=0 and π(n+1)<=0.
  // Start from the continuous crossing, then compare the actual n and n+1
  // profits. This protects strict near-boundary differences from a floor
  // computed with an independently rounded square root.
  let integerN: number | null = null;
  if (F > 0) {
    if (nLR === null || !Number.isFinite(nLR) || nLR > Number.MAX_SAFE_INTEGER - 2) throw new RangeError("长期企业数超出可精确枚举的整数范围，请换参数或计价单位。");
    integerN = Math.floor(nLR);
    if (integerN > 0 && market(integerN).profit < 0) integerN -= 1;
    if (market(integerN + 1).profit > 0) integerN += 1;
    if ((integerN > 0 && market(integerN).profit < 0) || market(integerN + 1).profit > 0) throw new RangeError("企业数边界无法以当前数值精度判定，请调整计价单位。");
  } else if (QLR === 0) integerN = 0;
  const operating = integerN !== null && integerN > 0 ? market(integerN) : null;
  const entrantProfit = integerN === null ? null : market(integerN + 1).profit;
  const incumbentProfit = operating?.profit ?? null;
  const integerMinN = integerN === null ? null : F === 0 ? 0 : incumbentProfit === 0 ? integerN - 1 : integerN;
  const metrics = {
    shortRunPrice: short.price, shortRunQ: short.Q, shortRunFirmQ: short.q, shortRunProfit: short.profit,
    pLR, qFirm, QLR, nLR, profitLR: F > 0 && QLR > 0 ? 0 : null,
    integerN, integerMinN, integerMaxN: F === 0 ? null : integerN, integerPrice: operating?.price ?? null, integerQ: operating?.Q ?? (integerN === 0 ? 0 : null),
    incumbentProfit, entrantProfit,
  };
  const qMax = A;
  const curves = [curve("市场：反需求", Q => (A - Q) / B, 0, qMax), curve("市场：初始 n 家反供给", Q => c + d * Q / n, 0, qMax), curve("市场：长期 min AC / F=0 时的 AC 下确界", () => pLR, 0, qMax)];
  if (integerN !== null && integerN > 0) curves.push(curve("市场：整数均衡企业数的反供给", Q => c + d * Q / integerN!, 0, qMax));
  const countMax = Math.max(10, n + 1, integerN === null ? 10 : integerN + 2);
  const counts = [...new Set(Array.from({ length: 61 }, (_, i) => 1 + Math.floor((countMax - 1) * i / 60)))];
  curves.push({ label: "利润：各整数 n 重新均衡后的每家利润", points: counts.map(x => ({ x, y: market(x).profit })) }, { label: "利润：退出收益 / 零利润线", points: [{ x: 1, y: 0 }, { x: countMax, y: 0 }] });
  return {
    status: F === 0 && QLR > 0 ? "F=0 且正需求：有限企业仍有正利润，零利润仅为无限进入极限" : integerN === 0 ? "长期全部退出：单家进入也不能获得正利润" : "连续零利润基准与整数自由进入条件分别求解",
    metrics,
    rows: [...numericRows(metrics, {
      shortRunPrice: ["既定 n 的短期成交价（零交易未定义）", "货币/商品"], shortRunQ: ["短期市场交易量", "商品"], shortRunFirmQ: ["短期每家产量", "商品/家"], shortRunProfit: ["短期每家经济利润（F 尚不可避免）", "货币/家"],
      pLR: ["长期 min AC；F=0 为未取得的下确界", "货币/商品"], qFirm: ["min AC 的单家规模；F=0 为极限 0", "商品/家"], QLR: ["成本基准价格下需求量", "商品"], nLR: ["连续长期企业数（无有限解为未定义）", "家"], profitLR: ["连续基准活跃企业利润（没有活跃企业未定义）", "货币/家"],
      integerN: ["选取的整数均衡企业数（无交易约定 0）", "家"], integerMinN: ["弱自由进入条件的最小整数企业数", "家"], integerMaxN: ["弱自由进入条件的最大整数企业数（无有限上界留空）", "家"], integerPrice: ["整数企业均衡成交价（零交易未定义）", "货币/商品"], integerQ: ["整数企业均衡交易量", "商品"], incumbentProfit: ["现存企业利润 π(n)（没有现存企业未定义）", "货币/家"], entrantProfit: ["假设第 n+1 家进入后重新均衡的利润 π(n+1)", "货币/家"],
    }), row("integer-equilibria", "全部整数企业数解", integerN === null ? "无有限企业数均衡" : F === 0 ? "任何非负整数企业数均为弱无交易均衡；约定采用 0 家" : integerMinN === integerN ? `${integerN}` : `${integerMinN}、${integerN}`, "家")],
    curves, xLabel: "分图：市场 Q（商品） / 整数企业数 n（家）", yLabel: "分图：价格（货币/商品） / 每家利润（货币/家）",
    notes: ["短期给定 n：q(n)=max(0,(A−Bc)/(n+dB))，p(n)=c+dq(n)，Q=nq；F 不改变短期供给，但改变利润。无交易时没有实际成交价。", "F>0 时 AC=F/q+c+dq/2；q*=√(2F/d)，min AC=c+√(2Fd)，连续 n*=max(0,A−B·min AC)/q*。需求不足时无活跃企业，min AC 是成本基准，不能称为实际成交价。", "整数条件是 π(n)=dq(n)²/2−F≥0、π(n+1)≤0；新企业进入会改变所有企业面对的均衡价。n=0 只检查假设单家进入的利润。零利润边界上相邻两个企业数都满足弱条件。", F === 0 ? "F=0 时 AC=c+dq/2 对所有正 q 都大于 c，min AC 在正产量域没有取得。正需求下任意有限 n 利润为正，因此没有有限自由进入均衡；无需求且 F=0 时闲置企业无成本，企业数不唯一，采用 0 家约定。" : "整数企业数通常有正利润，不能把连续零利润公式强行用于整数市场。利润图只采样整数企业数，连线只是阅读辅助。", "这是退出/进入条件的静态比较，不提供现实的调整速度、稳定性或 Cournot 战略产量结论。"],
  };
}

export type ProbabilityInterval = [number, number];
export type EquilibriumRegion = { p: ProbabilityInterval; q: ProbabilityInterval };
type SignCondition = "nonnegative" | "nonpositive" | "zero";

/** Exact comparisons preserve strict payoff differences; no displayed-decimal
 * tolerance turns near ties into true indifference. The rectangle boundaries
 * are computed from a linear indifference condition in double precision.
 */
function linearFeasible(at0: number, at1: number, condition: SignCondition): ProbabilityInterval | null {
  finite(at0, "最佳回应收益差"); finite(at1, "最佳回应收益差");
  if (condition === "zero") {
    if (at0 === 0 && at1 === 0) return [0, 1];
    if (at0 === 0) return [0, 0];
    if (at1 === 0) return [1, 1];
    if ((at0 > 0) === (at1 > 0)) return null;
    const root = at0 / (at0 - at1);
    return [root, root];
  }
  const accepts = (value: number) => condition === "nonnegative" ? value >= 0 : value <= 0;
  const low = accepts(at0), high = accepts(at1);
  if (low && high) return [0, 1];
  if (!low && !high) return null;
  const root = at0 / (at0 - at1);
  return low ? [0, root] : [root, 1];
}
function intersection(a: ProbabilityInterval, b: ProbabilityInterval | null): ProbabilityInterval | null {
  if (b === null) return null;
  const low = Math.max(a[0], b[0]), high = Math.min(a[1], b[1]);
  return low > high ? null : [low, high];
}
function contained(a: EquilibriumRegion, b: EquilibriumRegion): boolean { return a.p[0] >= b.p[0] && a.p[1] <= b.p[1] && a.q[0] >= b.q[0] && a.q[1] <= b.q[1]; }
function equalRegion(a: EquilibriumRegion, b: EquilibriumRegion): boolean { return contained(a, b) && contained(b, a); }

/** The full Nash set of a finite 2×2 game, including continua. Enumerating the
 * three row supports and three column supports produces 9 closed rectangles.
 * Boundary closures are safe: an unused action tied with a used action can
 * also be assigned probability zero. Contained duplicate sets are removed.
 */
export function enumerateEquilibriumRegions(p: ExtensionParameters): EquilibriumRegion[] {
  for (const cell of ["00", "01", "10", "11"]) { finite(p[`r${cell}`], `r${cell}`); finite(p[`c${cell}`], `c${cell}`); }
  const row0 = p.r01 - p.r11, row1 = p.r00 - p.r10;
  const column0 = p.c10 - p.c11, column1 = p.c00 - p.c01;
  // A finite subtraction can overflow for opposed huge finite payoffs.
  for (const value of [row0, row1, column0, column1, row0 - row1, column0 - column1]) finite(value, "收益差数值范围");
  const supports: { range: ProbabilityInterval; condition: SignCondition }[] = [{ range: [1, 1], condition: "nonnegative" }, { range: [0, 0], condition: "nonpositive" }, { range: [0, 1], condition: "zero" }];
  const regions: EquilibriumRegion[] = [];
  for (const rs of supports) for (const cs of supports) {
    const P = intersection(rs.range, linearFeasible(column0, column1, cs.condition));
    const Q = intersection(cs.range, linearFeasible(row0, row1, rs.condition));
    if (P !== null && Q !== null) regions.push({ p: P, q: Q });
  }
  return regions.filter((region, i) => !regions.some((other, j) => j !== i && contained(region, other) && (!equalRegion(region, other) || j < i)));
}

function strategies(p: ExtensionParameters): ExtensionLabResult {
  const { R, S, T, P, delta } = p;
  if (!(T > R && R > P && P > S)) throw new RangeError("无限重复面板要求严格囚徒困境 T>R>P>S；矩阵面板的收益独立设置。");
  if (delta < 0 || delta >= 1) throw new RangeError("折现因子 δ 必须在 [0,1)。");
  const regions = enumerateEquilibriumRegions(p);
  const intervalIsPoint = (interval: ProbabilityInterval) => interval[0] === interval[1];
  const endpoint = (value: number) => value === 0 || value === 1;
  const continuumCount = regions.filter(region => !intervalIsPoint(region.p) || !intervalIsPoint(region.q)).length;
  const nonpurePoints = regions.filter(region => intervalIsPoint(region.p) && intervalIsPoint(region.q) && (!endpoint(region.p[0]) || !endpoint(region.q[0])));
  let pureCount = 0;
  for (let i = 0; i < 2; i += 1) for (let j = 0; j < 2; j += 1) if (p[`r${i}${j}`] >= p[`r${1 - i}${j}`] && p[`c${i}${j}`] >= p[`c${i}${1 - j}`]) pureCount += 1;
  const threshold = finite((T - R) / (T - P), "grim-trigger 折现阈值");
  const cooperationValue = R / (1 - delta), deviationValue = T + delta * P / (1 - delta);
  const uniqueNonpure = continuumCount === 0 && nonpurePoints.length === 1 ? nonpurePoints[0] : null;
  const metrics = { pureCount, mixedCount: continuumCount === 0 ? nonpurePoints.length : null, mixedP: uniqueNonpure?.p[0] ?? null, mixedQ: uniqueNonpure?.q[0] ?? null, continuumCount, threshold, cooperationValue, deviationValue, sustainable: delta >= threshold ? 1 : 0 };
  const range = (interval: ProbabilityInterval) => interval[0] === interval[1] ? `${interval[0]}` : `[${interval[0]}, ${interval[1]}]`;
  const maxDelta = Math.max(.95, delta);
  return {
    status: continuumCount > 0 ? "全部 Nash 解集包含连续概率集合；重复博弈条件另行计算" : `全部 Nash 解集：${pureCount} 个纯策略、${nonpurePoints.length} 个非纯孤立解；重复博弈独立面板`,
    metrics,
    rows: [...numericRows(metrics, { pureCount: ["纯策略 Nash 点数", "个"], mixedCount: ["非纯孤立 Nash 解数（连续集时不作有限计数）", "个"], mixedP: ["唯一非纯孤立解：行 0 概率 p", "概率"], mixedQ: ["唯一非纯孤立解：列 0 概率 q", "概率"], continuumCount: ["最大连续概率区域数（不是均衡点数）", "个区域"], threshold: ["grim-trigger 条件 δ≥(T−R)/(T−P)", "折现因子"], cooperationValue: ["永远合作现值 R/(1−δ)", "折现收益"], deviationValue: ["单次偏离后永远受惩罚 T+δP/(1−δ)", "折现收益"], sustainable: ["该 grim-trigger 下合作可维持（1是/0否）", "代码" ] }),
      ...["00", "01", "10", "11"].map(cell => row(`cell${cell}`, `矩阵行动 ${cell}`, `(${p[`r${cell}`]}, ${p[`c${cell}`]})`, "两人收益")),
      ...regions.map((region, i) => row(`equilibrium${i}`, `全部 Nash 解区域 ${i + 1}`, `p∈${range(region.p)}；q∈${range(region.q)}`, "概率；区间含端点")),
    ],
    curves: [curve("最佳回应：玩家 1 行 0−行 1 收益差（横轴 q）", q => q * (p.r00 - p.r10) + (1 - q) * (p.r01 - p.r11)), curve("最佳回应：玩家 2 列 0−列 1 收益差（横轴 p）", prob => prob * (p.c00 - p.c01) + (1 - prob) * (p.c10 - p.c11)), curve("最佳回应：无差异零线", () => 0), curve("重复博弈：永远合作现值", discount => R / (1 - discount), 0, maxDelta), curve("重复博弈：单次偏离及永久惩罚现值", discount => T + discount * P / (1 - discount), 0, maxDelta)],
    xLabel: "分图：对手行动 0 概率 / 折现因子 δ", yLabel: "分图：即时收益差 / 无限重复折现收益",
    notes: ["设 p 为行 0 概率、q 为列 0 概率。玩家 1 的收益差 Dᵣ(q)=q(r00−r10)+(1−q)(r01−r11)：p=1 要求 Dᵣ≥0，p=0 要求 Dᵣ≤0，0<p<1 要求 Dᵣ=0；玩家 2 同理。", "完整支持枚举同时解两人的最佳回应。输出的是闭区间矩形的并集，包含纯点、孤立混合点和并列导致的连续解；删除被其他区域完全包含的重复区域，交叉处可以同时属于两个区域。", "概率混合是有意的独立随机化，不等于不完整信息或系统自动替玩家选择。收益差的零点是让对手无差异的概率，不是自己收益最高时的混合概率。", "重复面板的 R/S/T/P 与上方矩阵相互独立。完美监测且永久惩罚为阶段 Nash 时，R/(1−δ)≥T+δP/(1−δ) 化为 δ≥(T−R)/(T−P)。满足仅说明这种策略可维持合作，不保证实际合作或唯一性。", "已知有限期且阶段囚徒困境有唯一背离均衡时，向后归纳得到各期背离；不满足无限期前提时，不得套用 grim-trigger 折现阈值。监测噪声、执行错误或不同惩罚规则需重新建模。"],
  };
}

export function runExtensionLab(id: ExtensionLabId, input: ExtensionParameters): ExtensionLabResult {
  const parameters = validateShape(id, input);
  const result = id === "MX01" ? compensation(parameters) : id === "MX02" ? entry(parameters) : strategies(parameters);
  return checkedResult(result);
}
