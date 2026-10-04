import affinityExcerpt from "./data/oi-affinity-2020-excerpt.csv?raw";
import claimsExcerpt from "./data/oi-ui-claims-2020-excerpt.csv?raw";
import receipt from "./data/oi-source-receipt.json";

export type CaseTransformation = "fraction_to_percent" | "count_to_million";
export type CaseObservation = { date: string; values: Record<string, number | null> };
export type CaseSeries = { id: string; label: string; unit: string; transform: CaseTransformation };
export type CaseQuestion = { title: string; prompt: string; explanation: string; rubric: string[] };
export type DataProvenance = {
  provider: string;
  seriesId: string;
  sourceUrl: string;
  originalProviderUrl: string;
  observationPeriod: string;
  frequency: string;
  units: string;
  nominalReal: string;
  seasonalAdjustment: string;
  retrievedAtUTC: string;
  vintageRevision: string;
  transformation: string;
  licenseNote: string;
  rawSnapshotFile: string;
  snapshotSha256: string;
  upstreamSha256: string;
};
export type CaseStudy = {
  id: string;
  title: string;
  question: string;
  lessonIds: string[];
  referenceId: string;
  object: string;
  observed: string;
  modelConnection: string;
  identificationBoundary: string;
  missingData: string;
  syntheticPractice: { label: string; lessonId: string; explanation: string };
  provenance: DataProvenance;
  series: CaseSeries[];
  observations: CaseObservation[];
  questions: CaseQuestion[];
};

const upstreamCommit = receipt.upstreamCommit;
const fixedSource = (path: string) => `https://github.com/OpportunityInsights/EconomicTracker/blob/${upstreamCommit}/${path}`;
export const caseMethodologyLinks = [
  { title: "OI 数据字典（固定版本）", url: fixedSource("docs/oi_tracker_data_dictionary.md") },
  { title: "OI 处理方法与测量范围（固定版本）", url: fixedSource("docs/oi_tracker_data_documentation.md") },
  { title: "OI 修订记录（固定版本）", url: fixedSource("docs/oi_tracker_data_revisions.md") },
  { title: "OI 使用与署名说明（固定版本）", url: fixedSource("README.md") },
  { title: "Chetty、Friedman、Hendren、Stepner 与 OI 团队，2020，配套研究", url: "https://opportunityinsights.org/wp-content/uploads/2020/05/tracker_paper.pdf" },
];

/** The stored excerpt has only unquoted numeric columns, with '.' as missing. */
export function parseCaseExcerpt(raw: string, ids: readonly string[], dayColumn: "day" | "day_endofweek"): CaseObservation[] {
  const lines = raw.trim().split(/\r?\n/);
  const columns = lines[0]?.split(",") ?? [];
  if (new Set(columns).size !== columns.length || lines.length < 2) throw new Error("案例 CSV 表头无效");
  for (const id of ["year", "month", dayColumn, ...ids]) if (!columns.includes(id)) throw new Error(`缺少案例字段 ${id}`);
  const index = (id: string) => columns.indexOf(id);
  const observations = lines.slice(1).map((line) => {
    const cells = line.split(",");
    if (cells.length !== columns.length) throw new Error("案例 CSV 行宽与表头不符");
    const dateParts = ["year", "month", dayColumn].map((key) => cells[index(key)]);
    if (dateParts.some((part) => !/^\d+$/.test(part))) throw new Error("案例日期无效");
    const [year, month, day] = dateParts.map(Number);
    const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const timestamp = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString().slice(0, 10) !== date) throw new Error("案例日期不在日历内");
    const values = Object.fromEntries(ids.map((id) => {
      const cell = cells[index(id)];
      if (cell === ".") return [id, null];
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cell) || !Number.isFinite(Number(cell))) throw new Error(`案例数值无效 ${id}`);
      return [id, Number(cell)];
    }));
    return { date, values };
  });
  for (let i = 1; i < observations.length; i++) if (observations[i].date <= observations[i - 1].date) throw new Error("案例日期重复或未排序");
  return observations;
}

export function transformCaseValue(value: number | null, transform: CaseTransformation): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) throw new Error("案例数据必须是有限数值或缺失");
  return transform === "fraction_to_percent" ? value * 100 : value / 1_000_000;
}

export function getCaseTable(study: CaseStudy): CaseObservation[] {
  return study.observations.map((row) => ({ date: row.date, values: Object.fromEntries(study.series.map((series) => {
    if (!(series.id in row.values)) throw new Error(`案例缺少观测列 ${series.id}`);
    return [series.id, transformCaseValue(row.values[series.id], series.transform)];
  })) }));
}

