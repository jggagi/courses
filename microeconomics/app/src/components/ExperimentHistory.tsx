import { useEffect, useId, useRef, useState } from "react";
import type { HistoryLabId, LabId, LabParameters, LabSnapshot, LearningState } from "../persistence/store";
import { captureSnapshot, deleteSnapshot, restoreSnapshot } from "../persistence/learning-tools";
import { advancedLabDefinitions, runAdvancedLab, type AdvancedLabId, type AdvancedLabResult } from "../models/advanced";
import { extensionLabDefinitions, runExtensionLab, type ExtensionLabId } from "../models/extensions";
import { budgetGeometry, compareBundles, evaluateBundle, mrs, representedUtility, solveChoice, utility, type Preference } from "../models/economics";
import { fmt } from "./Charts";

export type { HistoryLabId };
type PageProps = { state: LearningState; save: (state: LearningState) => void };
const basicTitles: Record<LabId, string> = {
  ML01: "可行域工作台", ML02: "偏好与表示实验室", ML03: "从选择生成需求",
};
const lessonRoutes: Record<string, string> = {
  ML01: "M01-B", ML02: "M02-A", ML03: "M03-A", ML04: "M04-B", ML05: "M06-B",
  ML06: "M07-A", ML07: "M08-A", ML08: "M09-A", ML09: "M10-B", ML10: "M11-B", ML11: "M12-A",
};
const preferenceNames = { cd: "Cobb–Douglas", linear: "完全替代", complements: "完全互补（1:1）" };
const basicModels: Record<LabId, { modelId: string; assumptions: string[] }> = {
  ML01: { modelId: "two-good-linear-budget", assumptions: ["synthetic：两种可分割商品、正价格、非负预算；不存在额外采购或时间约束。", "预算集说明可行选择，不决定偏好；计价倍数只改变货币表示。"] },
  ML02: { modelId: "ordinal-two-good-preferences", assumptions: ["synthetic：确定性消费组合，偏好由 CD、完全替代或完全互补表示。", "平方变换仅在本实验非负效用域严格保序；效用标签不计量幸福。"] },
  ML03: { modelId: "two-good-constrained-choice", assumptions: ["synthetic：非负消费、正价格、非负预算；CD 权重在 (0,1) 内，线性权重为正。", "最优化保留角点、互补拐角、零预算和整段并列最优，不以相切条件替代全部求解。"] },
};
const isBasic = (id: HistoryLabId): id is LabId => id in basicTitles;
const isExtension = (id: HistoryLabId): id is ExtensionLabId => id.startsWith("MX");

export function historyLabTitle(id: HistoryLabId): string {
  if (isBasic(id)) return basicTitles[id];
  return (isExtension(id) ? extensionLabDefinitions : advancedLabDefinitions).find((lab) => lab.id === id)!.title;
}

/** Each saved experiment restores to a page that runs the exact same lab. */
export function historyLabRoute(id: HistoryLabId): string {
  return isExtension(id) ? `#/extensions/${id}` : `#/lesson/${lessonRoutes[id]}`;
}

type SnapshotResults = Pick<AdvancedLabResult, "status" | "rows" | "metrics" | "notes">;
const row = (key: string, label: string, value: number | string | null, unit: string) => ({ key, label, value, unit });
const orderLabel = { a_preferred: "组合 A 更受偏好", b_preferred: "组合 B 更受偏好", indifferent: "组合 A 与 B 无差别" };

/** A snapshot contains inputs, never a separate cache of authoritative answers.
 * Both the on-screen appendix and text export recompute with the lab kernels. */
