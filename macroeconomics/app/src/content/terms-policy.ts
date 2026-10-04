import type { Term } from "./types";

/** 本组词条只定义本课程的教学口径，不将其称作各国统一统计或监管规则。 */
export const policyTerms: Term[] = [
  {
    id: "policy-employment",
    name: "就业（employment）",
    definition:
      "在指定统计对象、参考时期和工作判定规则下归为就业的人数E。就业不要求一定全职；比较数字前须统一年龄范围、参考时期及调查口径。",
    lessonId: "A07-A",
    references: ["MAC-BLS-LABOR"],
  },
  {
    id: "policy-unemployment",
    name: "失业（unemployment）",
    definition:
      "本课教学分类中，未就业、可以工作且近期主动寻找工作的人数U。无工作者还可能在劳动力之外，不能将全部未就业人口归为失业。",
    lessonId: "A07-A",
    references: ["MAC-BLS-LABOR"],
  },
  {
    id: "policy-labor-force",
    name: "劳动力（labor force）",
    definition:
      "同一统计对象和时期内就业与失业的合计LF=E+U。劳动力不是全部劳动年龄人口；本课以LF为失业率分母，以符合范围的人口N为参与率分母。",
    lessonId: "A07-A",
    references: ["MAC-BLS-LABOR"],
  },
  {
    id: "policy-participation",
    name: "劳动力参与率（participation rate）",
    definition:
      "同一口径下劳动力LF占范围内人口N的比例LF/N。参与变化可以同时影响失业率与就业人口比，不能只看一个比率判断就业改善。",
    lessonId: "A07-A",
    references: ["MAC-BLS-LABOR"],
  },
  {
    id: "policy-real-wage",
    name: "实际工资（real wage）",
    definition:
      "名义工资W除以一致的价格水平P，表示工资的购买力。价格设定模型P=(1+μ)W/a中的W/P=a/(1+μ)依赖劳动生产率a及加价μ的假设，不是所有工资制度的恒等式。",
    lessonId: "A07-A",
    references: ["MAC-CORE", "MAC-MIT"],
  },
  {
    id: "policy-output-gap",
    name: "产出缺口（output gap）",
    definition:
      "实际产出相对于当期潜在产出的偏离，可写100×(Y−Y潜在)/Y潜在；LA06按百分数尺度输入x，变化用百分点。负缺口不直接等于产出负增长或负通胀。潜在产出是需估计的反事实基准，实验中外生给定，现实中不能当直接观察到的真值。",
    lessonId: "A07-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "policy-expected-inflation",
    name: "预期通胀（expected inflation）",
    definition:
      "主体对未来价格增长的预期，不等于已经实现的通胀。LA06以上一期预期进入当期价格方程，并用λ表示观察当期通胀后的适应更新速度；这是特定行为假设。",
    lessonId: "A07-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "policy-phillips",
    name: "预期扩展的 Phillips 关系",
    definition:
      "LA06中π_t=πe_(t−1)+κx_t+s_t，把通胀与过去预期、缺口及成本冲击连接起来。斜率、预期和制度可变，因此不是永恒可选的失业—通胀菜单。",
    lessonId: "A07-B",
    references: ["MAC-CORE", "MAC-MIT"],
  },
  {
    id: "policy-supply-shock",
    name: "成本冲击（cost shock）",
    definition:
      "在给定预期、产出缺口和潜在产出下，直接改变LA06价格方程的外生项s。实验不通过s另行降低潜在产出，不能完整表示实物产能损毁；它也不声称能识别现实能源、工资或供应链冲击。",
    lessonId: "A07-B",
    references: ["MAC-CORE", "MAC-MIT"],
  },
  {
    id: "policy-lag",
    name: "政策传导滞后（policy lag）",
    definition:
      "政策工具变化到影响需求和价格之间的时间安排。LA06用i_(t−1)影响x_t，当期i_t只能影响下一期及以后；现实传导期长短还取决于制度、合同和预期。",
    lessonId: "A08-B",
    references: ["MAC-MIT"],
  },
  {
    id: "policy-bank-capital",
    name: "银行资本 / 权益（bank equity）",
    definition:
      "银行账面资产减负债的差额，可承受资产损失；不是一袋专用于付款的现金。LA07权益下降与准备金不足分别表示不同问题，教学数值不等于真实监管标准。",
    lessonId: "A08-A",
    references: ["MAC-BOE", "MAC-CORE"],
  },
  {
    id: "policy-liquidity",
    name: "流动性（liquidity）",
    definition:
      "在给定时点按约付款的能力。LA07跨行支付要求付款行拥有足够准备金；有正权益仍可能暂时无法结算，现实新增融资机制需另外建模。",
    lessonId: "A08-A",
    references: ["MAC-BOE", "MAC-CORE"],
  },
  {
    id: "policy-credit-loss",
    name: "贷款损失（credit loss）",
    definition:
      "银行确认贷款资产价值损失时，资产和权益相应下降。它不同于正常本金偿还，不会仅凭资产减记自动减少所有存款；资产减记与债务法律解除也不是同一概念。",
    lessonId: "A08-A",
    references: ["MAC-BOE", "MAC-CORE"],
  },
  {
    id: "policy-nominal-rate",
    name: "名义利率（nominal interest rate）",
    definition:
      "按货币单位计价的跨期收益或融资成本率。必须说明期间、复利方式、信用风险与费用；央行政策利率不等于所有客户实际面对的贷款利率。",
    lessonId: "A08-B",
    references: ["MAC-MIT", "MAC-BOE"],
  },
  {
    id: "policy-real-rate",
    name: "实际利率（real interest rate）",
    definition:
      "按价格变化调整的跨期回报。确定性教学例中，精确r=(1+i)/(1+π)−1=(i−π)/(1+π)，利率与通胀较小时常近似r≈i−π；事前使用预期通胀、事后使用实现通胀，须保持同一期间和资产口径。",
    lessonId: "A08-B",
    references: ["MAC-MIT"],
  },
  {
    id: "policy-neutral-rate",
    name: "自然 / 中性实际利率（r*）",
    definition:
      "使模型需求处于基准状态的实际利率参照。LA06外生给定r*=1%（按百分数尺度输入1）；利率差才用百分点。现实中需估计且可能随结构变化，不能把实验参数当可直接观测的政策真值。",
    lessonId: "A08-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "policy-qe",
    name: "量化宽松（quantitative easing, QE）",
    definition:
      "央行购买资产并改变资产负债表结构的操作。向银行购债通常改变其证券与准备金组合；向非银行购债还涉及客户存款。效果依赖卖方、期限、风险及行为，不能等同同额政府购买或现金消费。",
    lessonId: "A08-B",
    references: ["MAC-BOE", "MAC-MIT"],
  },
  {
    id: "policy-net-tax",
    name: "净税收（net taxes）",
    definition:
      "本课T=税收收入减转移支付，是期间流量。G为政府最终消费，I包含公共资本形成；私人可支配收入写Y−T，政府储蓄写T−G。当前模型没有公共投资，政府储蓄才同时等于初级余额；避免把转移同时算入G又减入T。",
    lessonId: "A09-A",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "policy-automatic-stabilizer",
    name: "自动稳定器（automatic stabilizer）",
    definition:
      "在既有规则不变时，收入下降使税收减少或符合资格的转移增加，从而缓冲可支配收入下降。它不是每次衰退都新立法的主动刺激，也不保证完全消除波动。",
    lessonId: "A09-A",
    references: ["MAC-CORE", "MAC-MIT"],
  },
  {
    id: "policy-primary-balance",
    name: "初级余额 / 初级赤字（primary balance / deficit）",
    definition:
      "不含债务利息的政府收入减支出称初级余额；反号为初级赤字PD，正数是赤字。本课G为政府最终消费，当前无公共投资或其他政府科目，故PD=G−T；若加入公共投资I_g，应写PD=G+I_g−T。总体赤字还包括利息。",
    lessonId: "A09-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "policy-debt-ratio",
    name: "债务率（debt-to-GDP ratio）",
    definition:
      "本课b_t=B_t/Y_t，即期末本币名义债务除以同一期名义GDP。它是存量对期间规模的比例，须说明分母时期、债务覆盖和价格口径，不能与赤字率混用。",
    lessonId: "A09-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "policy-effective-interest",
    name: "有效债务利率（effective interest rate）",
    definition:
      "LA08中i_t是本期对期初债务实际计提的名义利率，不是所有旧债瞬间重定价的新增借款利率。旧债期限与重新融资使两者可能不同。",
    lessonId: "A09-B",
    references: ["MAC-MIT"],
  },
  {
    id: "policy-stock-flow-adjustment",
    name: "存量流量调整（stock-flow adjustment）",
    definition:
      "债务存量变动中不能由本期利息与初级赤字解释的项目，如估值、汇率、资产交易或统计范围调整。LA08明确省略这些项；用于现实对账时应逐项加入，不能设不明调整行凑平。",
    lessonId: "A09-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
];