/** Descriptive differences only; no fitted elasticity or causal estimate. */
export function compareCaseDates(study: CaseStudy, startDate: string, endDate: string) {
  const table = getCaseTable(study);
  const start = table.find((row) => row.date === startDate);
  const end = table.find((row) => row.date === endDate);
  if (!start || !end) throw new Error("只能比较已保存的观测日期");
  return study.series.map((series) => {
    const a = start.values[series.id], b = end.values[series.id];
    return { ...series, start: a, end: b, difference: a === null || b === null ? null : b - a,
      differenceUnit: series.transform === "fraction_to_percent" ? "百分点" : "百万件" };
  });
}

/** Shared plot/table rows; x is elapsed UTC days, not equally spaced category slots. */
export function getCaseFigure(study: CaseStudy) {
  const table = getCaseTable(study);
  const firstDay = Date.parse(`${table[0].date}T00:00:00Z`);
  const lastDay = Date.parse(`${table[table.length - 1].date}T00:00:00Z`);
  const values = table.flatMap((row) => Object.values(row.values).filter((v): v is number => v !== null));
  const min = Math.min(0, ...values), max = Math.max(0, ...values), pad = Math.max((max - min) * .12, 1);
  return { table, firstDay, lastDay, yMin: min - pad, yMax: max + pad };
}

const commonProvenance = {
  observationPeriod: "2020-02-29 至 2020-06-06；从历史文件选取六个日期，不是完整时间序列",
  retrievedAtUTC: receipt.retrievedAtUTC,
  vintageRevision: `固定上游 commit ${upstreamCommit}（2026-10-02T15:04:19Z）；2026-09-17 方法说明。使用后来修订的历史值，不重建 2020 年当时可知的信息；此快照不会自动更新。`,
  licenseNote: "OI README 明确允许使用所发布数据，要求标明具体数据提供者，并引用 OI Economic Tracker 与配套研究。本页按此署名；不复制原图、教材或个人记录。",
};
const affinityIds = ["spend_all", "spend_all_q1", "spend_all_q4"];
const claimsIds = ["initclaims_count_regular", "contclaims_count_regular"];

