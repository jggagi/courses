/** Pure kernels for synthetic ML04–ML11. Mathematical domains are independent
 * of the suggested UI ranges. Economic corners are derived, never input clamps.
 * Undefined transaction prices and empty logarithmic domains use null.
 */
export const ADVANCED_LAB_IDS = ["ML04", "ML05", "ML06", "ML07", "ML08", "ML09", "ML10", "ML11"] as const;
export type AdvancedLabId = (typeof ADVANCED_LAB_IDS)[number];
export type AdvancedParameters = Record<string, number>;
export type AdvancedLabDefinition = {
  id: AdvancedLabId;
  title: string;
  modelId: string;
  question: string;
  assumptions: string[];
  fields: { key: string; label: string; unit: string; min: number; max: number; step: number }[];
  defaults: AdvancedParameters;
  presets?: { label: string; parameters: AdvancedParameters }[];
};
export type AdvancedLabResult = {
  status: string;
  metrics: Record<string, number | null>;
  rows: { key: string; label: string; value: number | string | null; unit: string }[];
  curves: { label: string; points: { x: number; y: number }[] }[];
  xLabel: string;
  yLabel: string;
  notes: string[];
};

const field = (key: string, label: string, unit: string, min: number, max: number, step = 1) => ({ key, label, unit, min, max, step });
const marketFields = [field("A", "需求截距 A", "货币/商品", 1, 300), field("B", "反需求斜率 B", "货币/商品²", .1, 10, .1), field("C", "供给截距 C", "货币/商品", 0, 299), field("D", "反供给斜率 D", "货币/商品²", .1, 10, .1)];
const gameDefaults = { r00: 3, c00: 3, r01: 0, c01: 5, r10: 5, c10: 0, r11: 1, c11: 1 };

