import type { LearningState } from "../persistence/store";
import { advancedLabDefinitions, advancedDefaults, runAdvancedLab, type AdvancedLabId, type AdvancedParameters } from "../models/advanced";
import { fmt } from "./Charts";

type PageProps = { state: LearningState; save: (state: LearningState) => void };
const reportSections = [
  { key: "object", title: "1 · 对象、问题与价值标准", prompt: "选择数字服务定价、共享资源规则、劳动配置或商品税负。谁决策？市场和时间边界是什么？资源、变量、单位、信息分别是什么？哪些句子是规范判断？" },
  { key: "baseline", title: "2 · 模型、参数与基准推导", prompt: "写出 modelId、全部参数及单位、可行域、外生和内生变量。逐步推导基准，记录实验 A 的结果，并说明为什么模型适合这个问题。" },
  { key: "counterfactuals", title: "3 · 两次反事实与分配", prompt: "分别改变两个条件，每次保留基准、预测、B 参数、运行结果和解释。谁获益、谁受损？财政转移、利润与资源福利如何对账？若无法判断分配，明确还缺哪些信息。" },
  { key: "boundaries", title: "4 · 一个反例与替代机制", prompt: "去掉一项关键假设，展示结论如何改变或模型为什么无法继续回答。比较一个替代机制，例如市场力量、信息、约束或外部性；不要把计算成功当作现实机制正确。" },
  { key: "evidence", title: "5 · 来源、证据与可反驳命题", prompt: "标明 synthetic 或来源、时期和单位。哪些结论只是模型内反事实？现实要观察什么？说明选择偏差和混杂如何排除，给出可能推翻机制的证据。未经核验的现实数字请留空并说明。" },
  { key: "reflection", title: "6 · 独立自评与仍不知道的事", prompt: "分别自评概念、推导、假设、可复现性、边界意识和表达，不合成总分。列出仍不确定的地方，以及下一步如何检验。课程不按政策立场给分。" },
] as const;

function downloadReport(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "microeconomics-capstone.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CapstonePage({ state, save }: PageProps) {
  const experiments = advancedLabDefinitions.filter((lab) => state.advancedLabStates[lab.id].revealed);
  const exportReport = () => {
    const text = ["微观经济学 · 可审查的机制分析", "数据性质：synthetic 教学情景；学习笔记仅由用户显式导出。",
      ...reportSections.map((section) => `${section.title}\n${state.capstone[section.key] || "（尚未填写）"}`),
      "附录 · 当前已运行实验快照（请在正文记录两次反事实；此附录只保留每个实验当前 A/B）",
      ...experiments.map((lab) => {
        const record = state.advancedLabStates[lab.id];
        return JSON.stringify({ modelId: lab.modelId, labId: lab.id, assumptions: lab.assumptions, ...record,
          baselineResults: runAdvancedLab(lab.id, record.baseline).metrics,
          scenarioResults: runAdvancedLab(lab.id, record.scenario).metrics }, null, 2);
      }),
    ].join("\n\n");
    downloadReport(text);
  };
  return <article>
    <div className="eyebrow">M12 · 重建、实验、证据</div>
    <h1>一个可审查的机制分析</h1>
    <p className="lead">将 24 节课程串成一份 2–4 页报告与一个可复现实验。两次反事实、一个反例，以及结论需要什么证据。</p>
    <p>先选一个虚构问题，或使用能够追溯来源的真实问题。实验结果来自模型假设，不是实际市场预测。作品保存在当前浏览器，导出含个人文字，请勿提交公开仓库。</p>
    <p><a href="#/lesson/M12-B">回看 M12-B 的分析方法</a> · <a href="#/review">跨模块复习</a> · <a href="#/records">备份全部学习记录</a></p>
    {reportSections.map((section) => <section className="panel" key={section.key}>
      <h2>{section.title}</h2>
      <p>{section.prompt}</p>
      <label>我的分析
        <textarea aria-label={section.title} value={state.capstone[section.key]} maxLength={20000} rows={7}
          onChange={(event) => save({ ...state, capstone: { ...state.capstone, [section.key]: event.target.value } })} />
      </label>
    </section>)}
    <section className="panel">
      <h2>可复现的实验附录</h2>
      <p>下面显示已经揭示结果的实验。报告导出包含当前 A/B 参数、预测、解释、假设和计算结果。再次修改实验会替换当前 B；请把两次反事实的参数分别写进报告正文。</p>
      {experiments.length === 0 ? <p>尚未运行后续实验。请选择对应课程，先预测、运行，再回到这里。</p> : experiments.map((lab) => <details key={lab.id}>
        <summary>{lab.id} · {lab.title} · 当前 A/B 参数</summary>
        <pre className="experiment-snapshot">{JSON.stringify({ baseline: state.advancedLabStates[lab.id].baseline, scenario: state.advancedLabStates[lab.id].scenario }, null, 2)}</pre>
        <p>{state.advancedLabStates[lab.id].explanation || "尚未填写实验解释。"}</p>
      </details>)}
      <p>实验入口：<a href="#/lesson/M04-B">成本与市场</a> · <a href="#/lesson/M06-B">税负与福利</a> · <a href="#/lesson/M07-A">定价</a> · <a href="#/lesson/M09-A">外部性</a> · <a href="#/lesson/M12-A">贸易</a></p>
      <button onClick={exportReport}>导出终课作品文本与实验快照</button>
      <p className="small">作品文本供阅读与审查；恢复全部学习状态请使用“本地记录”的 JSON 导出/导入。</p>
    </section>
    <section className="panel"><h2>独立评价维度</h2>
      <ul><li>概念清楚：对象、时点、单位和变量角色能复述。</li><li>推导正确：公式有条件，数量、预算或资源守恒。</li><li>假设透明：区分定义、行为假设、均衡与价值判断。</li><li>实验可复现：完整参数、预测、两个反事实和 A/B 结果可复算。</li><li>边界意识：反例、替代机制、证据缺口和分配问题明确。</li><li>表达清楚：他人无需猜测参数或立场即可审查。</li></ul>
    </section>
  </article>;
}

