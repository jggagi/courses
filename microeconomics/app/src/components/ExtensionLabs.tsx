import { useEffect, useId, useState, type ReactNode } from "react";
import {
  EXTENSION_LAB_IDS,
  extensionDefaults,
  extensionLabDefinitions,
  runExtensionLab,
  type ExtensionLabId,
  type ExtensionParameters,
} from "../models/extensions";
import type { LearningState } from "../persistence/store";
import "./extension-labs.css";

type Definition = (typeof extensionLabDefinitions)[number];
type Field = Definition["fields"][number];
type Result = ReturnType<typeof runExtensionLab>;
type Curve = Result["curves"][number];
type LabState = LearningState["extensionLabStates"][ExtensionLabId];
type Side = "baseline" | "scenario";
type Parameters = Pick<LabState, Side>;
const sideName: Record<Side, string> = { baseline: "A", scenario: "B" };
const format = (value: number) => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(value);
const display = (value: number | string | null | undefined) => value === null ? "未定义 / 不适用" : value === undefined ? "此情景无此项" : typeof value === "number" ? format(value) : value;

interface Teaching {
  links: { id: string; label: string }[];
  objects: string;
  derivation: { title: string; paragraphs: string[]; formula: string }[];
  prediction: string;
  example: string;
  exampleKeys: string[];
  interpret: string[];
  caveats: string[];
}