export const advancedLabDefinitions: AdvancedLabDefinition[] = [
  {
    id: "ML04", title: "成本、供给与市场", modelId: "quadratic-cost-competitive-market",
    question: "亏损企业为什么可能仍生产？企业供给怎样加总成市场？",
    assumptions: ["synthetic：同型价格接受企业、同质商品，无容量上限。", "F 在短期不可避免，停产仍支付 F；不模拟长期进入退出。", "个别企业报价 p 与市场均衡价是两项不同的反事实。"],
    fields: [field("F", "固定成本 F", "货币", 0, 300), field("c", "初始边际成本 c", "货币/商品", 0, 30), field("d", "边际成本斜率 d", "货币/商品²", .1, 10, .1), field("p", "企业面对的价格 p", "货币/商品", 0, 50), field("n", "同型企业数 n", "家", 1, 100), field("A", "市场需求数量截距 A", "商品", 1, 500), field("B", "市场需求价格响应 B", "商品²/货币", .1, 30, .1)],
    defaults: { F: 20, c: 2, d: 1, p: 8, n: 10, A: 100, B: 5 },
    presets: [{ label: "价格升至 9", parameters: { p: 9 } }, { label: "固定成本增加", parameters: { F: 60 } }, { label: "价格低于停产阈值", parameters: { p: 1 } }],
  },
  {
    id: "ML05", title: "税楔与福利", modelId: "linear-tax-wedge",
    question: "法定缴税方改变，会改变买卖双方最终承担的税负吗？",
    assumptions: ["synthetic：竞争市场，Pb=A−Bq，Ps=C+Dq，无外部性及其他扭曲。", "A>C≥0，B,D>0，单位税 τ≥0；税收为转移。", "无交易时没有唯一实际成交价；价格字段留空。"],
    fields: [...marketFields, field("tau", "单位税 τ", "货币/商品", 0, 300), field("legalPayer", "法定缴税方（0卖方/1买方）", "代码", 0, 1)],
    defaults: { A: 100, B: 1, C: 20, D: 1, tau: 20, legalPayer: 0 },
    presets: [{ label: "无税", parameters: { tau: 0 } }, { label: "买方法定缴税", parameters: { legalPayer: 1 } }, { label: "截断：无交易", parameters: { tau: 80 } }],
  },
  {
    id: "ML06", title: "竞争与单一定价垄断", modelId: "linear-monopoly",
    question: "固定资源成本、边际成本和加价分别改变什么？",
    assumptions: ["synthetic：P=a−bQ，成本 F+cQ，a>c≥0，b>0。", "结果条件于运营；同一固定资源成本在各制度剩余中扣除一次。", "只模拟单一定价，不模拟网络效应、创新、价格歧视或进入。"],
    fields: [field("a", "反需求截距 a", "货币/商品", 1, 300), field("b", "反需求斜率 b", "货币/商品²", .1, 10, .1), field("c", "边际成本 c", "货币/商品", 0, 299), field("F", "固定资源成本 F", "货币", 0, 5000)],
    defaults: { a: 100, b: 1, c: 20, F: 20 },
    presets: [{ label: "固定成本增加", parameters: { F: 1800 } }, { label: "边际成本增加", parameters: { c: 40 } }],
  },
  {
    id: "ML07", title: "最佳回应与规则", modelId: "finite-two-player-game",
    question: "哪些行动相互最佳回应？共同改善为什么不等于单方有动机改变？",
    assumptions: ["synthetic：同时行动、完整信息、两位玩家各两项行动。", "只枚举所有纯策略 Nash 均衡，保留收益并列；零个不表示无混合均衡。", "Pareto 改善表示两人均不受损且至少一人严格获益，独立于最佳回应。"],
    fields: ["00", "01", "10", "11"].flatMap(cell => [field(`r${cell}`, `格 ${cell} 玩家 1 收益`, "收益单位", -20, 20), field(`c${cell}`, `格 ${cell} 玩家 2 收益`, "收益单位", -20, 20)]),
    defaults: gameDefaults,
    presets: [
      { label: "囚徒困境", parameters: { ...gameDefaults } },
      { label: "协调", parameters: { r00: 2, c00: 2, r01: 0, c01: 0, r10: 0, c10: 0, r11: 1, c11: 1 } },
      { label: "正反面零和", parameters: { r00: 1, c00: -1, r01: -1, c01: 1, r10: -1, c10: 1, r11: 1, c11: -1 } },
      { label: "全部并列", parameters: { r00: 1, c00: 1, r01: 1, c01: 1, r10: 1, c10: 1, r11: 1, c11: 1 } },
    ],
  },
  {
    id: "ML08", title: "把外部影响计入", modelId: "linear-external-damage",
    question: "哪些损害未进入私人账本？一项税何时改善社会净收益？",
    assumptions: ["synthetic：竞争需求 A−Bq，私人边际成本 C+Dq，边际外部损害 eq。", "e≥0，损害可准确观测，征税执行无成本；不据此推荐现实税率。", "社会净收益扣除真实损害，税收只转移；不将税收入再加一遍。"],
    fields: [...marketFields, field("e", "边际外部损害斜率 e", "货币/商品²", 0, 10, .1), field("tau", "实际单位税 τ", "货币/商品", 0, 300)],
    defaults: { A: 100, B: 1, C: 20, D: 1, e: 2, tau: 40 },
    presets: [{ label: "无外部性、无税", parameters: { e: 0, tau: 0 } }, { label: "损害存在但未纠正", parameters: { tau: 0 } }, { label: "过度征税、无交易", parameters: { tau: 80 } }],
  },
  {
    id: "ML09", title: "质量、信息与参与", modelId: "quality-participation-belief-update",
    question: "从所有类型都参与的信念出发，报价和参与者怎样相互改变？",
    assumptions: ["synthetic：买方风险中性，价格等于当前参与者平均买方价值。", "sH≥sL≥0，vH≥vL≥0，θ 是初始高质量份额；报价等于保留价值时接受。", "从全部现存类型参与开始，逐轮剔除拒绝者；指定更新规则不证明唯一均衡。", "认证能验证真实类型，费用仅在认证交易发生时支付，卖方可以拒绝。"],
    fields: [field("sL", "低质量保留价值 sL", "货币", 0, 30), field("sH", "高质量保留价值 sH", "货币", 0, 30), field("vL", "低质量买方价值 vL", "货币", 0, 40), field("vH", "高质量买方价值 vH", "货币", 0, 40), field("theta", "初始高质量比例 θ", "比例", 0, 1, .05), field("certificationFee", "认证费用", "货币/笔", 0, 20, .5)],
    defaults: { sL: 2, sH: 8, vL: 4, vH: 12, theta: .25, certificationFee: 1 },
    presets: [{ label: "高质量比例提高", parameters: { theta: .75 } }, { label: "阈值相等接受", parameters: { theta: .5 } }, { label: "认证费用过高", parameters: { certificationFee: 5 } }],
  },
  {
    id: "ML10", title: "风险、劳动与跨期预算", modelId: "expected-utility-intertemporal-labor",
    question: "把商品换成状态、日期或闲暇，约束和效用的哪部分改变了？",
    assumptions: ["synthetic：风险面板 u(w)=√w，w≥0；期望效用只保留正仿射表示不变性。", "跨期面板 log(c1)+βlog(c2)，r>−1，β>0；两个消费均须严格为正。", "劳动面板 (1−α)log(c)+αlog(闲暇)，c=非劳动收入+wage·劳动，时间 T。", "禁止借款是 c1≤y1 的额外约束；无正消费可行点时报告域不适用。"],
    fields: [field("wLow", "低状态财富", "货币", 0, 300), field("wHigh", "高状态财富", "货币", 0, 500), field("probHigh", "高状态概率", "概率", 0, 1, .05), field("y1", "本期收入 y1", "货币", 0, 300), field("y2", "下期收入 y2", "货币", 0, 300), field("r", "利率 r", "比例", -.9, 1, .05), field("beta", "下期效用权重 β", "权重", .05, 5, .05), field("noBorrow", "禁止借款（0否/1是）", "代码", 0, 1), field("T", "总时间 T", "小时", 0, 40), field("wage", "小时工资", "货币/小时", 0, 40), field("nonLabor", "非劳动收入", "货币", 0, 300), field("leisureWeight", "闲暇权重 α", "权重", .05, .95, .05)],
    defaults: { wLow: 0, wHigh: 100, probHigh: .5, y1: 20, y2: 180, r: 0, beta: 1, noBorrow: 0, T: 24, wage: 10, nonLabor: 40, leisureWeight: .5 },
    presets: [{ label: "禁止借款", parameters: { noBorrow: 1 } }, { label: "两期等额收入", parameters: { y1: 100, y2: 100, noBorrow: 0 } }, { label: "跨期零预算", parameters: { y1: 0, y2: 0 } }, { label: "劳动角点：选择全闲暇", parameters: { nonLabor: 300 } }],
  },
  {
    id: "ML11", title: "比较优势与贸易", modelId: "two-economy-linear-production-trade",
    question: "绝对效率更高的一方为什么仍可能从贸易中扩大可行选择？",
    assumptions: ["synthetic：两经济体、两产品、固定劳动、线性单位劳动需求。", "按比较优势完全专业化；相同机会成本时约定 A 产 x、B 产 y，不能宣称严格利得。", "tradeX 为 A 向 B 净出口 x（反向为负）；price 为每 x 交换的 y。", "CPF 仅展示受双方产量限制的双边交换段；可行扩大不替代偏好判断或分配分析。"],
    fields: [field("laborA", "A 劳动禀赋", "劳动单位", 0, 300), field("laborB", "B 劳动禀赋", "劳动单位", 0, 300), field("ax", "A 每 x 劳动需求", "劳动/x", .1, 10, .1), field("ay", "A 每 y 劳动需求", "劳动/y", .1, 10, .1), field("bx", "B 每 x 劳动需求", "劳动/x", .1, 10, .1), field("by", "B 每 y 劳动需求", "劳动/y", .1, 10, .1), field("price", "贸易相对价格", "y/x", .05, 10, .05), field("tradeX", "A→B 的 x 净出口（负数为反向）", "x", -300, 300)],
    defaults: { laborA: 120, laborB: 120, ax: 1, ay: 2, bx: 3, by: 3, price: .75, tradeX: 40 },
    presets: [{ label: "A 机会成本端点", parameters: { price: .5, tradeX: 40 } }, { label: "B 机会成本端点", parameters: { price: 1, tradeX: 40 } }, { label: "比较优势反向", parameters: { ax: 3, ay: 3, bx: 1, by: 2, price: .75, tradeX: -40 } }, { label: "不交换", parameters: { tradeX: 0 } }],
  },
];