const reviewItems: { id: string; title: string; prompt: string; labId: AdvancedLabId; parameters: AdvancedParameters; answer: string; rubric: string[] }[] = [
  { id: "cost", title: "固定成本、停产与进入", prompt: "一家价格接受企业 F=50,c=3,d=2,p=11。计算产量和利润，比较停产；若 F 变成80，哪些结果变、哪些不变？为什么不能据此断言企业会长期进入？", labId: "ML04" as const, parameters: { F: 50, c: 3, d: 2, p: 11, n: 10, A: 100, B: 5 },
    answer: "边际收益11等于3+2q，q=4。利润44−50−12−16=−34，优于停产−50。F变成80后 q仍为4，利润−64；固定资源本期不可避免。长期是否进入须考察可避免成本、进入后的价格和机会成本，不能只沿用短期条件。", rubric: ["用边际条件推导4，而非凭平均成本决定产量。", "比较运营与停产利润，注明 F 不可避免。", "区分短期供给和长期进入。"] },
  { id: "tax", title: "税楔、剩余与外部性", prompt: "Pb=120−2q，Ps=30+q，单位税30。计算买卖方价格、税收和剩余。把税收重复加一次会错在哪里？若存在外部损害，这个无谓损失还能直接代表全部福利吗？", labId: "ML05" as const, parameters: { A: 120, B: 2, C: 30, D: 1, tau: 30 },
    answer: "无税q0=30，税后q=20、Pb=80、Ps=50，税收600。CS=400、PS=200，加税收的资源剩余1200；无税1350，DWL150。税收是转移，已对账后不能再加。外部性需额外计入未内部化损害，纠正税可能提高社会净收益。", rubric: ["联立税楔并对账600+400+200。", "说明财政收入是转移。", "把 ML05 无外部性前提与 ML08 社会成本区分。"] },
  { id: "game", title: "均衡、效率与制度", prompt: "协调博弈 AA=(4,4),AB=BA=(0,0),BB=(2,2)。查所有纯策略均衡。既然 AA 更好，为什么最佳回应条件仍容许 BB？什么证据才能判断现实会选择哪个？", labId: "ML07" as const, parameters: { r00: 4, c00: 4, r01: 0, c01: 0, r10: 0, c10: 0, r11: 2, c11: 2 },
    answer: "AA与BB都是纯策略Nash均衡：固定对方行动，单方面偏离均降低自身收益。AA Pareto支配BB，不能把双方一起变更的收益当成单方偏离收益。选择依赖初始信念、沟通、承诺、惯例及动态规则；静态矩阵没有唯一预测。", rubric: ["逐行逐列找最佳回应，列出两组均衡。", "区分 Pareto 改善与单方面偏离。", "指出均衡选择还需要信息或动态机制。"] },
  { id: "risk", title: "风险表示与跨期约束", prompt: "财富16和100各半，u=√w，计算 CE 与风险溢价。对比 y1=40,y2=160,r=.25,β=1 的跨期选择；禁止借款改变什么？为何不能把消费序数变换结论直接用于彩票？", labId: "ML10" as const, parameters: { wLow: 16, wHigh: 100, probHigh: .5, y1: 40, y2: 160, r: .25, beta: 1, noBorrow: 1, T: 24, wage: 10, nonLabor: 40, leisureWeight: .5 },
    answer: "期望财富58，EU=(4+10)/2=7，CE49，风险溢价9。现值财富168，自由借贷选择(84,105)，净借款44；禁止借款重新优化得到(40,160)。风险效用比较一般彩票只允许正仿射表示变换；跨期确定性预算与风险偏好不是同一问题。", rubric: ["先求期望效用再求CE，不把√Ew当EU。", "写出跨期预算并说明借款约束为何绑定。", "区分确定性序数表示与一般彩票的期望效用表示。"] },
];