export function snapshotResults(snapshot: LabSnapshot, side: "baseline" | "scenario"): SnapshotResults {
  if (isExtension(snapshot.labId)) return runExtensionLab(snapshot.labId, snapshot[side] as Record<string, number>);
  if (!isBasic(snapshot.labId)) return runAdvancedLab(snapshot.labId as AdvancedLabId, snapshot[side] as Record<string, number>);
  const p = snapshot[side] as LabParameters;
  const preference: Preference = { kind: p.kind, alpha: p.alpha, a: p.a, b: p.b };
  const representation = p.representation === "square" ? "u2" : "u";
  const first = { x: p.x, y: p.y };
  if (snapshot.labId === "ML02") {
    const second = { x: p.secondX, y: p.secondY };
    const firstMRS = mrs(preference, first), secondMRS = mrs(preference, second);
    const firstU = utility(preference, first), secondU = utility(preference, second);
    const firstLabel = representedUtility(preference, first, representation), secondLabel = representedUtility(preference, second, representation);
    return {
      status: orderLabel[compareBundles(preference, first, second, representation)],
      metrics: { firstU, secondU, firstRepresentedUtility: firstLabel, secondRepresentedUtility: secondLabel, firstMRS: firstMRS.value, secondMRS: secondMRS.value },
      rows: [row("order", "情景内组合 A/B 排序", orderLabel[compareBundles(preference, first, second, representation)], "排序"),
        row("firstU", "组合 A 的 u", firstU, "序数标签"), row("secondU", "组合 B 的 u", secondU, "序数标签"),
        row("firstLabel", "组合 A 的当前表示", firstLabel, "序数标签"), row("secondLabel", "组合 B 的当前表示", secondLabel, "序数标签"),
        row("firstMRS", "组合 A 的 MRS", firstMRS.defined ? firstMRS.value : `未定义 / 不适用：${firstMRS.reason}`, "y/x"),
        row("secondMRS", "组合 B 的 MRS", secondMRS.defined ? secondMRS.value : `未定义 / 不适用：${secondMRS.reason}`, "y/x")],
      notes: ["此处的组合 A/B 是同一情景内的两个组合；基准与反事实分别记录在两张结果表。", "不同效用标签之间的数值差距不是幸福差距，不能跨人比较。"],
    };
  }
  const geometry = budgetGeometry(p), bundle = evaluateBundle(p, first);
  const budgetRows = [row("xIntercept", "预算线 x 截距", geometry.xIntercept, "x"), row("yIntercept", "预算线 y 截距", geometry.yIntercept, "y"), row("slope", "预算线斜率", geometry.slope, "y/x"), row("spending", "手选组合支出", bundle.spending, "基础货币单位"), row("balance", "手选组合余额", bundle.balance, "基础货币单位"), row("feasible", "手选组合可行性", bundle.feasible ? "可行" : "不可行", "状态")];
  const metrics = { xIntercept: geometry.xIntercept, yIntercept: geometry.yIntercept, slope: geometry.slope, spending: bundle.spending, balance: bundle.balance };
  if (snapshot.labId === "ML01") return {
    status: bundle.feasible ? "手选组合可行" : "手选组合不可行",
    metrics: { ...metrics, representedSpending: bundle.spending * p.unitScale, representedBalance: bundle.balance * p.unitScale },
    rows: [...budgetRows, row("representedSpending", "手选支出（当前货币表示）", bundle.spending * p.unitScale, "当前货币单位"), row("representedBalance", "手选余额（当前货币表示）", bundle.balance * p.unitScale, "当前货币单位")],
    notes: ["预算为零时预算集退化为原点；计价倍数不改变截距和可行性。"],
  };
  const choice = solveChoice(p, preference, representation);
  return {
    status: choice.kind === "optimal_set" ? "整段预算边界并列最优" : { interior: "内点最优", corner: "角点最优", kink: "互补拐角最优", degenerate: "零预算退化解" }[choice.solutionType],
    metrics: { ...metrics, optimalX: choice.kind === "unique" ? choice.point.x : null, optimalY: choice.kind === "unique" ? choice.point.y : null, optimalUtility: choice.utility, optimalRepresentedUtility: choice.representedUtility, optimalSpending: choice.spending },
    rows: [...budgetRows,
      ...(choice.kind === "unique" ? [row("optimalX", "最优 x", choice.point.x, "x"), row("optimalY", "最优 y", choice.point.y, "y")] : [row("optimalSet", "全部最优组合", `端点 (${choice.endpoints[0].x}, ${choice.endpoints[0].y}) 与 (${choice.endpoints[1].x}, ${choice.endpoints[1].y}) 之间的整段预算边界`, "最优集合")]),
      row("optimalUtility", "最优 u", choice.utility, "序数标签"), row("optimalLabel", "最优的当前表示", choice.representedUtility, "序数标签"), row("optimalSpending", "最优支出", choice.spending, "基础货币单位")],
    notes: [choice.explanation, "反事实只有在预算、价格、偏好及可行域条件透明时才能解释；不作为现实需求预测。"],
  };
}