const teaching: Record<ExtensionLabId, Teaching> = {
  MX01: {
    links: [{ id: "M03-B", label: "M03-B：需求、收入与替代" }],
    objects: "一个消费者选择商品 x 和 y。m 是货币收入，px0 与 px1 是 x 的旧、新价格，py 固定；0<α<1 是偏好权重。价格和收入为外生条件，需求、补偿收入及效应为模型内结果。商品连续可分，效用 U=x^α y^(1−α) 只用来表示排序。",
    derivation: [
      { title: "1. 先求同一偏好下的普通需求", paragraphs: ["预算 px·x+py·y=m 在正收入、正价格和内点偏好下用尽。边际替代率 αy/[(1−α)x] 等于 px/py；把这个关系代回预算，得到两种商品各自固定的支出份额。", "旧价格给出 x₀；新价格、原收入给出 x₁。x₁−x₀ 是总价格效应，还没有把购买力和相对价格机制分开。"], formula: "x(m,px)=αm/px，y(m,py)=(1−α)m/py；Δx=x₁−x₀" },
      { title: "2. Slutsky：让旧组合仍买得起", paragraphs: ["按新价格给旧组合定价：mS=px1·x₀+py·y₀=m+(px1−px0)x₀。消费者可以继续买旧组合，却可能改买更喜欢的组合，因此它不是严格保持原效用的补偿。", "以新价格和 mS 求需求 xS。先比较 xS−x₀，再比较 x₁−xS；两段之和正好等于总效应。这是有限价格变化的精确分解，不是用一条导数近似替代。"], formula: "Slutsky 替代效应=xS−x₀；收入效应=x₁−xS；两项和=Δx" },
      { title: "3. Hicks：让最小支出仍达到旧效用", paragraphs: ["先把旧效用 U₀ 固定，最小化新价格下的支出。最优补偿组合仍有支出份额 α 与 1−α；将 x=αe/px、y=(1−α)e/py 代入效用，解出支出函数。", "得到 mH=e(px1,py,U₀)，再求 xH。Hicks 替代效应和收入效应仍精确相加为 Δx，但有限变化时通常不同于 Slutsky 两段；价格变化趋近于零时，两种补偿的一阶差异消失。"], formula: "e(px,py,U₀)=U₀·px^α·py^(1−α)/[α^α(1−α)^(1−α)]；Hicks：Δx=(xH−x₀)+(x₁−xH)" },
    ],
    prediction: "仅把 B 的新价格 px1 提高：普通需求 x₁、Slutsky 补偿收入 mS 和 Hicks 补偿收入 mH 分别怎样变化？为什么两种“保持购买力”会给出不同中间组合？",
    example: "以下例子由实验默认参数直接计算，A/B 面板和表格采用同一个内核。先在表中寻找旧需求、新需求、两种补偿需求；分别用两段效应的和检查总效应。不要把效用数字之差解释成可跨人比较的福利金额。",
    exampleKeys: ["x0", "x1", "slutskyIncome", "hicksIncome", "slutskyX", "hicksX", "totalEffect", "slutskySubstitution", "slutskyIncomeEffect", "hicksSubstitution", "hicksIncomeEffect"],
    interpret: ["补偿需求是一个附加条件下的反事实；它不是未经补偿时实际观察到的需求。先读清收入条件，再解释每条线。", "Cobb–Douglas 的两种商品都是正常品。涨价时 x 的替代效应和收入效应同向；不能据此宣布所有偏好下都排除 Giffen 行为。", "有限效应的加总检验回答的是分解是否一致；它不能把模型内反事实变成现实因果证据。"],
    caveats: ["收入为零时只能选择原点。普通需求仍有意义，正效用的补偿问题和内点导数解释要单独处理；看结果中的边界说明。", "价格必须严格为正，α 必须严格处于 (0,1)。完全替代、互补及带离散商品的偏好不能直接沿用这组内点公式。", "两种有限分解的中间组合一般不同；“替代效应就是总需求变化”和“补偿必定等于原收入”都是误解。"],
  },
  MX02: {
    links: [{ id: "M04-B", label: "M04-B：成本与供给" }, { id: "M05-B", label: "M05-B：市场兼容与进入" }],
    objects: "同型企业的成本是 C(q)=F+cq+dq²/2，市场需求 Q=A−Bp（负需求截断为零）。F 是每家企业固定成本，c 是初始边际成本，d>0；A 是商品数量截距，B 是需求对价格的响应。短期 n 家企业已存在；长期固定成本可避免，企业决定是否进入。价格、总量和企业利润内生求出。",
    derivation: [
      { title: "1. 短期：固定成本不改变边际供给", paragraphs: ["既有企业的 F 短期不可避免，停产仍支付 F。生产时最优条件 p=c+dq；价格不超过 c 时产量为零。把 n 家供给加总，与市场需求相等，解出短期均衡。", "若 A/B≤c，则需求愿付价格不够覆盖任何正产量的边际成本，模型报告无正交易量，不能把代数公式算出的负产量当作均衡。"], formula: "q(p)=max{(p−c)/d,0}；正交易时 p(n)=(dA+nc)/(n+dB)，Q(n)=n·q(n)，π(n)=d·q(n)²/2−F" },
      { title: "2. 连续进入：零利润等于最低平均成本", paragraphs: ["长期企业可避免 F，因此需要覆盖全部成本。正产量下 AC=F/q+c+dq/2，令其导数 −F/q²+d/2 为零得到有效规模 q*。此时 p*=AC(q*)=MC(q*)，经济利润为零。", "需求在 p* 下决定总量 Q*，连续企业数 n*=Q*/q* 仅是可分进入的近似，可能不是整数。必须先检查需求是否足以支持这一价格；无正 Q* 就不能显示正进入数量。"], formula: "F>0：q*=√(2F/d)，p*=c+√(2dF)，Q*=max{A−Bp*,0}，n*=Q*/q*" },
      { title: "3. 整数进入：检查最后一家和下一家", paragraphs: ["实际企业按整家进入，不能把连续 n* 四舍五入就宣布达成自由进入。对每个候选整数 n，重新解价格和利润；现有企业不应愿意退出，增加第 n+1 家后潜在进入者不应有严格正利润。", "因为所有企业同型，比较 π(n) 与 π(n+1) 就能检查两侧的进入激励；恰好零利润允许并列边界。零家企业的情景要考察第一家进入后能否盈利，而不是为零家虚构成交价格。"], formula: "整数稳定条件：π(n)≥0 且 π(n+1)≤0；n=0 时检验 π(1)≤0（并列边界完整保留）" },
    ],
    prediction: "仅提高 B 的固定成本 F：短期价格、短期产量与利润哪些改变？长期有效规模、连续企业数和整数进入数量为什么可能呈现不同变化？",
    example: "默认例子把相同技术和需求下的三个对象放在一张表：既定 n 的短期均衡、可分进入的长期参照、整家进入的稳定候选。逐项比较短期利润、最后一家企业的利润与再加一家后的利润；这些数值均来自真实内核。",
    exampleKeys: ["shortRunPrice", "shortRunQ", "shortRunFirmQ", "shortRunProfit", "pLR", "qFirm", "QLR", "nLR", "integerN", "integerPrice", "integerQ", "incumbentProfit", "entrantProfit"],
    interpret: ["短期 F 不变动边际成本；固定成本提高可能使利润下降，而不是立即使每家企业的供给曲线向上移动。", "整数行业的正利润可能来自不可分进入；它不必意味着模型算错或存在垄断。需要检查下一家进入后的利润。", "企业数变化可能使市场价格与每家规模变化。不要把固定企业数的比较静态推论直接延伸到长期。"],
    caveats: ["F=0 时有效规模 q* 为零。活跃市场里的连续进入极限可逼近 p=c，但通常不存在有限家、每家正产量的零利润均衡；nLR 留空并解释这个退化情况。", "没有进入成本、容量限制、异质性、融资摩擦或进入时滞。这里求的是静态激励兼容条件，不模拟企业逐期进退。", "合成需求和技术只能说明模型机制。长期市场价格不是仅由成本决定：需求可能低到无法支持任何一家企业。"],
  },
  MX03: {
    links: [{ id: "M08-B", label: "M08-B：策略、规则与重复互动" }],
    objects: "上半组 r00…r11 与 c00…c11 是任意同时行动 2×2 博弈的两人收益，r 属于玩家 1，c 属于玩家 2；p、q 分别是两人选策略 0 的概率。下半组 R、S、T、P 与 δ 属于另一个无限重复囚徒困境：合作、被背叛、背叛、共同背叛的每期收益。两组参数独立，不把任意一次博弈自动当作囚徒困境。",
    derivation: [
      { title: "1. 混合策略：支持内行动要无差异", paragraphs: ["固定玩家 2 的概率 q，玩家 1 的两项行动各有一个线性期望收益。只有两项收益相等时，玩家 1 才可能在两项行动上都放正概率。同理，玩家 2 的无差异条件决定 p。", "求出候选概率后，仍要检查它在 [0,1] 内，以及没有放进支持的行动是否更好。纯策略、一个人混合和两人都混合都是支持检查的一部分；不能只解一个除法就声称找到了全部均衡。"], formula: "Δ₁(q)=q(r00−r10)+(1−q)(r01−r11)；Δ₂(p)=p(c00−c01)+(1−p)(c10−c11)" },
      { title: "2. 退化时保留完整概率集合", paragraphs: ["若 Δ₁(q) 恒为零，玩家 1 对所有 q 都无差异；无差异条件没有唯一解。若相关系数为零而常数不为零，则该支持根本不成立。对每一种非空支持检查等式与不等式，可得到点、线段或矩形均衡集合。", "结果表逐项列出概率范围。全部收益并列时，整个 [0,1]×[0,1] 都是均衡；用一个 (0.5,0.5) 代表它会隐藏真实的多值性。"], formula: "若两人的差值均非退化：q*=(r11−r01)/(r00−r01−r10+r11)，p*=(c11−c10)/(c00−c01−c10+c11)；还需完整支持检查" },
      { title: "3. 重复囚徒困境：比较今天诱惑与以后惩罚", paragraphs: ["另给 T>R>P>S、0≤δ<1 的对称每期收益。grim trigger 规则是持续合作，一旦观测到偏离就永远背叛。合作流的贴现价值是 R/(1−δ)；一次背叛后承受 P 的价值是 T+δP/(1−δ)。", "把合作价值不低于偏离价值这一条件移项，得到 δ≥(T−R)/(T−P)。惩罚阶段共同背叛本身是该阶段博弈的均衡，因而在这些条件下规则满足继续互动的激励要求。阈值不是信任的经验测量。"], formula: "V合作=R/(1−δ)；V偏离=T+δP/(1−δ)；grim trigger 可持续当且仅当 δ≥(T−R)/(T−P)" },
    ],
    prediction: "先将 B 的一次博弈改为正反面零和：没有纯策略均衡时，概率均衡是什么？再只提高 δ：为什么这会改变重复合作的激励，却不会改变上半组一次博弈的均衡集合？",
    example: "默认结果把两组问题分开输出：一次博弈的所有均衡概率范围，以及重复囚徒困境的合作价值、偏离价值和临界折现因子。再应用“正反面零和”与“全部并列”预设，检查点均衡和连续集合的差别。",
    exampleKeys: ["pureCount", "mixedCount", "mixedP", "mixedQ", "continuumCount", "threshold", "cooperationValue", "deviationValue", "sustainable"],
    interpret: ["“无纯策略均衡”不等于“无均衡”。混合概率是策略的随机化，不能仅凭它把现实人群中 50% 的选择解释成同一个对象。", "收益差曲线为零表示两项行动无差异；完整均衡还要求对方也最佳回应。零线交点本身不是所有支持的证明。", "δ 改变对未来的权重，阶段收益和一次博弈没有跟着改变。可持续合作只是给定规则下的激励结果，不保证所有均衡都合作。"],
    caveats: ["重复面板需要 T>R>P>S 与 0≤δ<1；条件不成立时应修正输入，不能继续显示旧合作结论。收益单位是教学收益，不自动等于金钱或可跨人比较的幸福。", "grim trigger 假定无限期或共同不知道确定终局、完全观测行动、无噪声且承诺执行规则。已知有限末期、误观测或退出选项可能破坏这一结论。", "任意 2×2 收益矩阵的混合均衡与特定重复囚徒困境是两个模型；实验将它们分组，避免把一种规则的阈值套在所有互动上。"],
  },
};

