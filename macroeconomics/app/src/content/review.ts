import { initialLedger, replayLedger, computePrices } from "../models";
import { defaultGrowthParameters, simulateGrowth } from "../models/growth";
import {
  defaultSpendingParameters,
  simulateSpending,
} from "../models/spending";
import { defaultPolicyParameters, simulatePolicy } from "../models/policy";
import { defaultDebtParameters, simulateDebt } from "../models/debt";
import {
  defaultExternalParameters,
  calculateExternal,
} from "../models/external";
import { defaultCreditState, replayCreditEvents } from "../models/credit";
import type { LearnableLessonId } from "./types";

export interface TransferReview {
  id: string;
  title: string;
  modules: string[];
  lessons: LearnableLessonId[];
  prompt: string[];
  reference: string[];
  rubric: string[];
}

const format = (number: number, places = 4) =>
  String(Number(number.toFixed(places)));

/** Every numerical reference is computed from the same kernels as the labs. */
export function computeReviewExamples() {
  const ledger = replayLedger(initialLedger(), [
    { id: "review-wage", sequence: 1, type: "wage", amount: 18 },
    { id: "review-service", sequence: 2, type: "service", amount: 7 },
  ]);
  const prices = computePrices({
    periods: [
      { px: 2, py: 4, qx: 10, qy: 5 },
      { px: 2.5, py: 5, qx: 10, qy: 5 },
    ],
    priceBase: 0,
    basketBase: 0,
    normalization: 100,
  });
  const saving = simulateGrowth({ ...defaultGrowthParameters(), s: 0.3 });
  const technology = simulateGrowth({
    ...defaultGrowthParameters(),
    technologyShock: 1.3,
  });
  const demand = simulateSpending({ ...defaultSpendingParameters(), C0: 12 });
  const policy = simulatePolicy({
    ...defaultPolicyParameters(),
    demandShock: 0,
    supplyShock: 0.8,
  });
  const debt = simulateDebt({
    ...defaultDebtParameters(),
    initialDebtRatio: 0.5,
    interestRate: 0.03,
    growthRate: 0.05,
    primaryDeficitRatio: 0.005,
  });
  const external = calculateExternal({
    ...defaultExternalParameters(),
    output: 105,
    consumption: 60,
    government: 20,
    investment: 30,
    exports: 10,
    imports: 15,
    netPrimaryIncome: 3,
    netCurrentTransfers: -1,
    openingNFA: 10,
    valuationChange: 5,
  });
  const credit = replayCreditEvents(defaultCreditState(), [
    { id: "review-loss", sequence: 1, type: "loss", amount: 12 },
  ]);
  return {
    ledger,
    prices,
    saving,
    technology,
    demand,
    policy,
    debt,
    external,
    credit,
  };
}

const example = computeReviewExamples();