export function snapshotReport(snapshot: LabSnapshot) {
  const definition = isBasic(snapshot.labId) ? basicModels[snapshot.labId]
    : (isExtension(snapshot.labId) ? extensionLabDefinitions : advancedLabDefinitions).find((lab) => lab.id === snapshot.labId)!;
  return {
    snapshotId: snapshot.id, labId: snapshot.labId, label: snapshot.label, createdAt: snapshot.createdAt,
    modelVersion: snapshot.modelVersion, modelId: definition.modelId, dataNature: "synthetic", assumptions: definition.assumptions,
    baseline: snapshot.baseline, scenario: snapshot.scenario, prediction: snapshot.prediction, explanation: snapshot.explanation,
    baselineResults: snapshotResults(snapshot, "baseline"), scenarioResults: snapshotResults(snapshot, "scenario"),
  };
}

const basicParameterLabels: Record<keyof LabParameters, [string, string]> = {
  m: ["预算 m", "基础货币单位"], px: ["x 单价 px", "基础货币/x"], py: ["y 单价 py", "基础货币/y"],
  kind: ["偏好模型", "模型"], alpha: ["CD 权重 α", "权重"], a: ["线性 x 权重 a", "权重"], b: ["线性 y 权重 b", "权重"],
  x: ["手选 / 组合 A 的 x", "x"], y: ["手选 / 组合 A 的 y", "y"], secondX: ["组合 B 的 x", "x"], secondY: ["组合 B 的 y", "y"],
  representation: ["效用表示", "序数标签"], unitScale: ["货币计价倍数", "倍"],
};
const displayValue = (value: number | string | null | undefined) => typeof value === "number" ? fmt(value) : value ?? "未定义 / 不适用";
const displayParameter = (key: string, value: unknown) => key === "kind" ? preferenceNames[value as LabParameters["kind"]] : key === "representation" ? value === "square" ? "u²（非负域）" : "u" : typeof value === "number" ? fmt(value) : String(value);

/** Shared appendix used by history and the capstone. All personal text remains
 * ordinary React text; no snapshot content is interpreted as markup. */