function finite(value: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError(`${name} 必须是有限数值。`);
  return value;
}
function nonnegative(value: number, name: string): void { if (finite(value, name) < 0) throw new RangeError(`${name} 不能小于 0。`); }
function positive(value: number, name: string): void { if (finite(value, name) <= 0) throw new RangeError(`${name} 必须大于 0。`); }
function fraction(value: number, name: string): void { if (finite(value, name) < 0 || value > 1) throw new RangeError(`${name} 必须在 [0,1]。`); }
function binary(value: number, name: string): void { if (value !== 0 && value !== 1) throw new RangeError(`${name} 只能是 0 或 1。`); }
function getDefinition(id: AdvancedLabId): AdvancedLabDefinition {
  const definition = advancedLabDefinitions.find(entry => entry.id === id);
  if (!definition) throw new RangeError("未知高级实验 ID。");
  return definition;
}
export function advancedDefaults(id: AdvancedLabId): AdvancedParameters { return { ...getDefinition(id).defaults }; }
function validateShape(id: AdvancedLabId, input: AdvancedParameters): AdvancedParameters {
  const defaults = getDefinition(id).defaults;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new RangeError("实验参数必须是数值对象。");
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(defaults, key)) throw new RangeError(`未知参数 ${key}。`);
    finite(input[key], key);
  }
  for (const key of Object.keys(defaults)) if (!Object.hasOwn(input, key) && !(id === "ML05" && key === "legalPayer")) throw new RangeError(`缺少参数 ${key}。`);
  return id === "ML05" ? { legalPayer: 0, ...input } : { ...input };
}
const row = (key: string, label: string, value: number | string | null, unit = "") => ({ key, label, value, unit });
const curve = (label: string, max: number, fn: (q: number) => number, start = 0) => ({ label, points: Array.from({ length: 61 }, (_, i) => { const x = start + (max - start) * i / 60; return { x, y: fn(x) }; }) });
const numericRows = (metrics: Record<string, number | null>, labels: Record<string, [string, string]>, prefix = "") => Object.entries(labels).map(([key, [label, unit]]) => row(`${prefix}${key}`, label, metrics[key], unit));
function marketDomain(p: AdvancedParameters): void {
  positive(p.A, "A"); positive(p.B, "B"); nonnegative(p.C, "C"); positive(p.D, "D");
  if (p.A <= p.C) throw new RangeError("此模型要求需求截距 A 大于供给截距 C。");
}

function costMarket(p: AdvancedParameters): AdvancedLabResult {
  const { F, c, d, n, A, B } = p;
  nonnegative(F, "固定成本 F"); nonnegative(c, "初始边际成本 c"); positive(d, "成本斜率 d"); nonnegative(p.p, "价格 p"); positive(A, "需求截距 A"); positive(B, "需求响应 B");
  if (!Number.isInteger(n) || n < 1) throw new RangeError("企业数 n 必须是正整数。");
  const q = Math.max(0, (p.p - c) / d);
  const profit = p.p * q - F - c * q - d * q * q / 2;
  const trading = A / B > c;
  const marketPrice = trading ? (d * A + n * c) / (n + d * B) : null;
  const marketQuantity = marketPrice === null ? 0 : n * (marketPrice - c) / d;
  const metrics = { q, profit, mc: c + d * q, ac: q === 0 ? null : F / q + c + d * q / 2, avc: c + d * q / 2, shutdownProfit: -F, marketPrice, marketQuantity, marketFirmQ: marketQuantity / n };
  const qMax = Math.max(10, q * 1.4, marketQuantity / n * 1.4);
  return {
    status: q === 0 ? "企业停产；固定成本仍承担" : profit < 0 ? "企业短期亏损但继续生产" : "企业生产；结果条件于既定企业数",
    metrics,
    rows: numericRows(metrics, { q: ["给定 p 下企业产量", "商品"], profit: ["企业经济利润", "货币"], mc: ["边际成本 MC", "货币/商品"], ac: ["平均总成本 AC（零产量未定义）", "货币/商品"], avc: ["平均可变成本 AVC（零产量取右极限 c）", "货币/商品"], shutdownProfit: ["停产利润", "货币"], marketPrice: ["市场均衡价（无交易则未定义）", "货币/商品"], marketQuantity: ["市场交易量", "商品"], marketFirmQ: ["均衡时每家企业产量", "商品/家"] }),
    curves: [curve("企业：MC", qMax, x => c + d * x), curve("企业：AVC", qMax, x => c + d * x / 2), curve("企业：AC（q>0）", qMax, x => F / x + c + d * x / 2, qMax / 60), curve("市场：反需求", A, x => (A - x) / B), curve("市场：反供给", A, x => c + d * x / n)],
    xLabel: "企业 q / 市场 Q（商品；分图查看）", yLabel: "价格或单位成本（货币/商品）",
    notes: ["利润最大化在 p≤c 时取 q=0，p>c 时取 q=(p−c)/d。零产量的平均总成本没有定义。", "F 不改变 MC 和短期最优产量；亏损生产可能比停产后的 −F 更好。AVC(0) 展示 c 的右极限。", trading ? "市场联立 n(p−c)/d=A−Bp；该均衡只保证计划相容，不证明动态收敛。" : "需求最高愿付价 A/B 不超过供给起点 c，交易量为零。支持零交易的报价区间是 [A/B,c]：严格间隔时不唯一，相等时退化一点；没有实际成交价。", "图中企业 q 与总市场 Q 分开标记，不应混同单家和聚合数量。"],
  };
}