export function ReviewPage({ state, save }: PageProps) {
  return <article>
    <div className="eyebrow">不同数字 · 新情境 · 独立自评</div>
    <h1>跨模块复习</h1>
    <p className="lead">用四个新情境连接成本、市场、政策、策略、风险与时间。先独立解释，再打开模型结果和参考。</p>
    <p>这些回答与逐课客观尝试分别保存，不产生掌握率。发现条件不清时，回到相应模型卡。</p>
    {reviewItems.map((item) => {
      const id = `M12-B-review-${item.id}`;
      const record = state.selfChecks[id];
      const result = runAdvancedLab(item.labId, { ...advancedDefaults(item.labId), ...item.parameters });
      const update = (answer: string, rating: "needs_review" | "partial" | "clear") => save({ ...state, selfChecks: { ...state.selfChecks, [id]: { answer, rating } } });
      return <section className="panel" key={id}>
        <h2>{item.title}</h2><p>{item.prompt}</p>
        <label>我的解释<textarea aria-label={`${item.title} 我的解释`} maxLength={10000} value={record?.answer || ""} onChange={(e) => update(e.target.value, record?.rating || "needs_review")} /></label>
        <details><summary>展开参考解释与模型数值</summary><p>{item.answer}</p><ul>{item.rubric.map((line) => <li key={line}>{line}</li>)}</ul>
          <div className="table-scroll"><table><caption>共享模型计算内核 · synthetic 情景</caption><thead><tr><th>变量</th><th>结果</th><th>单位</th></tr></thead><tbody>{result.rows.map((row, index) => <tr key={`${row.key}-${index}`}><th>{row.label}</th><td>{typeof row.value === "number" ? fmt(row.value) : row.value ?? "不适用"}</td><td>{row.unit}</td></tr>)}</tbody></table></div>
        </details>
        <label>对照后的自评<select aria-label={`${item.title} 自评`} value={record?.rating || "needs_review"} onChange={(e) => update(record?.answer || "", e.target.value as "needs_review" | "partial" | "clear")}><option value="needs_review">需要回看</option><option value="partial">部分说清，仍有疑问</option><option value="clear">能说清对象、机制与条件</option></select></label>
      </section>;
    })}
    <a className="button" href="#/capstone">将复习用于终课作品 →</a>
  </article>;
}