export interface ExtensionLabsPageProps {
  state: LearningState;
  save: (state: LearningState) => void;
  id?: ExtensionLabId;
  renderSnapshot?: (id: ExtensionLabId) => ReactNode;
}

export function ExtensionLabsPage({ state, save, id, renderSnapshot }: ExtensionLabsPageProps) {
  if (id && !EXTENSION_LAB_IDS.includes(id)) return <article className="extension-page"><h1>找不到这个进阶实验</h1><p>实验 {id} 尚未定义，当前没有可运行的页面。</p><a href="#/extensions">返回三个进阶实验</a></article>;
  const ids = id ? [id] : [...EXTENSION_LAB_IDS];
  return <article className="extension-page">
    <p className="eyebrow">进阶实验 · 用同一对象深入一步</p>
    <h1>补偿需求、长期进入与策略</h1>
    <p className="lead">从主线中的模型出发，先写预测，再改变一个条件，检查结果、退化情况和结论边界。</p>
    <nav className="extension-navigation" aria-label="进阶实验导航">
      {extensionLabDefinitions.map((lab) => <a key={lab.id} href={`#/extensions/${lab.id}`} aria-current={id === lab.id ? "page" : undefined}>{lab.id} · {lab.title}</a>)}
      {id && <a href="#/extensions">查看全部三个实验</a>}
    </nav>
    <p className="small">全部默认参数是 synthetic 教学情景。图、数字表、预设和快照采用同一纯函数内核；记录留在本机浏览器。</p>
    {ids.map((labId) => <ExtensionLab key={labId} id={labId} value={state.extensionLabStates[labId]} onChange={(next) => save({ ...state, extensionLabStates: { ...state.extensionLabStates, [labId]: next } })} renderSnapshot={renderSnapshot} />)}
  </article>;
}