function taxes(p: AdvancedParameters): AdvancedLabResult {
  marketDomain(p); nonnegative(p.tau, "税 τ"); binary(p.legalPayer, "法定缴税方");
  const { A, B, C, D, tau } = p;
  const q0 = (A - C) / (B + D), q = Math.max(0, (A - C - tau) / (B + D));
  const buyerPrice = q === 0 ? null : A - B * q, sellerPrice = q === 0 ? null : C + D * q;
  const metrics = { q, q0, buyerPrice, sellerPrice, taxRevenue: tau * q, cs: B * q * q / 2, ps: D * q * q / 2, dwl: (B + D) * (q0 - q) ** 2 / 2, demandElasticity: q === 0 || buyerPrice === null ? null : -buyerPrice / (B * q), baselinePrice: C + D * q0, baselineSurplus: (B + D) * q0 * q0 / 2 };
  return {
    status: q === 0 ? "税达到截断点；无交易且成交价不唯一" : "存在交易；买卖双方价格差为单位税",
    metrics,
    rows: numericRows(metrics, { q0: ["无税交易量", "商品"], q: ["税后交易量", "商品"], buyerPrice: ["买方价 Pb", "货币/商品"], sellerPrice: ["卖方净价 Ps", "货币/商品"], taxRevenue: ["税收", "货币"], cs: ["消费者剩余 CS", "货币"], ps: ["生产者剩余 PS", "货币"], dwl: ["无谓损失 DWL", "货币"], demandElasticity: ["当前需求价格弹性（带符号；q=0 未定义）", "无量纲"], baselinePrice: ["无税均衡价", "货币/商品"], baselineSurplus: ["无税总剩余", "货币"] }),
    curves: [curve("反需求 Pb", A / B, x => A - B * x), curve("反供给 Ps", A / B, x => C + D * x), curve("供给加税楔 Ps+τ", A / B, x => C + D * x + tau)],
    xLabel: "交易量 q（商品）", yLabel: "价格（货币/商品）",
    notes: ["交易量是预算、需求与供给共同确定的经济角点；max(0,·) 是模型非负交易约束，不是裁剪输入。", "CS+PS+税收+DWL=无税总剩余；税收不是新增真实资源。", `法定缴税方为${p.legalPayer === 0 ? "卖方" : "买方"}。在这些竞争与遵从假设下，法定方不改变税楔、数量或最终价格。`, "弹性为 (dq/dPb)(Pb/q)=−Pb/(Bq)，不是反需求线的斜率 −B。"],
  };
}

function monopoly(p: AdvancedParameters): AdvancedLabResult {
  const { a, b, c, F } = p;
  positive(a, "a"); positive(b, "b"); nonnegative(c, "c"); nonnegative(F, "F");
  if (a <= c) throw new RangeError("此内点运营模型要求 a>c。");
  const competitiveQ = (a - c) / b, monopolyQ = (a - c) / (2 * b), monopolyPrice = a - b * monopolyQ;
  const surplus = (q: number) => (a - c) * q - b * q * q / 2 - F;
  const metrics = { competitiveQ, competitivePrice: c, monopolyQ, monopolyPrice, mr: a - 2 * b * monopolyQ, profit: (monopolyPrice - c) * monopolyQ - F, cs: b * monopolyQ * monopolyQ / 2, competitiveSurplus: surplus(competitiveQ), monopolySurplus: surplus(monopolyQ), dwl: b * (competitiveQ - monopolyQ) ** 2 / 2, competitiveProfit: -F, competitiveCS: b * competitiveQ * competitiveQ / 2 };
  return {
    status: metrics.profit < 0 ? "条件于运营的垄断解；利润为负，需另分析退出" : "条件于运营的单一定价垄断解",
    metrics,
    rows: numericRows(metrics, { competitiveQ: ["竞争产量", "商品"], competitivePrice: ["竞争价格", "货币/商品"], monopolyQ: ["垄断产量", "商品"], monopolyPrice: ["垄断价格", "货币/商品"], mr: ["垄断最优点 MR", "货币/商品"], profit: ["垄断利润（已扣 F）", "货币"], cs: ["垄断消费者剩余", "货币"], competitiveSurplus: ["竞争资源净剩余（已扣 F）", "货币"], monopolySurplus: ["垄断资源净剩余（已扣 F）", "货币"], dwl: ["条件于同样运营的无谓损失", "货币"], competitiveProfit: ["竞争运营利润", "货币"], competitiveCS: ["竞争消费者剩余", "货币"] }),
    curves: [curve("反需求 P", a / b, x => a - b * x), curve("边际收益 MR", a / b, x => a - 2 * b * x), curve("边际成本 MC", a / b, () => c)],
    xLabel: "市场产量 Q（商品）", yLabel: "价格、MR、MC（货币/商品）",
    notes: ["总收入 aQ−bQ² 的导数是 a−2bQ；MR=c 得到 Qm，二阶导数 −2b<0。", "固定成本是资源成本，在净剩余中扣一次；利润+CS=垄断资源净剩余。比较双方都运营时，固定成本在差额中抵消。", "F 改变利润及可持续运营条件，不能由条件于运营的数量直接断言企业必然进入或永远亏损生产。", "负的 MR 区域是代数曲线的有效部分，不把纵轴强行限制为非负。"],
  };
}

