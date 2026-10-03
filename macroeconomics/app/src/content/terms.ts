import type { Term } from "./types";

export const terms: Term[] = [
  {
    id: "agent",
    name: "主体（agent）",
    definition:
      "为回答问题而划定的决策与记账单位，如家庭、企业、银行、政府和国外。分析边界决定哪些对手方被展开；一个部门内部仍可能有不同主体。",
    lessonId: "A01-A",
    references: ["MAC-CORE"],
  },
  {
    id: "stock",
    name: "存量（stock）",
    definition:
      "在明确时点测量的数量，如第0期末的存款或债务。单位是货币单位，而不是货币单位/期；必须写清时点。",
    lessonId: "A01-A",
    references: ["MAC-CORE"],
  },
  {
    id: "flow",
    name: "流量（flow）",
    definition:
      "在明确时间区间内发生或累计的数量，如第1期工资、消费或赤字。单位需带“/期”，改变区间长度会改变累计流量。",
    lessonId: "A01-A",
    references: ["MAC-CORE"],
  },
  {
    id: "income",
    name: "收入（income）",
    definition:
      "某主体在一个时期取得的收入流量。借款到账和卖掉已有资产不自动是本期收入；本实验家庭工资是收入，企业服务收入与工资费用分别记录。",
    lessonId: "A01-A",
    references: ["MAC-CORE"],
  },
  {
    id: "wealth",
    name: "财富（wealth）",
    definition:
      "某时点的资产与负债所描述的资源或权利。主体净财富通常用净值表示；社会实际财富还要辨别实物资产和相互抵消的内部金融权利，不能加总所有账户余额。",
    lessonId: "A01-A",
    references: ["MAC-CORE", "MAC-BOE"],
  },
  {
    id: "saving",
    name: "储蓄（saving）",
    definition:
      "一定期间内收入中未用于消费的部分，是流量。无重估、资本转移及其他调整时可对应净值增加；一般净值变化不能全部归为储蓄。",
    lessonId: "A01-A",
    references: ["MAC-CORE", "MAC-MIT"],
  },
  {
    id: "consumption",
    name: "消费（consumption）",
    definition:
      "当期最终使用的消费品与服务。在LA01家庭购买当期服务会减少家庭存款与净值；GDP中的C与日常所有付款不同。",
    lessonId: "A01-A",
    references: ["MAC-BEA"],
  },
  {
    id: "revaluation",
    name: "估值变化（revaluation）",
    definition:
      "资产价格改变带来的存量价值变化，如已有房屋价格上涨。它可能改变净值，却不等于本期储蓄或本期新增生产。",
    lessonId: "A01-A",
    references: ["MAC-CORE", "MAC-BEA"],
  },
  {
    id: "asset",
    name: "资产（asset）",
    definition:
      "主体持有的具有价值的资源或权利。存款对持有者是资产、对银行是负债；不能把同一金融工具两侧各算一份新资源。",
    lessonId: "A01-B",
    references: ["MAC-BOE"],
  },
  {
    id: "liability",
    name: "负债（liability）",
    definition:
      "主体对他方承担的义务。在本实验企业贷款负债对应银行贷款资产，银行存款负债对应家庭及企业存款资产。",
    lessonId: "A01-B",
    references: ["MAC-BOE"],
  },
  {
    id: "net-worth",
    name: "净值（net worth）",
    definition:
      "同一时点资产减负债的差额，亦写作资产=负债+净值。净值是存量；收入费用、估值和其他变化可能分别影响它。",
    lessonId: "A01-B",
    references: ["MAC-CORE", "MAC-BOE"],
  },
  {
    id: "deposit",
    name: "存款（deposit）",
    definition:
      "持有者对银行的金融权利，是银行的负债。工资或服务支付在本实验只改变分户，本金偿还同时减少贷款资产和存款负债。",
    lessonId: "A01-B",
    references: ["MAC-BOE"],
  },
  {
    id: "reserves",
    name: "准备金（reserves）",
    definition:
      "本实验中银行持有、由边界外发行方发行的资产。它与客户存款不是同一科目；发行方负债未展开，不能把准备金当成社会实物财富。",
    lessonId: "A01-B",
    references: ["MAC-BOE"],
  },
  {
    id: "principal",
    name: "贷款本金（principal）",
    definition:
      "尚未偿还的贷款余额，是负债/债权存量。本金偿还减少双方的金融资产与负债，不应记成消费或利息费用；本实验没有利息。",
    lessonId: "A01-B",
    references: ["MAC-BOE"],
  },
  {
    id: "gdp",
    name: "GDP（国内生产总值）",
    definition:
      "在一定生产边界与时期内新生产的最终产品和服务价值，可从增加值、最终使用或收入侧核算；不是所有交易额、财富存量或福利的总和。",
    lessonId: "A02-A",
    references: ["MAC-BEA", "MAC-BEA-GLOSS"],
  },
  {
    id: "value-added",
    name: "增加值（value added）",
    definition:
      "当期产出价值减当期中间投入价值。生产链逐段加总增加值可消除中间产品重复计入；本实验无税补贴和复杂特殊行业。",
    lessonId: "A02-A",
    references: ["MAC-BEA-GLOSS"],
  },
  {
    id: "intermediate-use",
    name: "中间使用（intermediate use）",
    definition:
      "在同一时期作为其他产品生产投入的商品或服务。是否中间使用取决于用途与时期，不是看商品名称；本例原料和加工品作为中间投入。",
    lessonId: "A02-A",
    references: ["MAC-BEA-GLOSS"],
  },
  {
    id: "final-use",
    name: "最终使用（final use）",
    definition:
      "未作为当期中间投入的使用，包括消费、资本形成等。最终使用不等于只有家庭消费；当期未售成品可作为存货投资进入最终使用。",
    lessonId: "A02-A",
    references: ["MAC-BEA", "MAC-BEA-GLOSS"],
  },
  {
    id: "inventory",
    name: "存货（inventory）",
    definition:
      "某时点持有的未用或未售产品是存量；本期存货增加减减少是投资流量。前期生产存货本期销售会增加C、减少当期存货投资，避免同一产出跨期重复计入。",
    lessonId: "A02-A",
    references: ["MAC-BEA"],
  },
  {
    id: "gross-surplus",
    name: "毛营业盈余（gross operating surplus）",
    definition:
      "本简化模型增加值扣除工资后的毛收入分项，未扣折旧。它与工资共同对应生产创造的收入，不能另加在最终支出之上。",
    lessonId: "A02-A",
    references: ["MAC-BEA"],
  },
  {
    id: "investment",
    name: "投资/资本形成（investment）",
    definition:
      "GDP核算中的I指当期资本形成与存货变化等生产使用。购买已有股票只是金融权利转移，购买当期新生产机器作为资本形成才进入本例的I。",
    lessonId: "A02-B",
    references: ["MAC-BEA", "MAC-MIT"],
  },
  {
    id: "transfer",
    name: "转移支付（transfer）",
    definition:
      "没有直接交换本期商品或服务的支付。政府向家庭转移影响可支配收入，转移本身不是政府购买G；其后续行为影响须另外建模。",
    lessonId: "A02-B",
    references: ["MAC-BEA", "MAC-MIT"],
  },
  {
    id: "government-purchases",
    name: "政府购买（government purchases）",
    definition:
      "政府对本期商品和服务的购买，在本课记为G。它不包括纯转移支付；公共资本形成等完整官方细项需查具体口径。",
    lessonId: "A02-B",
    references: ["MAC-BEA"],
  },
  {
    id: "net-exports",
    name: "净出口（net exports）",
    definition:
      "同口径出口X减进口M，记NX。减进口是扣除最终支出中包含的境外生产，不是进口导致国内产出下降的因果定律。",
    lessonId: "A02-B",
    references: ["MAC-BEA", "MAC-MIT"],
  },
  {
    id: "identity",
    name: "恒等式（identity）",
    definition:
      "给定定义与核算口径后必定成立的关系，如Y=C+I+G+X−M。它限制一致的账目，却没有单独规定改变某分项时其他变量怎样反应。",
    lessonId: "A02-B",
    references: ["MAC-MIT"],
  },
  {
    id: "behavioral-mechanism",
    name: "行为机制（behavioral mechanism）",
    definition:
      "关于主体如何响应价格、收入、预期或制度的可改变假设。它用于解释反事实变化；与恒等式兼容仍不代表得到现实因果证据。",
    lessonId: "A02-B",
    references: ["MAC-MIT", "MAC-CORE"],
  },
  {
    id: "nominal",
    name: "名义（nominal）",
    definition:
      "用各期当期价格评价各期数量，如Nₜ=Σpₜqₜ。名义值变化同时含价格与数量因素；要说明货币单位和时期。",
    lessonId: "A03-A",
    references: ["MAC-BEA"],
  },
  {
    id: "real",
    name: "实际（real）",
    definition:
      "按明确价格权重聚合数量的度量。本课固定第0期价格，Rₜ=Σp₀qₜ；不同物品不能直接相加，权重变化可能改变聚合增长。",
    lessonId: "A03-A",
    references: ["MAC-BEA"],
  },
  {
    id: "price-index",
    name: "价格指数（price index）",
    definition:
      "在给定对象、篮子或权重下，相对基准期的价格度量。本课D反映当期产出组合，L给第0期固定消费篮子定价；指数点与百分比是不同单位。",
    lessonId: "A03-A",
    references: ["MAC-BLS-CPI", "MAC-BEA"],
  },
  {
    id: "deflator",
    name: "GDP平减指数（GDP deflator）",
    definition:
      "本教学模型Dₜ=100×Nₜ/Rₜ，Rₜ>0时定义。它与实际产出精确分解名义值；现实覆盖对象和方法与消费价格指数不同。",
    lessonId: "A03-A",
    references: ["MAC-BEA"],
  },
  {
    id: "base-period",
    name: "基期与归一化（base period / normalization）",
    definition:
      "基期价格或篮子决定权重；归一化只改变指数刻度。把100写成1000是同比例重标，改变价格权重是另一种操作，二者不能混为一谈。",
    lessonId: "A03-A",
    references: ["MAC-BEA", "MAC-BLS-CPI"],
  },
  {
    id: "growth-rate",
    name: "增长率（growth rate）",
    definition:
      "本期水平/比较期水平−1，比较期非零时定义。需标明比较间隔；水平更高不保证增长更快，零分母不能写成零增长。",
    lessonId: "A03-A",
    references: ["MAC-BEA"],
  },
  {
    id: "inflation",
    name: "通胀（inflation）",
    definition:
      "明确价格指数在一定期间的正增长率。要注明指数与比较时期；一次某商品涨价不能直接代表总体通胀，价格水平与通胀率不同。",
    lessonId: "A03-B",
    references: ["MAC-BLS-CPI"],
  },
  {
    id: "disinflation",
    name: "通胀放缓（disinflation）",
    definition:
      "通胀率降低，但可能仍为正。指数100→110→112.2对应10%→2%，价格继续上涨，不能解释成价格回到基准。",
    lessonId: "A03-B",
    references: ["MAC-BLS-CPI"],
  },
  {
    id: "deflation",
    name: "通缩（deflation）",
    definition:
      "明确总体价格指数在相应期间下降，即负通胀。它与仍为正的通胀放缓不同；单个商品降价也不足以说明总体通缩。",
    lessonId: "A03-B",
    references: ["MAC-BLS-CPI"],
  },
  {
    id: "year-over-year",
    name: "同比（year over year）",
    definition:
      "比较本期与上年同一期，如一个季度相对上年对应季度。它覆盖的时间窗口与环比不同，季节性与数据版本也需注明。",
    lessonId: "A03-B",
    references: ["MAC-BEA"],
  },
  {
    id: "period-over-period",
    name: "环比（period over period）",
    definition:
      "比较本期与紧邻上一期，例如季度对季度。季度环比与同比、环比折年率各有不同口径，不能仅因都写百分号就直接比较。",
    lessonId: "A03-B",
    references: ["MAC-BEA"],
  },
  {
    id: "percent",
    name: "百分比（percent）",
    definition:
      "相对某个基数的比率，用%表示。通胀10%降到2%是相对原通胀率下降80%，该基数是10%，不是价格指数水平。",
    lessonId: "A03-B",
    references: ["MAC-BEA"],
  },
  {
    id: "percentage-point",
    name: "百分点（percentage point）",
    definition:
      "两个以百分数表示的比率之差。10%减2%=8个百分点；该差不是价格下降8%，也不是相对通胀率下降8%。",
    lessonId: "A03-B",
    references: ["MAC-BEA"],
  },
  {
    id: "data-revision",
    name: "数据修订（data revision）",
    definition:
      "在取得新资料或调整方法后更新已发布的估计。观察时期、发布日期和版本应分开，不能用后来修订值冒充当时可获得的信息。",
    lessonId: "A03-B",
    references: ["MAC-BEA"],
  },
];