export const caseStudies: CaseStudy[] = [
  {
    id: "card-spending-2020", title: "支出下降，能说明需求曲线向左移吗？",
    question: "2020 年春季，高收入地区与低收入地区的卡支出降幅不同。我们究竟观察了什么，还不能推断什么？",
    lessonIds: ["M03-B", "M05-B", "M06-A", "M12-B"], referenceId: "MIC-OI-AFFINITY",
    object: "美国全国范围、Affinity 样本中的信用卡和借记卡支付。q1/q4 按持卡人居住 ZIP code 的家庭收入中位数分组，不是每位持卡人的收入分位，更不是同一家庭收入的变化。",
    observed: "六个日期记录的是相对 2020-01-06 至 2020-02-02 基期的支出金额变化。数据已由 OI 做季节与假日调整及七日回看平均；不包含可直接联立的单一商品价格和实物销量。",
    modelConnection: "M03 的选择模型会把支出写成价格乘数量，并区分预算、相对价格和偏好。M05 说明均衡数量下降可能来自需求、供给或两侧同时变化。金额和地区分组只是机制分析的起点。",
    identificationBoundary: "这些共变不能识别需求弹性、收入效应或某项政策的因果效果。疫情、营业限制、健康风险、价格、转移支付和支付样本组成可能同时变；需要商品层面的价格/数量、可比人群及可辩护的外生变化。",
    missingData: "所选六行的三个指标均有值，原始文件中的 '.' 仍表示缺失。未选择日期没有在本页补值；两组相对变化不能在没有权重时平均成全国值。",
    syntheticPractice: { label: "M03-B · synthetic 需求实验", lessonId: "M03-B", explanation: "在 ML03 中固定预算与偏好，只改一个价格，观察模型内选择；这是合成参数的反事实，不能把本页支出变化当作模型校准或验证。" },
    provenance: {
      ...commonProvenance, provider: "Affinity Solutions（原始匿名卡交易）／Opportunity Insights Economic Tracker（处理与发布）",
      seriesId: affinityIds.join("；"), sourceUrl: receipt.files[0].sourceUrl,
      originalProviderUrl: "https://www.affinity.solutions/dataforgood",
      frequency: "原序列在所选 2020 年为日频、七日回看移动平均；本页仅选择六个日期",
      units: "原 CSV 是相对基期的比例变化；显示单位为 %。例如 −0.321 显示为 −32.1%",
      nominalReal: "金额变化指标；核验的来源说明未提供统一价格平减，本页不把它当成实际消费数量或价格不变的消费增长。",
      seasonalAdjustment: "来源已季调并校正假日，参照 2019 年相应季节变化；使用 spend_ 列。spend_s_ 与 spend_19_ 为未季调列，本页不混用。",
      transformation: "保留原始 CSV 六行；仅将 spend_all、spend_all_q1、spend_all_q4 乘 100 为百分数。比较日期时相减得到百分点；不拟合、不平滑、不插补、不取组间均值。",
      rawSnapshotFile: receipt.files[0].file, snapshotSha256: receipt.files[0].excerptSha256, upstreamSha256: receipt.files[0].upstreamSha256,
    },
    series: [
      { id: "spend_all", label: "样本全国合计", unit: "%", transform: "fraction_to_percent" },
      { id: "spend_all_q1", label: "低收入 ZIP 地区 q1", unit: "%", transform: "fraction_to_percent" },
      { id: "spend_all_q4", label: "高收入 ZIP 地区 q4", unit: "%", transform: "fraction_to_percent" },
    ],
    observations: parseCaseExcerpt(affinityExcerpt, affinityIds, "day"),
    questions: [
      { title: "对象与模型条件", prompt: "q4 的卡支出下降更深，是否意味着高收入家庭需求价格弹性更大？请写出观察单位、支出分解和缺少的变量。", explanation: "不能。q4 是居住地区的收入分组，不是个体收入；支出同时受价格、数量和商品组成影响。价格弹性要求在其他条件固定时比较价格与需求量响应，此表没有这种变化。", rubric: ["区分地区分组与个体收入。", "区分金额支出和数量，指出缺少价格与固定条件。", "只将差距陈述为已选日期的描述性事实。"] },
      { title: "识别与可反驳命题", prompt: "若假说是健康风险降低了线下服务需求，需要哪种额外数据或对照，才有机会将其与营业限制分开？", explanation: "可追踪线下/线上商品构成、风险暴露和限制时间，找具有可比事前趋势而限制或风险变化不同的单位。仍须说明政策选择、共同冲击和溢出的识别条件；只画出前后两个点不足以识别。", rubric: ["明确假说预测与测量对象。", "提出能区分健康风险与限制的对照。", "列出选择偏差、事前趋势或共同冲击问题。"] },
      { title: "替代机制与分配", prompt: "除了偏好变化，还有哪些机制能产生两组不同降幅？这些变化能直接证明哪组福利损失更大吗？", explanation: "不同商品篮子、工作收入、流动性约束、转移支付、线上替代和样本构成都可能产生差异。各组基期金额与效用不相同，金额的百分比变化不能直接进行人际福利比较。", rubric: ["比较至少两个具有不同预测的机制。", "解释还需商品篮子、预算或支付覆盖信息。", "不把支出比例变化当作福利或公平指标。"] },
    ],
  },
  {
    id: "ui-claims-2020", title: "初请下降，劳动市场已经恢复了吗？",
    question: "常规初请和续请的路径不同：一个指标回落，为什么不能据此判断失业存量或劳动供给已经恢复？",
    lessonIds: ["M10-B", "M11-A", "M12-B"], referenceId: "MIC-OI-UI",
    object: "美国常规失业保险（Regular UI）的周初请与周续请申请件数，由美国劳工部数据经 OI 全国文件发布。只比较同一种常规项目，不把 PUA/PEUC 当作零或加入未核验总数。",
    observed: "初请是每周新增申领事件；续请是继续申领报告，反映留在该制度中的情况。二者都不是失业调查人数，也不能相加成失业人口；周报与申领资格、处理时间和重复申领有关。",
    modelConnection: "M11 的劳动选择与需求模型描述约束和激励；申领记录额外经过失业保险的资格、参与与行政过程。用劳动需求冲击或保障制度解释记录时，必须先写清该测量关系。",
    identificationBoundary: "六个日期不能识别失业保险对劳动供给的因果效应。劳动力需求、健康限制、资格变化、积压与领取期限也会改变件数；需要就业、求职、工资、资格与发放记录以及可信对照。",
    missingData: "所选常规项目计数均有值。原 CSV 其他项目可能有 '.'；本页保留原始行但不补造、不合并，也不从所选日期插补每周数据。",
    syntheticPractice: { label: "M11-A · synthetic 劳动选择实验", lessonId: "M11-A", explanation: "ML10 劳动面板固定偏好与时间，只改变工资或非劳动收入。结果属于玩具模型中的最优选择；申领件数没有提供该模型所需的个体参数。" },
    provenance: {
      ...commonProvenance, provider: "美国劳工部（U.S. Department of Labor，全国常规 UI 原始统计）／Opportunity Insights Economic Tracker（发布）",
      seriesId: claimsIds.join("；"), sourceUrl: receipt.files[1].sourceUrl,
      originalProviderUrl: "https://oui.doleta.gov/unemploy/DataDashboard.asp",
      frequency: "周频，以周六为周结束日期；本页仅选择六周",
      units: "原 CSV 为常规初请/续请件数；图表显示百万件，原值表保留件数",
      nominalReal: "申请计数，不是货币量，名义/实际价格平减不适用。",
      seasonalAdjustment: "核验的 OI 字典与处理说明未明确所选常规计数的季调口径；本页不添加季调，也不据此声称排除了季节性。",
      transformation: "保留原始 CSV 六行；仅把 initclaims_count_regular 与 contclaims_count_regular 除以 1,000,000 为百万件。选定日期之差是计数差；不把初请与续请相加、不转为失业率、不插补。",
      rawSnapshotFile: receipt.files[1].file, snapshotSha256: receipt.files[1].excerptSha256, upstreamSha256: receipt.files[1].upstreamSha256,
    },
    series: [
      { id: "initclaims_count_regular", label: "每周常规初请", unit: "百万件", transform: "count_to_million" },
      { id: "contclaims_count_regular", label: "每周常规续请", unit: "百万件", transform: "count_to_million" },
    ],
    observations: parseCaseExcerpt(claimsExcerpt, claimsIds, "day_endofweek"),
    questions: [
      { title: "对象、流入与持续状态", prompt: "从 3 月 28 日到 5 月 9 日，初请下降、续请增加。这是否自相矛盾？为什么不能把两列相加？", explanation: "不矛盾：每周新申领减少时，此前申领者仍可能继续申领。二者报告的事件与时间口径不同，且可能涉及同一人；相加会混淆流入与持续申领，不会得到独立失业人数。", rubric: ["解释每周初请与继续申领的不同对象。", "说明先前进入者可能仍未退出。", "拒绝相加推算失业人口。"] },
      { title: "激励假说的识别", prompt: "如果有人说保障提高导致求职减少，这张表能检验吗？如何将劳动供给机制与岗位需求不足区分？", explanation: "表中既没有保障变化的外生分组，也没有求职和岗位需求。需要资格或制度变化与对照、就业和求职行为、职位及健康限制，并论证变化不是由当地经济恶化选择的。记录增加也可能是覆盖扩大或行政积压。", rubric: ["区分模型中的收入/激励机制与申领记录。", "提出岗位需求和求职行为的独立测量。", "说明制度变化的选择偏差与对照条件。"] },
      { title: "反例与替代机制", prompt: "哪些情况下，续请下降但就业未恢复？提出一个能推翻‘续请下降等于就业改善’的观察。", explanation: "领取期限耗尽、资格变动、退出申领或转入另一项目，都可能使常规续请减少而没有新增就业。将续请下降与就业未增加、其他项目申领增加或资格到期一起观察，就会挑战这个简单解释。", rubric: ["提出至少两个行政或参与机制。", "给出可观察的就业/项目迁移/资格到期证据。", "不把一个记录指标作为劳动力市场整体结论。"] },
    ],
  },
];

