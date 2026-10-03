import {
  defaultGrowthParameters,
  simulateGrowth,
  type GrowthParameters,
} from "./growth";
import {
  defaultSpendingParameters,
  simulateSpending,
  type SpendingParameters,
} from "./spending";
import {
  defaultPolicyParameters,
  simulatePolicy,
  type PolicyParameters,
} from "./policy";
import {
  defaultCreditState,
  replayCreditEvents,
  validateCreditState,
  type CreditState,
  type CreditEvent,
} from "./credit";
import {
  defaultDebtParameters,
  simulateDebt,
  type DebtParameters,
} from "./debt";
import {
  defaultExternalParameters,
  calculateExternal,
  type ExternalParameters,
} from "./external";

export const ADVANCED_LAB_IDS = [
  "LA04",
  "LA05",
  "LA06",
  "LA07",
  "LA08",
  "LA09",
] as const;
export type AdvancedLabId = (typeof ADVANCED_LAB_IDS)[number];
export type CreditInput = { initial: CreditState; events: CreditEvent[] };
export type AdvancedInputs = {
  LA04: GrowthParameters;
  LA05: SpendingParameters;
  LA06: PolicyParameters;
  LA07: CreditInput;
  LA08: DebtParameters;
  LA09: ExternalParameters;
};
export type AdvancedInput = AdvancedInputs[AdvancedLabId];
export const advancedDefaults = (): AdvancedInputs => ({
  LA04: defaultGrowthParameters(),
  LA05: defaultSpendingParameters(),
  LA06: defaultPolicyParameters(),
  LA07: { initial: defaultCreditState(), events: [] },
  LA08: defaultDebtParameters(),
  LA09: defaultExternalParameters(),
});

