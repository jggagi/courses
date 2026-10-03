import type { Term } from "./types";

/** 开放经济、金融脆弱性与证据的局部词条；均采用本课明确约定。 */
export const globalTerms: Term[] = [
  {
    id: "global-current-account",
    name: "经常账户（current account）",
    definition:
      "本课CA=NX+NPI+NCT：净出口加跨境净初次收入及净经常转移，是一段时期的流量。在本课一致口径下CA=S−I；它不是外部资产存量，也不总等于贸易余额。",
    lessonId: "A10-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-primary-income",
    name: "跨境净初次收入（net primary income）",
    definition:
      "本课NPI记录居民从境外取得的劳动、投资等初次收入减向境外支付的对应收入，单位为本币/期。境外利息收入与本国当期生产出口不同，正负号以本国居民视角定义。",
    lessonId: "A10-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-current-transfer",
    name: "净经常转移（net current transfers）",
    definition:
      "本课NCT记录本国从境外收到的经常转移减向境外支付的经常转移。它不对应当期产品交换，也不同于资本转移；简化例只处理明确归类的经常转移。",
    lessonId: "A10-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-disposable-income",
    name: "可支配国民收入（disposable national income）",
    definition:
      "本课YD=Y+NPI+NCT，把国内生产创造的收入与跨境净收入、净经常转移连接起来。这里使用与毛投资一致的毛储蓄口径S=YD−C−G；不能不说明口径就与GDP混称。",
    lessonId: "A10-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-external-net-assets",
    name: "外部净资产（net external assets）",
    definition:
      "本国居民对外资产减对外负债，是特定时点、统一计价货币下的存量。本课忽略资本账户及其他调整时，期末等于期初加CA加估值变化；贸易流量与估值必须分别列示。",
    lessonId: "A10-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-financial-flow",
    name: "跨境金融交易（cross-border financial transactions）",
    definition:
      "本课按本国视角，将对外资产净取得减对外负债净发生定义为净对外融资流量。在忽略资本账户、统计误差和其他调整时它等于CA；通常口语中的“资本流入”采用反向视角，不能只凭名称猜符号。",
    lessonId: "A10-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-exchange-rate",
    name: "名义汇率（nominal exchange rate）",
    definition:
      "本课e表示购买1单位外币需要多少本币，单位是本币/外币，且e>0。e上升表示本币名义贬值；若改用外币/本币，数字方向会反转，交易含义不会反转。",
    lessonId: "A10-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-real-exchange-rate",
    name: "实际汇率（real exchange rate）",
    definition:
      "在可比较商品篮子和单位约定下，本课q=eP*/P，P*是外币价格、P是本币价格。q上升为实际贬值，表示外国产品相对更贵；若P、P*为指数，q水平依赖指数基准，跨期变化须保持基准一致。",
    lessonId: "A10-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-exchange-regime",
    name: "汇率制度（exchange rate regime）",
    definition:
      "关于汇率目标、外汇交易及政策承诺的制度安排。固定、浮动和管理浮动的政策闭合条件不同；资本流动程度与政策响应需另行规定，LA09不模拟任何特定现实制度。",
    lessonId: "A10-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-trade-response",
    name: "贸易数量响应（trade volume response）",
    definition:
      "汇率或相对价格改变后，出口、进口数量随需求弹性、替代能力、合同、产能和时间而变化的行为机制。q的定义不包含这些参数；LA09仅对账和换算，不自动改写X/M。",
    lessonId: "A10-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-leverage",
    name: "资产杠杆（asset leverage）",
    definition:
      "本课在权益E>0时定义L=A/E，A为资产价值、E=A−D为权益。它衡量同一资产损失相对权益的放大；E=0时比率无定义，E<0时不把负比率当成“低风险”。",
    lessonId: "A11-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-maturity-mismatch",
    name: "期限错配（maturity mismatch）",
    definition:
      "需要较早偿付的负债与较晚回收或难以变现的资产并存。资产账面价值足够不保证到期支付有足够结算资产；实际风险还取决于再融资、抵押品和变现成本。",
    lessonId: "A11-A",
    references: ["MAC-BOE", "MAC-CORE"],
  },
  {
    id: "global-solvency",
    name: "偿付能力（solvency）",
    definition:
      "在明确估值与负债口径下，资产能否覆盖负债的问题。E=A−D是静态检查；现实还需未来现金流、法律优先顺序及估值不确定性，正权益不能保证每个时点都有流动性。",
    lessonId: "A11-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-valuation-loss",
    name: "估值损失（valuation loss）",
    definition:
      "已有资产的市场或模型估值降低造成的存量价值减少，未必包含借款者违约。它可影响权益与抵押能力，但自身不是GDP负生产或本期消费流量。",
    lessonId: "A11-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-deleveraging",
    name: "去杠杆（deleveraging）",
    definition:
      "通过偿债、减少资产或增加权益等方式降低杠杆的行为。在价格和信用相互影响的条件下，多主体同时售资产可能引起额外估值损失；不是每次偿债都会产生危机。",
    lessonId: "A11-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-feedback",
    name: "金融—实体反馈（financial-real feedback）",
    definition:
      "资产价值、信用条件、支出、收入与还款能力通过多条行为和制度关系相互影响的可能机制链。每条箭头需自己的假设或证据；单张平衡的账表不能独立推出整条链。",
    lessonId: "A11-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-model-closure",
    name: "模型闭合（model closure）",
    definition:
      "为使待求变量可由模型确定而明确外生变量、行为关系、均衡或动态条件的做法。固定投资的LA05、动态利率规则的LA06、事件账本LA07有不同闭合，不能直接拼接输出当联合预测。",
    lessonId: "A11-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-stress-test",
    name: "压力情景（stress scenario）",
    definition:
      "在明确冲击、约束与参数下检查脆弱性的条件计算。本课情景全部合成；它回答“若这些条件发生会怎样”，不提供发生概率或现实机构评级。",
    lessonId: "A11-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-counterfactual",
    name: "反事实（counterfactual）",
    definition:
      "与实际或基准情景相比，某项处理、政策或冲击不同时会出现的结果。模型反事实由假设计算；现实中同一对象同一时刻的替代结果不能同时观察，需要识别设计。",
    lessonId: "A12-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-identification",
    name: "因果识别（causal identification）",
    definition:
      "在数据与假设支持下把某项变化的因果作用与其他同时变化的因素区分开的过程。核算一致、相关、样本内拟合或模型模拟各有作用，都不能单独完成现实因果识别。",
    lessonId: "A12-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-endogeneity",
    name: "内生性（endogeneity）",
    definition:
      "用于解释结果的变量与未纳入的影响因素相关的情形，如政策针对预期衰退而调整。它不等于“模型里内生变量很多”；政策后经济较弱不能独立识别政策使经济变弱。",
    lessonId: "A12-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-confounder",
    name: "混杂因素（confounder）",
    definition:
      "同时影响政策或冲击分配与结果的因素，例如未观察的需求弱化同时促使降息和降低产出。只比较政策前后或处理组与对照组水平，可能把它的作用误归给政策。",
    lessonId: "A12-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-data-vintage",
    name: "数据版本（data vintage）",
    definition:
      "在某一发布日期或获取时点可获得的完整数据快照。观察期相同的首发值与修订值可能不同；研究当时决策的信息集须保留当时版本，不能用后见资料冒充已知。",
    lessonId: "A12-A",
    references: ["MAC-BEA", "MAC-MIT"],
  },
  {
    id: "global-uncertainty",
    name: "模型与测量不确定性（model and measurement uncertainty）",
    definition:
      "来自变量测量、未观察状态、参数、机制选择和识别假设等不同来源的不确定性。合成情景的参数区间是条件范围，未经过概率建模不能称作统计置信区间。",
    lessonId: "A12-A",
    references: ["MAC-BEA", "MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-sensitivity",
    name: "参数敏感性（parameter sensitivity）",
    definition:
      "保持模型与其他条件不变时，改变明确参数并比较结果的做法。它帮助找出结论依赖哪些条件；选择任意两点不能证明参数的真实取值，也不能补足因果识别。",
    lessonId: "A12-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-policy-criterion",
    name: "政策评价标准（policy evaluation criterion）",
    definition:
      "比较政策时明确采用的目标、分配权重、时间范围与风险取舍，如稳定通胀、就业、财政成本或保护脆弱群体。机制结果与规范标准应分开陈述，模型均衡不自动等于社会最优。",
    lessonId: "A12-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "global-reproducibility",
    name: "可复现分析（reproducible analysis）",
    definition:
      "让另一位学习者能依据同一原始数据版本、模型约定、参数、步骤和输出重建结果。保存截图或答案数字不够；本课记录原始输入、明确单位与条件，并区分客观计算和主观解释。",
    lessonId: "A12-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
];