function game(p: AdvancedParameters): AdvancedLabResult {
  const cells = ["00", "01", "10", "11"];
  const equilibrium: string[] = [];
  const rows = cells.map(cell => {
    const i = Number(cell[0]), j = Number(cell[1]);
    const br1 = p[`r${cell}`] >= p[`r${1 - i}${j}`];
    const br2 = p[`c${cell}`] >= p[`c${i}${1 - j}`];
    if (br1 && br2) equilibrium.push(cell);
    return row(`cell${cell}`, `行动 (${i},${j})`, `收益 (${p[`r${cell}`]}, ${p[`c${cell}`]})；玩家 1 ${br1 ? "是" : "不是"}最佳回应；玩家 2 ${br2 ? "是" : "不是"}最佳回应；${br1 && br2 ? "纯策略 Nash 均衡" : "非 Nash 均衡"}`, "收益单位");
  });
  const improvements: string[] = [];
  for (const from of cells) for (const to of cells) {
    const weak = p[`r${to}`] >= p[`r${from}`] && p[`c${to}`] >= p[`c${from}`];
    const strict = p[`r${to}`] > p[`r${from}`] || p[`c${to}`] > p[`c${from}`];
    if (weak && strict) improvements.push(`${from}→${to}`);
  }
  rows.push(row("equilibria", "全部纯策略 Nash 均衡", equilibrium.length ? equilibrium.join("、") : "不存在"), row("pareto", "全部 Pareto 改善方向", improvements.length ? improvements.join("、") : "不存在"));
  return { status: equilibrium.length ? `找到 ${equilibrium.length} 个纯策略 Nash 均衡（保留全部并列）` : "没有纯策略 Nash 均衡；未求混合策略", metrics: { equilibriumCount: equilibrium.length, paretoImprovementCount: improvements.length }, rows, curves: [], xLabel: "玩家 1 行动", yLabel: "玩家 2 行动", notes: ["每列比较玩家 1 的行收益，每行比较玩家 2 的列收益；两者同时最佳回应才是 Nash。", "Pareto 改善计数是全部行动组合之间的有向改善对，并不限于从均衡出发。单方改变是否有利另看最佳回应。", "收益相等时所有并列行动均为最佳回应。矩阵没有描述时间、重复、混合策略或承诺机制。"] };
}

function externality(p: AdvancedParameters): AdvancedLabResult {
  marketDomain(p); nonnegative(p.e, "外部损害系数 e"); nonnegative(p.tau, "税 τ");
  const { A, B, C, D, e, tau } = p;
  const privateQ = (A - C) / (B + D), socialQ = (A - C) / (B + D + e), policyQ = Math.max(0, (A - C - tau) / (B + D));
  const welfare = (q: number) => (A - C) * q - (B + D + e) * q * q / 2;
  const metrics = { privateQ, socialQ, correctiveTax: e * socialQ, policyQ, privateWelfare: welfare(privateQ), socialWelfare: welfare(socialQ), policyWelfare: welfare(policyQ), privateAccountedSurplus: (A - C) * privateQ - (B + D) * privateQ * privateQ / 2, policyTaxRevenue: tau * policyQ };
  return {
    status: policyQ === 0 ? "政策使交易停止；不等于福利最优" : "对比私人均衡、社会基准和实际政策",
    metrics,
    rows: numericRows(metrics, { privateQ: ["未纠正私人均衡数量", "商品"], socialQ: ["社会净收益最大数量", "商品"], correctiveTax: ["模型内纠正税 e·qs", "货币/商品"], policyQ: ["实际税下数量", "商品"], privateWelfare: ["私人均衡下社会净收益", "货币"], socialWelfare: ["社会基准净收益", "货币"], policyWelfare: ["实际政策下社会净收益", "货币"], privateAccountedSurplus: ["私人账本总剩余（未扣损害）", "货币"], policyTaxRevenue: ["政策税收（仅转移）", "货币"] }),
    curves: [curve("反需求／边际愿付价", A / B, x => A - B * x), curve("私人边际成本", A / B, x => C + D * x), curve("社会边际成本", A / B, x => C + (D + e) * x), curve("实际含税私人边际成本", A / B, x => C + D * x + tau)],
    xLabel: "数量 q（商品）", yLabel: "边际愿付价/成本（货币/商品）",
    notes: ["社会净收益 = (A−C)q−(B+D+e)q²/2，边际外部损害 eq 的总积分为 eq²/2。", "最优税取 e·qs 而不是 e·q0；政策均衡于是等于社会基准。", "模型社会基准最大化既定净收益，不自动处理公平、执行成本、政府信息或现实政治约束。", "改变 e 不会直接移动私人未纠正均衡，改变税 τ 才改变该市场的私人激励。"],
  };
}