function exactObject(
  value: unknown,
  fields: string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}必须是数据对象。`);
  const source = value as Record<string, unknown>;
  if (
    Object.keys(source).length !== fields.length ||
    Object.keys(source).some((key) => !fields.includes(key))
  )
    throw new Error(`${label}包含未知字段或缺少原始参数。`);
  return source;
}
function creditShape(value: unknown, template: unknown, label: string): void {
  if (typeof template === "number") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new Error(`${label}必须是有限数字。`);
  } else if (typeof template === "string") {
    if (typeof value !== "string") throw new Error(`${label}必须是文本。`);
  } else if (Array.isArray(template)) {
    if (!Array.isArray(value) || value.length !== 0)
      throw new Error("期初银行账表不能带本期事件。");
  } else {
    const source = exactObject(value, Object.keys(template as object), label);
    for (const [key, item] of Object.entries(template as object))
      creditShape(source[key], item, `${label}.${key}`);
  }
}
/** Imports retain parameters/events only, and recompute both B and the frozen A. */
export function validateAdvancedInput<Id extends AdvancedLabId>(
  id: Id,
  value: unknown,
): AdvancedInputs[Id] {
  if (id === "LA07") {
    const source = exactObject(value, ["initial", "events"], "LA07原始输入");
    creditShape(source.initial, defaultCreditState(), "期初银行账表");
    validateCreditState(source.initial as CreditState);
    if (!Array.isArray(source.events) || source.events.length > 1000)
      throw new Error("银行事件最多1000笔。");
    for (const item of source.events) {
      const event = exactObject(
        item,
        ["id", "sequence", "type", "amount"],
        "银行事件",
      );
      if (
        typeof event.id !== "string" ||
        !event.id.trim() ||
        event.id.length > 200 ||
        ["__proto__", "constructor", "prototype"].includes(event.id)
      )
        throw new Error("银行事件ID不合法。");
      if (
        !Number.isSafeInteger(event.sequence) ||
        (event.sequence as number) < 1
      )
        throw new Error("银行事件顺序须为正安全整数。");
      if (
        !["loan", "payment", "repayment", "loss"].includes(event.type as string)
      )
        throw new Error("银行事件类型不合法。");
      if (
        typeof event.amount !== "number" ||
        !Number.isFinite(event.amount) ||
        event.amount <= 0 ||
        event.amount > 1e9
      )
        throw new Error("银行事件金额不合法。");
    }
    replayCreditEvents(
      source.initial as CreditState,
      source.events as CreditEvent[],
    );
  } else {
    const template = advancedDefaults()[id];
    const source = exactObject(value, Object.keys(template), `${id}参数`);
    if (
      Object.values(source).some(
        (item) => typeof item !== "number" || !Number.isFinite(item),
      )
    )
      throw new Error(`${id}参数必须全部为有限数字。`);
    calculateAdvanced(id, source as unknown as AdvancedInputs[Id]);
  }
  return JSON.parse(JSON.stringify(value)) as AdvancedInputs[Id];
}
export function calculateAdvanced(id: AdvancedLabId, value: AdvancedInput) {
  switch (id) {
    case "LA04":
      return simulateGrowth(value as GrowthParameters);
    case "LA05":
      return simulateSpending(value as SpendingParameters);
    case "LA06":
      return simulatePolicy(value as PolicyParameters);
    case "LA07": {
      const input = value as CreditInput;
      return replayCreditEvents(input.initial, input.events);
    }
    case "LA08":
      return simulateDebt(value as DebtParameters);
    case "LA09":
      return calculateExternal(value as ExternalParameters);
  }
}

export type Field = {
  key: string;
  label: string;
  unit: string;
  scale?: number;
};
const f = (
  key: string,
  label: string,
  unit: string,
  scale?: number,
): Field => ({ key, label, unit, scale });
export const advancedFields: Record<Exclude<AdvancedLabId, "LA07">, Field[]> = {
  LA04: [
    f("A", "初始生产率 A", "产出效率"),
    f("alpha", "资本份额 α", "0–1之间"),
    f("s", "储蓄率 s", "%", 100),
    f("delta", "折旧率 δ", "%/期", 100),
    f("n", "劳动增长率 n", "%/期", 100),
    f("K0", "期初资本 K₀", "资本单位"),
    f("L0", "期初劳动 L₀", "工人"),
    f("technologyGrowth", "持续技术增长率", "%/期", 100),
    f("technologyShock", "一次技术水平倍数", "倍"),
    f("shockPeriod", "技术冲击时期", "整数期"),
    f("periods", "推演期数", "整数期"),
  ],
  LA05: [
    f("C0", "自主消费 C₀", "货币单位/期"),
    f("c", "边际消费倾向 c", "0–1之间"),
    f("T", "税减转移 T", "货币单位/期"),
    f("I0", "计划投资 I₀", "货币单位/期"),
    f("G", "政府购买 G", "货币单位/期"),
    f("eta", "调整速度 η", "0–1之间"),
    f("Y0", "期初产出 Y₀", "货币单位/期"),
    f("periods", "推演期数", "整数期"),
  ],
  LA06: [
    f("rho", "缺口持续参数 ρ", "系数"),
    f("a", "利率敏感度 a", "系数"),
    f("kappa", "缺口传向通胀 κ", "系数"),
    f("lambda", "预期调整 λ", "0–1之间"),
    f("phiPi", "政策通胀响应 φπ", "系数"),
    f("phiX", "政策缺口响应 φx", "系数"),
    f("rStar", "外生自然实际利率 r*", "百分数"),
    f("piTarget", "合成通胀目标 π*", "百分数"),
    f("iMin", "操作利率下限", "百分数"),
    f("x0", "初始产出缺口", "百分点"),
    f("pi0", "初始通胀", "百分数"),
    f("expectedPi0", "初始预期通胀", "百分数"),
    f("i0", "初始操作利率", "百分数"),
    f("demandShock", "需求冲击 d", "缺口百分点"),
    f("supplyShock", "成本冲击 s", "通胀百分点"),
    f("shockPeriod", "冲击开始时期", "整数期"),
    f("shockDuration", "冲击持续期数", "整数期"),
    f("periods", "推演期数", "整数期"),
  ],
  LA08: [
    f("initialDebtRatio", "期初债务率 b₀", "%", 100),
    f("initialGDP", "期初名义 GDP", "货币单位"),
    f("interestRate", "有效名义利率 i", "%/期", 100),
    f("growthRate", "名义 GDP 增长 g", "%/期", 100),
    f("primaryDeficitRatio", "初级赤字 / 当期 GDP", "%", 100),
    f("periods", "推演期数", "整数期"),
  ],
  LA09: [
    f("output", "国内生产 Y", "货币单位/期"),
    f("consumption", "消费 C", "货币单位/期"),
    f("government", "政府购买 G", "货币单位/期"),
    f("investment", "投资 I", "货币单位/期"),
    f("exports", "出口 X", "货币单位/期"),
    f("imports", "进口 M", "货币单位/期"),
    f("netPrimaryIncome", "跨境净初次收入 NPI", "货币单位/期"),
    f("netCurrentTransfers", "净经常转移 NCT", "货币单位/期"),
    f("openingNFA", "期初外部净资产", "货币单位"),
    f("valuationChange", "外部资产估值变化", "货币单位"),
    f("exchangeRate", "名义汇率 e", "本币/外币"),
    f("foreignPrice", "国外价格 P*", "指数单位"),
    f("domesticPrice", "国内价格 P", "指数单位"),
    f("baseExchangeRate", "基准名义汇率", "本币/外币"),
    f("baseForeignPrice", "基准国外价格", "指数单位"),
    f("baseDomesticPrice", "基准国内价格", "指数单位"),
  ],
};
export const labNames = [
  "交易账本",
  "GDP 三种视角",
  "价格与数量",
  "增长与过渡",
  "计划支出与收入",
  "需求、通胀与政策",
  "两银行信贷与损失",
  "债务率动态",
  "开放经济与汇率",
];
export const labBoundaries: Record<AdvancedLabId, string[]> = {
  LA04: [
    "模型假设：Cobb–Douglas 技术、资本边际报酬递减，储蓄与劳动增长外生。资本/产出单位为合成实物单位；一步为一期。生产函数 Y=A K^α L^(1−α)，0<α<1。",
    "K下一期=(1−δ)K+sY；L下一期=(1+n)L。高储蓄率不是自动提高福利的证明。",
    "一次 A 水平改变仍可讨论冲击后的固定 A 稳态；持续技术增长时不沿用固定 A 稳态。人口增长与每工人、每居民口径须分开。",
  ],
  LA05: [
    "行为假设：封闭经济、价格固定、有闲置产能，C=C₀+c(Y−T)，计划投资与政府购买外生。",
    "均衡条件：Y=Z(Y)，乘数依赖0≤c<1；动态调整 Y下一期=(1−η)Y+ηZ。",
    "核算恒等式每期仍成立：实际投资=计划投资+(Y−Z)，包含非计划存货。这里仅推演库存流量，未建模期初库存与存货下限；负库存变化需要现实中有可售库存。供给约束、利率反馈、进口、预期都未建模。",
  ],
  LA06: [
    "合成滞后系统；缺口用百分点，利率与通胀用百分数。自然利率与潜在产出设为外生，现实中需估计。",
    "顺序：先用上一期利率与预期求本期缺口，再求通胀、更新预期，最后定本期政策。成本冲击的政策反应下一期才传向缺口。x_t=ρx_(t−1)−a[i_(t−1)−πe_(t−1)−r*]+d_t；π_t=πe_(t−1)+κx_t+s_t；πe_t=(1−λ)πe_(t−1)+λπ_t；i_t=max(i_min,r*+π*+φπ(π_t−π*)+φx x_t)。",
    "参数和目标不是任何央行的现实规则。若轨迹不稳定，显示警告和已有数值，不裁掉曲线冒充收敛；模型反事实不是政策预测。",
  ],
  LA07: [
    "两银行与所有客户逐笔记账；准备金发行方和实物部门在边界之外。没有自动融资、注资或存款乘数。",
    "新增贷款同时创造存款；跨行支付按当期使用/转移记账、不取得新的实物资产，因此付款客户净值减少、收款客户净值增加；它转移准备金和存款，偿还本金减少贷款与存款；减值减少银行净贷款资产与权益。",
    "历史贷款减值不自动免除客户合同债务，净资产与合同债权的差额由显式损失准备对账。准备金不足拒绝支付，负权益单独提示风险。教学资本阈值不是监管规则。",
  ],
  LA08: [
    "同一口径的本币名义债务与名义 GDP；i 作用于期初债务，pd 是初级赤字/当期 GDP，正数为赤字。",
    "精确递推 b下一期=((1+i)/(1+g))b+pd，同时复算债务额。这里 g 为名义增长，不能混用实际增长。",
    "省略汇率、估值、救助及其他存量流量调整，不给现实国家评级。利率小于增长并不保证任意赤字安全，债务率也不等于流动性判断。",
  ],
  LA09: [
    "核算：NX=X−M；可支配国民收入 YD=Y+NPI+NCT；S=YD−C−G；CA=NX+NPI+NCT=S−I。",
    "必须保持 Y=C+I+G+X−M，矛盾的原始活动明确报错，不能自动补一个不明调整项。忽略资本账户/其他调整时 ΔNFA=CA+估值。",
    "定义 e 为本币/单位外币，q=eP*/P；q 上升是本约定下实际贬值。相对价格不会自动改写贸易量；弹性、合同与滞后需另加机制。",
  ],
};