export function SnapshotDetails({ snapshot }: { snapshot: LabSnapshot }) {
  const report = snapshotReport(snapshot);
  const fields = isBasic(snapshot.labId) ? Object.entries(basicParameterLabels).map(([key, [label, unit]]) => ({ key, label, unit }))
    : (isExtension(snapshot.labId) ? extensionLabDefinitions : advancedLabDefinitions).find((lab) => lab.id === snapshot.labId)!.fields;
  const a = snapshot.baseline as unknown as Record<string, number | string>, b = snapshot.scenario as unknown as Record<string, number | string>;
  return <details className="snapshot-details">
    <summary>A/B 参数、预测与可复现结果</summary>
    <p>{report.modelId} · 模型版本 {snapshot.modelVersion} · synthetic 教学情景。模型条件：{report.assumptions.join(" ")}</p>
    <div className="table-scroll"><table><caption>保存时的全部参数 · A 基准 / B 反事实</caption><thead><tr><th>参数</th><th>A 基准</th><th>B 反事实</th><th>单位</th></tr></thead><tbody>
      {fields.map((field) => <tr key={field.key}><th>{field.label}</th><td>{displayParameter(field.key, a[field.key])}</td><td>{displayParameter(field.key, b[field.key])}</td><td>{field.unit}</td></tr>)}
    </tbody></table></div>
    {isBasic(snapshot.labId) && <p className="small">完整参数也保留非活动字段：仅当前偏好模型使用对应权重；ML01 不根据偏好选择，ML02 比较组合而不求预算最优。</p>}
    <p><strong>保存的预测：</strong>{snapshot.prediction || "尚未填写预测。"}</p>
    <p style={{ whiteSpace: "pre-wrap" }}><strong>保存的解释：</strong>{snapshot.explanation || "尚未填写解释。"}</p>
    {(["baseline", "scenario"] as const).map((side) => {
      const result = side === "baseline" ? report.baselineResults : report.scenarioResults;
      return <section key={side}><h3>{side === "baseline" ? "A 基准" : "B 反事实"} · {result.status}</h3>
        <div className="table-scroll"><table><caption>{side === "baseline" ? "A 基准" : "B 反事实"} · 由同一实验内核重新计算</caption><thead><tr><th>变量</th><th>结果</th><th>单位</th></tr></thead><tbody>{result.rows.map((entry, index) => <tr key={`${entry.key}-${index}`}><th>{entry.label}</th><td>{displayValue(entry.value)}</td><td>{entry.unit}</td></tr>)}</tbody></table></div>
        <ul>{result.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
      </section>;
    })}
    <details><summary>查看精确原始参数（导出保持原精度）</summary><pre className="experiment-snapshot">{JSON.stringify({ baseline: snapshot.baseline, scenario: snapshot.scenario }, null, 2)}</pre></details>
  </details>;
}

export function LabHistoryPanel({ labId, state, save }: PageProps & { labId: HistoryLabId }) {
  const [label, setLabel] = useState("");
  const [explanation, setExplanation] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const record = isBasic(labId) ? state.labStates[labId] : isExtension(labId) ? state.extensionLabStates[labId] : state.advancedLabStates[labId as AdvancedLabId];
  const count = state.experimentHistory.filter((snapshot) => snapshot.labId === labId).length;
  const capture = () => {
    try {
      let next = captureSnapshot(state, labId, label, new Date().toISOString());
      if (isBasic(labId)) {
        const captured = next.experimentHistory.at(-1)!;
        next = { ...next, experimentHistory: next.experimentHistory.map((snapshot) => snapshot.id === captured.id ? { ...snapshot, explanation } : snapshot) };
      }
      save(next);
      setNotice(`已保存“${label.trim()}”。已有 ${count + 1} 份 ${labId} 快照，可用于终课作品。`);
      setError(""); setLabel(""); setExplanation("");
    } catch (err) { setError(err instanceof Error ? err.message : "快照未保存，请检查实验状态。"); setNotice(""); }
  };
  return <section className="panel no-print" aria-labelledby={`${id}-title`} data-testid={`history-panel-${labId}`}>
    <h3 id={`${id}-title`}>保留这次反事实</h3>
    <p>为当前 A/B 起一个名称，保存后再修改参数进行下一次实验。每次保存新增一份记录，不覆盖此前快照。</p>
    <label htmlFor={`${id}-label`}>快照名称<input id={`${id}-label`} aria-label="快照名称" value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} placeholder="例如：x 价格翻倍后的选择" /></label>
    {isBasic(labId) && <label htmlFor={`${id}-explanation`}>快照解释<textarea id={`${id}-explanation`} aria-label="快照解释" value={explanation} maxLength={20000} onChange={(event) => setExplanation(event.target.value)} placeholder="解释哪项条件改变、结果为何改变，以及一个失效边界。" /></label>}
    {!isBasic(labId) && <p className="small">快照同时保留实验中填写的预测和解释。</p>}
    <button onClick={capture} disabled={!record.revealed || !label.trim()}>保存实验快照</button>
    {!record.revealed && <p className="small">先保存预测或显式跳过并运行，揭示结果后才能保存快照。</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <p className="small">本实验 {count} 份 · 全课程 {state.experimentHistory.length}/40 份。快照仅保存在当前浏览器，满额时请自行选择删除或先 JSON 备份。<a href="#/history">查看实验历史与恢复</a></p>
  </section>;
}

type PendingAction = { kind: "restore" | "delete"; snapshot: LabSnapshot };
export function ExperimentHistoryPage({ state, save }: PageProps) {
  const [filter, setFilter] = useState<HistoryLabId | "all">("all");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (pending && !dialog.current?.open) dialog.current?.showModal();
  }, [pending]);
  const closeDialog = () => { dialog.current?.close(); setPending(null); };
  const confirmAction = () => {
    if (!pending) return;
    try {
      if (pending.kind === "restore") {
        save(restoreSnapshot(state, pending.snapshot.id));
        window.location.hash = historyLabRoute(pending.snapshot.labId);
      } else {
        save(deleteSnapshot(state, pending.snapshot.id));
        setNotice(`已删除“${pending.snapshot.label}”；其余实验快照保持不变。`);
      }
      setError(""); closeDialog();
    } catch (err) { setError(err instanceof Error ? err.message : "未执行，请检查快照。"); closeDialog(); }
  };
  const labs = [...new Set(state.experimentHistory.map((snapshot) => snapshot.labId))];
  const snapshots = [...state.experimentHistory].reverse().filter((snapshot) => filter === "all" || snapshot.labId === filter);
  return <article>
    <div className="eyebrow">多次 A/B · 本机保存 · 可审查的反事实</div><h1>实验历史</h1>
    <p className="lead">保留每次实验的参数、预测与解释，比较不同反事实，直接引用到终课作品。</p>
    <p>当前保存 {state.experimentHistory.length}/40 份快照。结果由保存的参数在同一模型内核中重新计算，默认数字均为 synthetic。保存和恢复仅涉及当前课程的浏览器记录。</p>
    <p><a href="#/capstone">在终课作品中引用快照</a> · <a href="#/records">JSON 备份与迁移全部记录</a></p>
    <label className="no-print">筛选实验<select aria-label="筛选实验" value={filter} onChange={(event) => setFilter(event.target.value as HistoryLabId | "all")}><option value="all">全部实验</option>{labs.map((id) => <option value={id} key={id}>{id} · {historyLabTitle(id)}</option>)}</select></label>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {snapshots.length === 0 ? <section className="panel"><h2>{state.experimentHistory.length ? "此筛选下没有快照" : "还没有保存实验快照"}</h2><p>进入实验，先预测并运行，再填写快照名称并点击“保存实验快照”。改变参数后可以再保存一次，先前记录会保留。</p><a href="#/lesson/M03-A">从选择实验开始</a></section> : snapshots.map((snapshot) => <section className="panel" key={snapshot.id} data-testid={`snapshot-${snapshot.id}`}>
      <h2>{snapshot.label}</h2><p className="small">{snapshot.labId} · {historyLabTitle(snapshot.labId)} · <time dateTime={snapshot.createdAt}>{new Date(snapshot.createdAt).toLocaleString()}</time></p>
      <SnapshotDetails snapshot={snapshot} />
      <div className="actions no-print"><button className="secondary" onClick={() => setPending({ kind: "restore", snapshot })}>恢复此快照</button><button className="secondary" onClick={() => setPending({ kind: "delete", snapshot })}>删除此快照</button><a href={historyLabRoute(snapshot.labId)}>打开对应实验</a></div>
    </section>)}
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={() => setPending(null)} className="snapshot-confirmation no-print">
      {pending && <><h2 id={titleId}>{pending.kind === "restore" ? "确认恢复实验" : "确认删除快照"}</h2><p>“{pending.snapshot.label}” · {pending.snapshot.labId}</p>
        <p>{pending.kind === "restore" ? "此操作把对应实验当前的 A/B 参数、预测及解释换成此快照，并打开该实验。已保存的其他快照、练习与笔记保留。" : "删除后无法在此浏览器中撤销；若该快照已被终课作品引用，相应引用也会移除。可以先取消并在“本地记录”导出 JSON 备份。"}</p>
        <div className="actions"><button className="secondary" autoFocus onClick={closeDialog}>取消</button><button onClick={confirmAction}>{pending.kind === "restore" ? "确认恢复" : "确认删除"}</button></div></>}
    </dialog>
  </article>;
}