function ParameterInput({ field, value, label, testId, onEdit }: {
  field: Field; value: number; label: string; testId: string; onEdit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState("");
  const descriptionId = useId();
  useEffect(() => { setDraft(String(value)); setError(""); }, [value]);
  return <label className="extension-parameter">
    {field.label} <span className="small">（{field.unit}）</span>
    <input type="number" aria-label={label} aria-describedby={descriptionId} aria-invalid={!!error} data-testid={testId} min={field.min} max={field.max} step={field.step} value={draft} onChange={(event) => {
      const raw = event.target.value, next = Number(raw), integer = field.key === "n";
      setDraft(raw);
      if (!raw.trim() || !Number.isFinite(next) || next < field.min || next > field.max || (integer && !Number.isInteger(next))) {
        setError(`请输入 ${field.min} 至 ${field.max} 的${integer ? "整数" : "有限数"}。此输入尚未应用。`);
        onEdit(null);
      } else { setError(""); onEdit(next); }
    }} />
    <span id={descriptionId} role={error ? "alert" : undefined} className={error ? "field-error" : "small"}>{error || `有效范围 ${field.min}–${field.max}${field.key === "n" ? "，企业按整家计数" : ""}`}</span>
  </label>;
}

function parameterGroups(id: ExtensionLabId, fields: Field[]) {
  if (id !== "MX03") return [{ title: "模型参数", fields }];
  return [
    { title: "一次博弈：两人各两项策略", fields: fields.filter((field) => /^[rc][01][01]$/.test(field.key)) },
    { title: "独立的重复囚徒困境", fields: fields.filter((field) => !/^[rc][01][01]$/.test(field.key)) },
  ];
}

function parameterError(id: ExtensionLabId, parameters: Parameters): string | null {
  for (const side of ["baseline", "scenario"] as const) {
    try { runExtensionLab(id, parameters[side]); }
    catch (error) { return `${sideName[side]}：${error instanceof Error ? error.message : "参数不满足模型有效域"}`; }
  }
  return null;
}

function ExtensionLab({ id, value, onChange, renderSnapshot }: {
  id: ExtensionLabId; value: LabState; onChange: (value: LabState) => void; renderSnapshot?: (id: ExtensionLabId) => ReactNode;
}) {
  const definition = extensionLabDefinitions.find((lab) => lab.id === id)!;
  const lesson = teaching[id];
  const [parameters, setParameters] = useState<Parameters>({ baseline: value.baseline, scenario: value.scenario });
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [prediction, setPrediction] = useState(value.prediction);
  const [notice, setNotice] = useState("");
  const [resetCount, setResetCount] = useState<Record<Side, number>>({ baseline: 0, scenario: 0 });
  const baselineKey = JSON.stringify(value.baseline), scenarioKey = JSON.stringify(value.scenario);
  useEffect(() => {
    const externalParameters = JSON.stringify(parameters.baseline) !== baselineKey || JSON.stringify(parameters.scenario) !== scenarioKey;
    setParameters({ baseline: value.baseline, scenario: value.scenario });
    if (externalParameters) {
      setInvalidFields({});
      setResetCount((current) => ({ baseline: current.baseline + 1, scenario: current.scenario + 1 }));
    }
  }, [id, baselineKey, scenarioKey]);
  useEffect(() => {
    if (value.revealed) {
      setParameters({ baseline: value.baseline, scenario: value.scenario });
      setInvalidFields({});
      setResetCount((current) => ({ baseline: current.baseline + 1, scenario: current.scenario + 1 }));
    }
  }, [value.revealed]);
  useEffect(() => { setPrediction(value.prediction); }, [id, value.prediction]);
  const domainError = parameterError(id, parameters);
  const invalid = Object.values(invalidFields).some(Boolean) || !!domainError;
  const savedPrediction = !!prediction.trim() && prediction === value.prediction;

  // Invalid drafts stay editable locally. Only kernel-valid parameters enter
  // persistent records, so a temporarily impossible cross-field edit is neither
  // silently reverted nor exported as a valid experiment.
  const updateParameters = (next: Parameters) => {
    setParameters(next);
    setNotice("");
    onChange(parameterError(id, next) ? { ...value, revealed: false } : { ...value, ...next, revealed: false });
  };
  const run = (skip = false) => {
    if (invalid || (!savedPrediction && !skip)) return;
    const error = parameterError(id, parameters);
    if (error) { setNotice(error); onChange({ ...value, revealed: false }); return; }
    onChange({ ...value, ...parameters, prediction: skip ? "" : prediction, revealed: true });
    if (skip) setPrediction("");
    setNotice(skip ? "已明确跳过本次预测。请比较 A/B 结果，再写下解释。" : "实验已运行。请用结果检验已保存的预测。");
  };
  return <section className="extension-lab lab" aria-labelledby={`${id}-title`} data-testid={`region${id}`}>
    <p className="eyebrow">{id} · {definition.modelId}</p>
    <h2 id={`${id}-title`}>{definition.title}</h2>
    <p className="lead">{definition.question}</p>
    <p className="extension-prerequisites">从主线返回：{lesson.links.map((link, index) => <span key={link.id}>{index > 0 && " · "}<a href={`#/lesson/${link.id}`}>{link.label}</a></span>)}</p>
    <h3>对象、变量与条件</h3><p>{lesson.objects}</p>
    <details className="extension-assumptions" open><summary>模型假设与有效域</summary><ul>{definition.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul></details>
    <div className="extension-derivation">
      {lesson.derivation.map((step) => <section key={step.title}><h3>{step.title}</h3>{step.paragraphs.map((text, index) => <p key={index}>{text}</p>)}<p className="extension-formula">{step.formula}</p></section>)}
    </div>
    <details className="extension-example"><summary>走一遍默认数值例子</summary><p>{lesson.example}</p><DefaultExample id={id} keys={lesson.exampleKeys} /></details>
    <h3>先做可检验的预测</h3><p>{lesson.prediction}</p>
    <div className="extension-panels">
      {(["baseline", "scenario"] as const).map((side) => <section className="extension-panel" key={side} aria-label={`${id} ${sideName[side]} ${side === "baseline" ? "基准" : "实验"}参数`}>
        <h3>{sideName[side]} · {side === "baseline" ? "保留基准" : "实验情景"}</h3>
        {parameterGroups(id, definition.fields).map((group) => <fieldset key={group.title}><legend>{group.title}</legend><div className="extension-controls">{group.fields.map((field) => <ParameterInput key={`${side}:${field.key}:${resetCount[side]}`} field={field} value={parameters[side][field.key]} label={`${id} ${sideName[side]} ${field.label}`} testId={`extension-${sideName[side]}-${field.key}`} onEdit={(next) => {
          setInvalidFields((current) => ({ ...current, [`${side}:${field.key}`]: next === null }));
          if (next === null) { setNotice(""); onChange({ ...value, revealed: false }); }
          else updateParameters({ ...parameters, [side]: { ...parameters[side], [field.key]: next } });
        }} />)}</div></fieldset>)}
      </section>)}
    </div>
    <p className="small">先仅改变 B 的一个条件。任何参数修改都会隐藏旧结果；请检查预测与当前参数是否一致，再重新运行。无效草稿尚未保存，其他有效学习记录仍保留。</p>
    {!!definition.presets?.length && <div className="extension-presets"><p className="small">将教学预设应用到 B，保留 A：</p><div className="actions">{definition.presets.map((preset) => <button type="button" className="secondary" key={preset.label} onClick={() => {
      setInvalidFields((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key.startsWith("baseline:"))));
      setResetCount((current) => ({ ...current, scenario: current.scenario + 1 }));
      updateParameters({ ...parameters, scenario: { ...parameters.scenario, ...preset.parameters } });
      setNotice(`已应用“${preset.label}”到 B，请重新运行。`);
    }}>{preset.label}</button>)}</div></div>}
    <label className="notes-label">运行前预测：哪些量改变，为什么？<textarea aria-label={`${id} 实验预测`} value={prediction} maxLength={10000} onChange={(event) => { setPrediction(event.target.value); setNotice(""); if (value.revealed) onChange({ ...value, revealed: false }); }} /></label>
    <div className="actions">
      <button type="button" className="secondary" disabled={!prediction.trim()} onClick={() => { onChange({ ...value, prediction, revealed: false }); setNotice("预测已保存。点击“运行实验”检验预测。"); }}>保存预测</button>
      <button type="button" disabled={invalid || !savedPrediction} onClick={() => run()}>运行实验</button>
      <button type="button" className="secondary" disabled={invalid} onClick={() => run(true)}>跳过预测并运行</button>
      <button type="button" className="secondary" onClick={() => {
        const defaults = extensionDefaults(id);
        setParameters({ baseline: { ...defaults }, scenario: { ...defaults } }); setInvalidFields({}); setPrediction("");
        setResetCount((current) => ({ baseline: current.baseline + 1, scenario: current.scenario + 1 }));
        onChange({ baseline: { ...defaults }, scenario: { ...defaults }, prediction: "", revealed: false, explanation: "" });
        setNotice("本实验已恢复默认参数，预测与解释已清空。实验历史、课程进度与笔记分别管理。");
      }}>重置实验</button>
    </div>
    {!savedPrediction && !value.revealed && <p className="small">保存预测后运行，或选择“跳过预测并运行”。仅输入文字尚未保存。</p>}
    {invalid && <p className="field-error extension-notice" role="alert">{domainError || "有输入不在有效范围内。"} 请修正全部标记的输入与参数间条件。旧结果已隐藏，无效草稿尚未写入学习记录。</p>}
    {notice && <p className="extension-notice" role="status">{notice}</p>}
    {value.revealed && !invalid && <ExtensionResults id={id} baseline={value.baseline} scenario={value.scenario} />}
    {renderSnapshot?.(id)}
    <h3>解释结果，并找一个失效条件</h3>
    <ul>{lesson.interpret.map((text, index) => <li key={index}>{text}</li>)}</ul>
    <details className="extension-boundaries" open><summary>反例、退化情况与常见误解</summary><ul>{lesson.caveats.map((text, index) => <li key={index}>{text}</li>)}</ul></details>
    <label className="notes-label">我的解释：对象、机制、条件，以及需要修正的预测<textarea aria-label={`${id} 实验解释`} maxLength={10000} value={value.explanation} onChange={(event) => onChange({ ...value, explanation: event.target.value })} /></label>
    <p className="small">解释在编辑时保存为本机纯文本。重置实验只重置当前实验；学习记录导出和课程清空由课程记录页分别管理。</p>
    <p className="small">理论阅读：<a href="#/references">MIC-MIT 消费者理论 / 企业理论 / 寡头与博弈，MIC-CORE 对应主线主题</a>。本页推导与教学情景为原创表达。</p>
  </section>;
}

function DefaultExample({ id, keys }: { id: ExtensionLabId; keys: string[] }) {
  const result = runExtensionLab(id, extensionDefaults(id));
  const rows = result.rows.filter((row) => keys.includes(row.key));
  return <table><caption>{id} 默认参数的内核结果；单位随指标列出。</caption><thead><tr><th scope="col">指标 / 单位</th><th scope="col">默认值</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key}><th scope="row">{row.label}<span className="extension-unit">{row.unit}</span></th><td>{display(row.value)}</td></tr>)}</tbody></table>;
}