export function caseEvidenceText(study: CaseStudy, startDate: string, endDate: string): string {
  const comparison = compareCaseDates(study, startDate, endDate);
  return [
    `历史观测案例：${study.title}（observed，非 synthetic）`,
    `提供者：${study.provenance.provider}`,
    `序列：${study.provenance.seriesId}`,
    `来源：${study.provenance.sourceUrl}`,
    `观测时期：${study.provenance.observationPeriod}；比较：${startDate} → ${endDate}`,
    `单位与转换：${study.provenance.units}；${study.provenance.transformation}`,
    `名义/实际：${study.provenance.nominalReal}；季调：${study.provenance.seasonalAdjustment}`,
    `获取于 UTC ${study.provenance.retrievedAtUTC}；${study.provenance.vintageRevision}`,
    `本地原始摘录 SHA-256：${study.provenance.snapshotSha256}`,
    ...comparison.map((row) => `${row.label}：${row.start ?? "缺失"} → ${row.end ?? "缺失"} ${row.unit}；差 ${row.difference ?? "缺失"} ${row.differenceUnit}`),
    `解释边界：${study.identificationBoundary}`,
    "待我补充：研究对象与假说；至少一个替代机制；能推翻假说的观察；识别条件与分配影响。",
  ].join("\n");
}

export function getCaseRawSnapshot(study: CaseStudy): string {
  if (study.id === "card-spending-2020") return affinityExcerpt;
  if (study.id === "ui-claims-2020") return claimsExcerpt;
  throw new Error("未知案例没有原始摘录");
}