export const transferReviews: TransferReview[] = [
  {
    id: "stocks-and-production",
    title: "存款增加了，GDP增加多少？",
    modules: ["A01", "A02"],
    lessons: ["A01-A", "A01-B", "A02-A"],
    prompt: [
      "教学合成情景：沿用LA01的期初账户，企业向家庭支付工资18，家庭购买本期新生产的最终服务7。没有其他生产、中间投入、税、转移或估值变化。工资18全部属于这项服务的生产，企业可以有负利润。",
      "先算家庭与企业的期末存款，再从最终支出和收入两侧算本期GDP。家庭存款变化、总存款变化与GDP为什么不相等？若改为买上期生产的旧物品，哪一条生产解释会改变？",
    ],
    reference: [
      `账本给出家庭期末存款${format(example.ledger.H.deposit)}，企业${format(example.ledger.F.deposit)}。家庭存款净增${format(example.ledger.H.deposit - 100)}，总存款仍140；工资和服务付款只转移已有存款。`,
      "按情景给定的生产边界，最终服务形成GDP7。收入侧是工资18与利润−11，相加仍7；不能把工资18和最终支出7再次相加。企业当期亏损在此是明确允许的分配结果。",
      "换成无本期中介服务的旧物品交易，本期新增生产为0。付款金额仍存在，说明账本记录交易而GDP记录特定生产边界。没有规定旧物品对应的资产与存货科目时，不能仅靠LA01原事件替代完整旧资产记账。",
    ],
    rubric: [
      "给存款写时点，给工资、消费与GDP写期间；分别核对111、29与存款总额140。",
      "用消费7与工资18加利润−11得到相同GDP，不重复加总两种视角。",
      "指出旧物品的生产时期，并说明原服务事件不能完整模拟旧资产科目。",
    ],
  },
  {
    id: "prices-and-capital",
    title: "价格上涨能替代资本积累吗？",
    modules: ["A03", "A04"],
    lessons: ["A03-A", "A03-B", "A04-A", "A04-B"],
    prompt: [
      "教学合成测量表：第0期两商品价格2和4、数量10和5；第1期价格2.5和5，数量不变。另一个独立的固定技术增长情景取LA04默认参数，把储蓄率从0.2改为0.3。",
      "价格表的名义增长与实际增长各是多少？在增长情景中，k0=1时消费和新稳态每工人产出各是多少？解释为什么更高的名义支出、更高的稳态产出、永久更高的增长率是三个不同判断。",
    ],
    reference: [
      `第1期名义产出${format(example.prices.periods[1].N)}、实际产出${format(example.prices.periods[1].R)}。名义增长${format(example.prices.periods[1].gN! * 100)}%，实际增长${format(example.prices.periods[1].gR! * 100)}%；这里上涨来自价格。`,
      `增长模型中提高s后，k0=1的每工人消费为${format(example.saving.periods[0].c)}，低于原来的0.8；固定A与人口下，新正稳态k*=${format(example.saving.steadyState!.k)}、y*=${format(example.saving.steadyState!.y)}。过渡期与稳态仍须分开，稳态人均增长率仍为0。`,
      "LA03的货币价值不直接等于LA04的实物资本投入，两者需价格与生产结构的桥梁。提高储蓄率带来当前消费代价；若要判断福利，还需偏好与跨期权重，不能只比y*。",
    ],
    rubric: [
      "分别计算名义增长25%与实际增长0%，不把价格涨幅作为新增实物资本。",
      "说明消费0.7、新稳态y*=3与稳态增长率0的不同时间含义。",
      "写出固定技术、固定人口等条件，并指出福利判断缺少的条件。",
    ],
  },
  {
    id: "technology-and-demand",
    title: "生产能力更高，销量一定更高吗？",
    modules: ["A05", "A06"],
    lessons: ["A05-A", "A05-B", "A06-A", "A06-B"],
    prompt: [
      "教学合成情景一：LA04默认路径在第1期出现永久A水平倍率1.3，之后技术趋势增长仍为0。情景二：LA05保持固定价格、闲置产能与外生计划投资30，把C0从20降至12，其他默认参数不变。",
      "两情景分别改变供给能力和计划需求。请算需求情景的新均衡产出与国民储蓄，说明技术情景第1期在既定K、L下的产出变化。可以把两套输出直接拼成一条现实预测吗？平均生产率上升能保证每个人收入同幅上升吗？",
    ],
    reference: [
      `需求情景的均衡Y=${format(example.demand.equilibrium.Y)}，国民储蓄${format(example.demand.equilibrium.nationalSaving)}，仍等于给定计划投资30。这个结果依赖C的行为关系、外生投资和均衡条件，不能只从S=I推出。`,
      `技术情景第1期A=${format(example.technology.periods[1].A)}，每工人产出${format(example.technology.periods[1].y)}。当期K、L已经由上一期决定，A提高30%使当期给定投入下的产出同比例提高；一次水平冲击仍不等于设定永久技术增长率。`,
      "这两套简化模型没有共同的价格、就业、融资与潜在产出约束，不能自动拼成联合预测。平均变化也没有给出工资、利润、劳动参与及分配的响应；需要制度与分组证据补充。",
    ],
    rubric: [
      "得到需求均衡150与储蓄30，说明外生投资的作用。",
      "区分技术水平冲击与技术趋势，并指出第1期资本劳动预定。",
      "明确联合预测缺少的机制，并提出至少一种分配或参与证据。",
    ],
  },
  {
    id: "labour-and-policy",
    title: "失业率下降与涨价证明过热吗？",
    modules: ["A07", "A08"],
    lessons: ["A07-A", "A07-B", "A08-B"],
    prompt: [
      "教学合成劳动资料：适龄人口200，其中就业120、失业20、非劳动力60。之后8名失业者停止积极求职，就业人数不变。分别计算变化前后的失业率，并检查就业人口比。",
      "独立的LA06合成情景使用默认政策参数，只把第1期需求冲击设为0、成本冲击设为0.8。新闻将上述资料解释为“过热，政策加息能在同一期消除通胀”。请用劳动分母变化与政策滞后说明这段判断缺少什么。",
    ],
    reference: [
      `失业率从${format((20 / 140) * 100)}%降到${format((12 / 132) * 100)}%，但就业人口比仍是${format((120 / 200) * 100)}%。劳动力分母变小；仅看失业率下降不能说新增就业。`,
      `纯成本冲击第1期x=${format(example.policy.periods[1].x)}、π=${format(example.policy.periods[1].pi)}%、i=${format(example.policy.periods[1].i)}%；第2期x=${format(example.policy.periods[2].x)}。当期加息没有倒灌回第1期已经使用的滞后利率，价格上升也不只来自需求。`,
      "劳动口径例子与政策实验是分别给定的合成资料，并未建立它们之间的实证因果联系。现实判断还需参与、就业流动、供给成本、预期和传导时滞的证据。",
    ],
    rubric: [
      "失业率用劳动力作分母，就业人口比用适龄人口作分母。",
      "用x1=0、π1=2.8%、i1=4.2%、x2=−0.4说明成本冲击与政策顺序。",
      "至少提出两类补充证据，不把两套合成资料的并列当成因果识别。",
    ],
  },
  {
    id: "debt-and-external",
    title: "负债金额上升，债务率为何下降？",
    modules: ["A09", "A10"],
    lessons: ["A09-B", "A10-A", "A10-B"],
    prompt: [
      "教学合成债务情景：期初GDP100、政府债务率50%；名义利率3%、名义GDP增长5%，本期初级赤字为本期GDP的0.5%。无政府债务的其他调整。算期末债务金额和债务率。",
      "同一期另一组国民账户给出Y105、C60、G20、I30、X10、M15、跨境净初次收入3、净经常转移−1。外部净资产期初10、估值变化+5；忽略资本账户及其他外部调整。计算经常账户与期末外部净资产，再解释“债务率下降所以必然安全”和“经常账户赤字所以外部净资产必减”为何都过度。",
    ],
    reference: [
      `债务金额由50增为${format(example.debt.periods[1].debt)}，GDP增为105，所以债务率为${format(example.debt.periods[1].debtRatio * 100)}%。利息增长项与初级赤字分别进入精确递推，不用r−g近似代替。`,
      `国民可支配收入${format(example.external.YD)}、储蓄${format(example.external.S)}、CA=${format(example.external.CA)}，同时S−I=${format(example.external.CAFromSaving)}。外部净资产变化${format(example.external.NFAChange)}，期末${format(example.external.closingNFA)}；CA与资产重估是不同变化来源。`,
      "公共债务和全经济的外部净资产不是同一对象。债务率下降不能代替期限、币种、融资条件与风险判断；CA恒等式也不自动解释储蓄或投资的因果响应。",
    ],
    rubric: [
      "对账债务52.025、GDP105与债务率约49.5476%，区分金额和比率。",
      "由NX−5和净收入转移+2得到CA−3，加入估值+5得到净资产变化+2。",
      "区分政府和全经济对象，并给出至少一个核算以外的风险或机制条件。",
    ],
  },
  {
    id: "crisis-and-evidence",
    title: "银行有准备金，就没有危机风险吗？",
    modules: ["A11", "A12"],
    lessons: ["A11-A", "A11-B", "A12-A", "A12-B"],
    prompt: [
      "教学合成LA07期初两银行各有准备金20、贷款80、存款负债90、权益10。银行A确认一笔历史贷款减值12，没有发放、支付、偿还或客户债务豁免。算A的贷款账面资产、权益、准备金和系统存款。",
      "随后一份合成研究摘要仅报告“贷款规模和产出在同一期间下降”。能由相关性确定银行损失导致产出下滑吗？比较“资本约束先收紧信贷”和“需求先走弱，借款与产出同时下降”两个解释，为终课诊断提出能区分它们的证据与一个仍不确定的问题。",
    ],
    reference: [
      `银行A的贷款账面资产为${format(example.credit.A.loanAsset)}、权益${format(example.credit.A.equity)}、准备金${format(example.credit.A.reserves)}；系统存款仍${format(example.credit.A.depositLiability + example.credit.B.depositLiability)}。减值是资产与权益损失，不是客户存款自动销毁，也不等于客户合同债务豁免。`,
      "准备金20表示在已给定支付边界内的流动性；权益−2表示资产账面值不足以覆盖负债。两种约束回答不同问题。LA07没有把银行损失自动连到企业生产，所以不能把未实现的传导当作实验结论。",
      "同一期共变容纳反向因果与共同冲击。可比较不同暴露银行的信贷供给、同一借款人多家银行的贷款、企业订单与借款需求，并检查冲击时序和组间可比性；这些证据仍需识别假设。终课报告保留替代机制、支持与反对证据及制度边界。",
    ],
    rubric: [
      "得到贷款68、权益−2、准备金20、系统存款180，区分流动性与偿付能力。",
      "把核算结果、模型内机制与现实因果证据分开，不由同期共变直接选定机制。",
      "提出一种有比较对象的证据、它依赖的识别条件，以及一个明确未决问题。",
    ],
  },
];