function quality(p: AdvancedParameters): AdvancedLabResult {
  for (const key of ["sL", "sH", "vL", "vH", "certificationFee"]) nonnegative(p[key], key);
  fraction(p.theta, "高质量比例 θ");
  if (p.sH < p.sL || p.vH < p.vL) throw new RangeError("高质量的保留价值和买方价值分别不得低于低质量类型。");
  const { sL, sH, vL, vH, theta, certificationFee } = p;
  let low = theta < 1, high = theta > 0;
  const rows: AdvancedLabResult["rows"] = [];
  let finalPrice: number | null = null;
  const initialPrice = (1 - theta) * vL + theta * vH;
  const prices: { x: number; y: number }[] = [];
  for (let round = 0; round < 4; round += 1) {
    const mass = (low ? 1 - theta : 0) + (high ? theta : 0);
    const belief = mass === 0 ? null : (high ? theta : 0) / mass;
    const price = belief === null ? null : (1 - belief) * vL + belief * vH;
    rows.push(row(`belief${round}`, `第 ${round} 轮报价前高质量信念`, belief, "比例"), row(`price${round}`, `第 ${round} 轮报价`, price, "货币"));
    if (price === null) { rows.push(row(`participation${round}`, `第 ${round} 轮参与`, "没有卖方，停止报价")); finalPrice = null; break; }
    prices.push({ x: round, y: price });
    const nextLow = low && price >= sL, nextHigh = high && price >= sH;
    rows.push(row(`participation${round}`, `第 ${round} 轮接受/退出`, `低质量：${!low ? "此前已退出或无该类型" : nextLow ? "接受" : `拒绝（报价<${sL}）`}；高质量：${!high ? "此前已退出或无该类型" : nextHigh ? "接受" : `拒绝（报价<${sH}）`}`));
    finalPrice = price;
    if (nextLow === low && nextHigh === high) break;
    low = nextLow; high = nextHigh;
  }
  const certifiedHighNet = vH - certificationFee - sH, certifiedLowNet = vL - certificationFee - sL;
  const metrics = { initialPrice, finalPrice, highParticipates: high ? 1 : 0, lowParticipates: low ? 1 : 0, certifiedHighNet, certifiedLowNet };
  rows.unshift(...numericRows(metrics, { initialPrice: ["初始全参与报价", "货币"], finalPrice: ["更新后最终成交价（无人参与则未定义）", "货币"], highParticipates: ["最终高质量参与（1是/0否）", "代码"], lowParticipates: ["最终低质量参与（1是/0否）", "代码"], certifiedHighNet: ["高质量认证净增益（已减保留价值）", "货币"], certifiedLowNet: ["低质量认证净增益（已减保留价值）", "货币"] }));
  rows.push(row("certification-participation", "可验证分离交易参与", `高质量${theta === 0 ? "不存在" : certifiedHighNet >= 0 ? "接受" : "拒绝"}；低质量${theta === 1 ? "不存在" : certifiedLowNet >= 0 ? "接受" : "拒绝"}`));
  return { status: finalPrice === null ? "更新后无人参与；没有实际成交价" : "按指定更新规则得到稳定参与集合", metrics, rows, curves: prices.length ? [{ label: "逐轮竞争报价（仅有参与者时）", points: prices }] : [], xLabel: "信念更新轮次", yLabel: "报价（货币）", notes: ["初始信念只含初始份额非零的类型，随后永久剔除拒绝类型，至多两次剔除后稳定。报价恰等于保留价值时接受。", "默认 θ=.25：第0轮信念 .25、报价6，高质量拒绝；第1轮信念0、报价4，低质量接受。", "这些轮次是明确指定的信念更新演示，不是全部信念自洽均衡的求解或唯一性证明。", "认证净增益=买方类型价值−认证费−卖方保留价值；负值卖方拒绝。认证并不总值得做。"] };
}