function ResultTable({ baseline, scenario, title, filter = () => true }: { baseline: Result; scenario: Result; title: string; filter?: (row: Result["rows"][number]) => boolean }) {
  const rows = [...new Map([...baseline.rows, ...scenario.rows].filter(filter).map((row) => [row.key, row])).values()];
  return <table className="extension-result-table"><caption>{title}。数字显示保留四位小数；完整概率范围与不适用值保持原样。</caption><thead><tr><th scope="col">指标 / 单位</th><th scope="col">A 基准</th><th scope="col">B 实验</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key}><th scope="row">{row.label}<span className="extension-unit">{row.unit}</span></th><td data-testid={`extension-result-A-${row.key}`}>{display(baseline.rows.find((entry) => entry.key === row.key)?.value)}</td><td data-testid={`extension-result-B-${row.key}`}>{display(scenario.rows.find((entry) => entry.key === row.key)?.value)}</td></tr>)}</tbody></table>;
}

function ExtensionResults({ id, baseline, scenario }: { id: ExtensionLabId; baseline: ExtensionParameters; scenario: ExtensionParameters }) {
  try {
    const a = runExtensionLab(id, baseline), b = runExtensionLab(id, scenario);
    return <div className="extension-results" aria-live="polite" data-testid={`extension-results-${id}`}>
      <h3>运行结果：A 与 B 使用同一个计算内核</h3><p className="result">A：{a.status}<br />B：{b.status}</p>
      {id === "MX03" ? <>
        <h4>一次博弈：完整均衡集合</h4><ResultTable baseline={a} scenario={b} title="任意 2×2 同时行动博弈" filter={(row) => !["threshold", "cooperationValue", "deviationValue", "sustainable"].includes(row.key) && !row.key.startsWith("repeated")} />
        <h4>独立模型：无限重复囚徒困境</h4><ResultTable baseline={a} scenario={b} title="grim trigger 的激励条件" filter={(row) => ["threshold", "cooperationValue", "deviationValue", "sustainable"].includes(row.key) || row.key.startsWith("repeated")} />
      </> : <ResultTable baseline={a} scenario={b} title={id === "MX01" ? "两种有限价格分解及其加总检查" : "短期、连续长期与整数进入"} />}
      {graphSections(id, a, b).map((section) => <ComparisonPlot key={section.title} {...section} />)}
      <div className="extension-model-notes"><h4>内核给出的解释与边界</h4><p><strong>A 基准</strong></p><ul>{a.notes.map((note, index) => <li key={index}>{note}</li>)}</ul><p><strong>B 实验</strong></p><ul>{b.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></div>
    </div>;
  } catch (error) { return <p role="alert" className="field-error">参数无法计算：{error instanceof Error ? error.message : "模型有效域检查失败"}。结果未展示，请修正输入后重新运行。</p>; }
}

function graphSections(id: ExtensionLabId, baseline: Result, scenario: Result) {
  const sections = id === "MX02" ? [
    { title: "市场：需求、短期供给与长期参照", match: (curve: Curve) => curve.label.startsWith("市场："), xLabel: "总量 Q（商品单位）", yLabel: "价格 p（货币 / 商品）" },
    { title: "整数进入：最后一家与下一家", match: (curve: Curve) => curve.label.startsWith("利润："), xLabel: "行业企业数 n（家）", yLabel: "每家经济利润（货币）" },
  ] : id === "MX03" ? [
    { title: "一次博弈：两项行动的期望收益差", match: (curve: Curve) => curve.label.startsWith("最佳回应："), xLabel: "对手选择策略 0 的概率（玩家 1 读 q，玩家 2 读 p）", yLabel: "策略 0 收益 − 策略 1 收益（收益单位）" },
    { title: "重复囚徒困境：合作与一次偏离", match: (curve: Curve) => curve.label.startsWith("重复博弈："), xLabel: "折现因子 δ（0–0.99）", yLabel: "贴现收益价值（收益单位）" },
  ] : [{ title: "补偿选择：各预算边界", match: () => true, xLabel: baseline.xLabel, yLabel: baseline.yLabel }];
  return sections.map(({ match, ...section }) => ({ ...section, baseline: baseline.curves.filter(match), scenario: scenario.curves.filter(match) })).filter((section) => section.baseline.length + section.scenario.length > 0);
}

function ComparisonPlot({ title, baseline, scenario, xLabel, yLabel }: { title: string; baseline: Curve[]; scenario: Curve[]; xLabel: string; yLabel: string }) {
  const clipId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const palette = ["#1a7965", "#a25931", "#4366a1", "#864d7a", "#667523", "#467d88"];
  const labels = [...new Set([...baseline, ...scenario].map((curve) => curve.label))];
  const curves = ([{ side: "A 基准", values: baseline, dashed: true }, { side: "B 实验", values: scenario, dashed: false }]).flatMap((side) => side.values.map((curve) => ({ ...curve, side: side.side, dashed: side.dashed, color: palette[labels.indexOf(curve.label) % palette.length], points: curve.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) })));
  const points = curves.flatMap((curve) => curve.points);
  if (!points.length) return null;
  const xLow = Math.min(0, ...points.map((point) => point.x)), xHigh = Math.max(0, ...points.map((point) => point.x));
  const yLow = Math.min(0, ...points.map((point) => point.y)), yHigh = Math.max(0, ...points.map((point) => point.y));
  const xRange = xHigh - xLow || 1, yRange = yHigh - yLow || 1;
  const xMin = xLow < 0 ? xLow - xRange * .04 : 0, xMax = xHigh + xRange * .04;
  const yMin = yLow < 0 ? yLow - yRange * .06 : 0, yMax = yHigh + yRange * .06;
  const left = 67, top = 20, width = 467, height = 263;
  const sx = (x: number) => left + (x - xMin) / (xMax - xMin) * width;
  const sy = (y: number) => top + height - (y - yMin) / (yMax - yMin) * height;
  return <figure className="plot extension-plot"><h4>{title}</h4><p className="extension-axis-guide">横轴：{xLabel}。纵轴：{yLabel}。</p>
    <svg viewBox="0 0 560 325" role="img" aria-label={`${title}，A/B 共同尺度。下方提供所有曲线点的替代表格。`}><title>{title}：A 虚线 / 空心点，B 实线 / 实心点。</title><defs><clipPath id={clipId}><rect x={left} y={top} width={width} height={height} /></clipPath></defs>
      {[0, 1, 2, 3, 4].map((index) => { const x = xMin + index * (xMax - xMin) / 4, y = yMin + index * (yMax - yMin) / 4; return <g key={index}><line className="grid" x1={sx(x)} x2={sx(x)} y1={top} y2={top + height} /><line className="grid" x1={left} x2={left + width} y1={sy(y)} y2={sy(y)} /><text x={sx(x)} y={top + height + 21} textAnchor="middle">{format(x)}</text><text x={left - 8} y={sy(y) + 4} textAnchor="end">{format(y)}</text></g>; })}
      <line x1={left} x2={left + width} y1={sy(0)} y2={sy(0)} stroke="#52615b" /><line x1={sx(0)} x2={sx(0)} y1={top} y2={top + height} stroke="#52615b" />
      <g clipPath={`url(#${clipId})`}>{curves.map((curve, index) => <g key={index}>{curve.points.length > 1 ? <polyline fill="none" points={curve.points.map((point) => `${sx(point.x)},${sy(point.y)}`).join(" ")} stroke={curve.color} strokeWidth={curve.dashed ? 3.5 : 2} strokeDasharray={curve.dashed ? "7 5" : undefined} /> : curve.points.length === 1 ? <circle cx={sx(curve.points[0].x)} cy={sy(curve.points[0].y)} r={5} stroke={curve.color} strokeWidth={2} fill={curve.dashed ? "#fcfbf7" : curve.color} /> : null}</g>)}</g>
    </svg><figcaption>A/B 使用共同坐标尺度；重叠表示该关系没有改变。A 为虚线 / ○，B 为实线 / ●。<ul className="extension-legend">{curves.map((curve, index) => <li key={index}><svg viewBox="0 0 38 12" aria-hidden="true"><line x1="0" x2="38" y1="6" y2="6" stroke={curve.color} strokeWidth={3} strokeDasharray={curve.dashed ? "6 4" : undefined} /></svg><span>{curve.side} · {curve.label}</span></li>)}</ul></figcaption>
    <details className="extension-curve-data"><summary>展开曲线全部点的替代表格</summary><table><caption>{title}：表格与 SVG 采用同一批内核曲线点；显示四位小数。</caption><thead><tr><th scope="col">情景 / 关系</th><th scope="col">{xLabel}</th><th scope="col">{yLabel}</th></tr></thead><tbody>{curves.flatMap((curve, index) => curve.points.map((point, pointIndex) => <tr key={`${index}:${pointIndex}`}><th scope="row">{curve.side} · {curve.label}</th><td>{format(point.x)}</td><td>{format(point.y)}</td></tr>))}</tbody></table></details>
  </figure>;
}