function riskTimeLabor(p: AdvancedParameters): AdvancedLabResult {
  for (const key of ["wLow", "wHigh", "y1", "y2", "T", "wage", "nonLabor"]) nonnegative(p[key], key);
  fraction(p.probHigh, "概率"); positive(p.beta, "β"); binary(p.noBorrow, "禁止借款");
  if (p.wHigh < p.wLow) throw new RangeError("高状态财富不能低于低状态财富。");
  if (p.r <= -1) throw new RangeError("利率 r 必须大于 −1。");
  if (p.leisureWeight <= 0 || p.leisureWeight >= 1) throw new RangeError("闲暇权重必须严格在 (0,1)。");
  const { wLow, wHigh, probHigh, y1, y2, r, beta, noBorrow, T, wage, nonLabor, leisureWeight } = p;
  const expectedWealth = (1 - probHigh) * wLow + probHigh * wHigh;
  const expectedUtility = (1 - probHigh) * Math.sqrt(wLow) + probHigh * Math.sqrt(wHigh);
  const certaintyEquivalent = expectedUtility ** 2;
  const presentWealth = y1 + y2 / (1 + r);
  const timeDomain = presentWealth > 0 && !(noBorrow === 1 && y1 === 0);
  let c1: number | null = null, c2: number | null = null, borrowing: number | null = null, intertemporalUtility: number | null = null;
  if (timeDomain) {
    const unconstrained = presentWealth / (1 + beta);
    // KKT boundary is solved explicitly: if c1<=y1 binds, set c1=y1 and
    // recompute c2 from the full budget, rather than clipping both solutions.
    c1 = noBorrow === 1 && unconstrained > y1 ? y1 : unconstrained;
    c2 = (presentWealth - c1) * (1 + r);
    if (c1 <= 0 || c2 <= 0) throw new RangeError("跨期正消费解超出有限精度；请使用较温和的参数。");
    borrowing = c1 - y1;
    intertemporalUtility = Math.log(c1) + beta * Math.log(c2);
  }
  const fullIncome = nonLabor + wage * T;
  const laborDomain = T > 0 && fullIncome > 0;
  let leisure: number | null = null, labor: number | null = null, laborUtility: number | null = null;
  let laborConsumption: number | null = laborDomain ? null : fullIncome;
  if (laborDomain) {
    if (wage === 0 || leisureWeight * fullIncome / wage >= T) { leisure = T; labor = 0; laborConsumption = nonLabor; }
    else { leisure = leisureWeight * fullIncome / wage; labor = T - leisure; laborConsumption = nonLabor + wage * labor; }
    if (leisure <= 0 || laborConsumption <= 0) throw new RangeError("劳动正消费/闲暇解超出有限精度；请使用较温和的参数。");
    laborUtility = (1 - leisureWeight) * Math.log(laborConsumption) + leisureWeight * Math.log(leisure);
  }
  const metrics = { expectedWealth, expectedUtility, certaintyEquivalent, riskPremium: expectedWealth - certaintyEquivalent, presentWealth, c1, c2, borrowing, intertemporalUtility, leisure, labor, laborConsumption, laborUtility };
  const riskMax = Math.max(100, wHigh);
  const curves: AdvancedLabResult["curves"] = [curve("风险：√w", riskMax, w => Math.sqrt(w))];
  if (presentWealth > 0) curves.push({ label: "跨期：预算边界（含轴端点；对数目标仅内点有效）", points: [{ x: 0, y: presentWealth * (1 + r) }, { x: presentWealth, y: 0 }] });
  if (noBorrow === 1 && presentWealth > 0) curves.push({ label: "跨期：禁止借款下可行边界", points: [{ x: 0, y: presentWealth * (1 + r) }, { x: y1, y: y2 }] });
  if (T > 0) curves.push({ label: "劳动：闲暇—消费预算边界", points: [{ x: 0, y: fullIncome }, { x: T, y: nonLabor }] });
  const rows = [
    ...numericRows(metrics, { expectedWealth: ["期望财富 EW", "货币"], expectedUtility: ["期望效用 EU", "效用刻度"], certaintyEquivalent: ["确定性等价 CE", "货币"], riskPremium: ["风险溢价 EW−CE", "货币"] }, "risk-"),
    ...numericRows(metrics, { presentWealth: ["收入现值 W", "货币"], c1: ["最优本期消费 c1", "货币"], c2: ["最优下期消费 c2", "货币"], borrowing: ["净借款（负数为储蓄）", "货币"], intertemporalUtility: ["跨期对数效用", "效用刻度"] }, "time-"),
    ...numericRows(metrics, { leisure: ["最优闲暇", "小时"], labor: ["最优劳动", "小时"], laborConsumption: ["劳动面板消费", "货币"], laborUtility: ["劳动—闲暇对数效用", "效用刻度"] }, "labor-"),
  ];
  return { status: !timeDomain || !laborDomain ? "部分面板无严格正的对数效用可行域；其余面板仍有效" : "风险、跨期、劳动三种独立选择模型", metrics, rows, curves, xLabel: "分面：财富 / 本期消费 / 闲暇", yLabel: "分面：效用 / 下期消费 / 消费", notes: ["√w 在 w=0 仍有效；CE=EU²。期望效用中的任意严格递增变换一般不保留彩票排序。", timeDomain ? noBorrow === 1 && c1 === y1 ? "禁止借款约束达到边界：c1=y1，c2=y2；两期仍须严格正消费。" : "跨期内点解 c1=W/(1+β)，c2=β(1+r)W/(1+β)，满足现值预算。" : "收入现值为零，或禁止借款且本期收入为零：不存在两期都正的可行消费，不能取 log(0)，不显示伪最优解。", laborDomain ? labor === 0 ? "劳动角点：非劳动收入足够或工资为零，闲暇取 T，消费为非劳动收入。" : "劳动内点：闲暇=α(非劳动收入+wage·T)/wage；劳动=T−闲暇。" : "总时间为零或可取得消费为零：不能同时获得正消费和正闲暇，对数劳动模型不适用。", "三个面板使用各自单位和不同效用；数值不能横向比较成统一幸福评分。"] };
}

function trade(p: AdvancedParameters): AdvancedLabResult {
  const { laborA, laborB, ax, ay, bx, by, price, tradeX } = p;
  nonnegative(laborA, "A 劳动"); nonnegative(laborB, "B 劳动");
  for (const key of ["ax", "ay", "bx", "by", "price"]) positive(p[key], key);
  const opportunityA = ax / ay, opportunityB = bx / by;
  const aExportsX = opportunityA <= opportunityB;
  const prodAx = aExportsX ? laborA / ax : 0, prodAy = aExportsX ? 0 : laborA / ay;
  const prodBx = aExportsX ? 0 : laborB / bx, prodBy = aExportsX ? laborB / by : 0;
  const maxTrade = aExportsX ? Math.min(prodAx, prodBy / price) : Math.min(prodBx, prodAy / price);
  if (aExportsX && tradeX < 0 || !aExportsX && tradeX > 0) throw new RangeError(`按当前比较优势，x 应由 ${aExportsX ? "A 向 B（tradeX≥0）" : "B 向 A（tradeX≤0）"}出口。`);
  if (Math.abs(tradeX) > maxTrade) throw new RangeError(`交易量超过双方产出，可行的 |tradeX| 上限为 ${maxTrade}。`);
  const tradeY = price * tradeX;
  const consumeAx = prodAx - tradeX, consumeAy = prodAy + tradeY, consumeBx = prodBx + tradeX, consumeBy = prodBy - tradeY;
  const metrics = { opportunityA, opportunityB, tradeY, consumeAx, consumeAy, consumeBx, consumeBy, produceAx: prodAx, produceAy: prodAy, produceBx: prodBx, produceBy: prodBy, worldX: prodAx + prodBx, worldY: prodAy + prodBy, maxTradeX: maxTrade, usedLaborA: ax * prodAx + ay * prodAy, usedLaborB: bx * prodBx + by * prodBy, autarkyLaborForAConsumption: ax * consumeAx + ay * consumeAy, autarkyLaborForBConsumption: bx * consumeBx + by * consumeBy };
  const signedMax = aExportsX ? maxTrade : -maxTrade;
  const lower = Math.min(opportunityA, opportunityB), upper = Math.max(opportunityA, opportunityB);
  const status = opportunityA === opportunityB ? "机会成本相同：没有严格比较优势利得" : price > lower && price < upper ? "价格处于严格互利机会成本区间；仍需给定偏好评价" : price === lower || price === upper ? "价格处于机会成本端点：一方只有弱可行集利得" : "价格在互利区间外：至少一方可行集不扩大";
  return {
    status, metrics,
    rows: numericRows(metrics, { opportunityA: ["A 的 x 机会成本", "y/x"], opportunityB: ["B 的 x 机会成本", "y/x"], tradeY: ["B→A 的 y 净出口（负数为反向）", "y"], consumeAx: ["A 消费 x", "x"], consumeAy: ["A 消费 y", "y"], consumeBx: ["B 消费 x", "x"], consumeBy: ["B 消费 y", "y"], produceAx: ["A 专业化产 x", "x"], produceAy: ["A 专业化产 y", "y"], produceBx: ["B 专业化产 x", "x"], produceBy: ["B 专业化产 y", "y"], worldX: ["世界 x 总量（生产=消费）", "x"], worldY: ["世界 y 总量（生产=消费）", "y"], maxTradeX: ["交易 x 的绝对数量上限", "x"], usedLaborA: ["A 已使用劳动", "劳动单位"], usedLaborB: ["B 已使用劳动", "劳动单位"], autarkyLaborForAConsumption: ["A 独自产出当前消费所需劳动", "劳动单位"], autarkyLaborForBConsumption: ["B 独自产出当前消费所需劳动", "劳动单位"] }),
    curves: [
      { label: "A PPF（生产边界）", points: [{ x: 0, y: laborA / ay }, { x: laborA / ax, y: 0 }] },
      { label: "A CPF（有限双边贸易）", points: [{ x: prodAx, y: prodAy }, { x: prodAx - signedMax, y: prodAy + price * signedMax }] },
      { label: "B PPF（生产边界）", points: [{ x: 0, y: laborB / by }, { x: laborB / bx, y: 0 }] },
      { label: "B CPF（有限双边贸易）", points: [{ x: prodBx, y: prodBy }, { x: prodBx + signedMax, y: prodBy - price * signedMax }] },
    ],
    xLabel: "x（商品 x 单位）", yLabel: "y（商品 y 单位）",
    notes: [`比较优势方向：${aExportsX ? "A 产 x、B 产 y" : "B 产 x、A 产 y"}。净交换严格守恒：A 少的 x 是 B 多的 x，A 多的 y 是 B 少的 y。`, `严格互利相对价格区间为 (${lower}, ${upper}) y/x；端点表示相应一方的交易线与 PPF 相同，不应称两方都严格获益。`, "世界资源不因贸易凭空增加：生产受各自劳动限制，贸易只重新配置已有商品。两方消费之和逐项等于世界生产。", "与具体起点相比是否更受偏好、谁在国内受损、是否补偿，需要额外偏好及分配模型。无真实国家数据。"],
  };
}

export function runAdvancedLab(id: AdvancedLabId, parameters: AdvancedParameters): AdvancedLabResult {
  const p = validateShape(id, parameters);
  const solvers: Record<AdvancedLabId, (p: AdvancedParameters) => AdvancedLabResult> = { ML04: costMarket, ML05: taxes, ML06: monopoly, ML07: game, ML08: externality, ML09: quality, ML10: riskTimeLabor, ML11: trade };
  const result = solvers[id](p);
  // Reject arithmetic overflow at the pure boundary, never leak NaN/Infinity to
  // tables, charts, tests or persisted experimental outcomes.
  for (const [key, value] of Object.entries(result.metrics)) if (value !== null) finite(value, key);
  for (const entry of result.rows) if (typeof entry.value === "number") finite(entry.value, entry.key);
  for (const line of result.curves) for (const point of line.points) { finite(point.x, `${line.label} x`); finite(point.y, `${line.label} y`); }
  return result;
}
