import { useState } from "react";
import type { LearningState } from "../persistence/store";
import { caseStudies, caseMethodologyLinks, caseEvidenceText, compareCaseDates, getCaseFigure, getCaseRawSnapshot, type CaseStudy } from "../content/cases";
import "./real-cases.css";

type PageProps = { state: LearningState; save: (state: LearningState) => void };
const format = (value: number | null) => value === null ? "缺失（未补值）" : Number(value.toFixed(3)).toString();
const colors = ["#1a7965", "#875933", "#506b88"];
const lineStyles = [undefined, "8 4", "2 5"];

function CaseFigure({ study }: { study: CaseStudy }) {
  const { table, firstDay, lastDay, yMin, yMax } = getCaseFigure(study);
  const left = 65, top = 38, width = 455, height = 218;
  const x = (date: string) => left + (Date.parse(`${date}T00:00:00Z`) - firstDay) / Math.max(lastDay - firstDay, 1) * width;
  const y = (value: number) => top + height - (value - yMin) / (yMax - yMin) * height;
  return <figure className="plot case-figure">
    <svg viewBox="0 0 560 315" role="img" aria-label={`${study.title}，历史观测图；精确数字见下方表格`}>
      <title>{study.title}。横轴是实际日期，纵轴是{study.series[0].unit}；这是历史观测，不是模拟。</title>
      {[0, 1, 2, 3, 4].map((i) => {
        const value = yMin + i * (yMax - yMin) / 4;
        return <g key={i}><line x1={left} x2={left + width} y1={y(value)} y2={y(value)} className="case-grid" /><text x={left - 8} y={y(value) + 4} textAnchor="end">{format(value)}</text></g>;
      })}
      <line x1={left} x2={left + width} y1={y(0)} y2={y(0)} stroke="#66776d" strokeDasharray="3 3" />
      <path d={`M${left},${top} V${top + height} H${left + width}`} fill="none" stroke="#66776d" />
      {study.series.map((series, index) => {
        // Each missing cell starts a new segment: the figure does not bridge or fill it.
        const paths: string[][] = [[]];
        table.forEach((row) => { const value = row.values[series.id]; if (value === null) paths.push([]); else paths[paths.length - 1].push(`${x(row.date)},${y(value)}`); });
        return <g key={series.id}>{paths.filter((p) => p.length > 1).map((points, i) => <polyline key={i} points={points.join(" ")} fill="none" stroke={colors[index]} strokeWidth="2.5" strokeDasharray={lineStyles[index]} />)}
          {table.map((row) => row.values[series.id] === null ? null : <circle key={row.date} cx={x(row.date)} cy={y(row.values[series.id]!)} r={index === 0 ? 3.5 : 4} fill={index === 1 ? "#fcfbf7" : colors[index]} stroke={colors[index]} strokeWidth="1.8" />)}
        </g>;
      })}
      {[table[0], table[2], table[table.length - 1]].map((row) => <text key={row.date} x={x(row.date)} y={top + height + 23} textAnchor="middle">{row.date.slice(5)}</text>)}
      <text x={left} y="19">{study.series[0].unit} · historical observed</text><text x={left + width} y="304" textAnchor="end">2020 年观测日期</text>
    </svg>
    <figcaption>历史观测；横轴按相隔天数排列。连线只辅助阅读，不补造其间观测。零参考线表示{study.series[0].unit === "%" ? "相对基期没有变化" : "零申请"}。</figcaption>
    <ul className="case-legend">{study.series.map((series, i) => <li key={series.id}><span aria-hidden="true" style={{ color: colors[i] }}>{["━━ ●", "┄┄ ○", "··· ●"][i]}</span> {series.label}</li>)}</ul>
  </figure>;
}

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const provenanceLabels = [
  ["provider", "提供者"], ["seriesId", "序列 ID"], ["observationPeriod", "观测时期"], ["frequency", "频率"],
  ["units", "单位"], ["nominalReal", "名义 / 实际"], ["seasonalAdjustment", "季节调整"], ["retrievedAtUTC", "获取时间 UTC"],
  ["vintageRevision", "版本与修订"], ["transformation", "转换方法"], ["licenseNote", "许可与署名"],
  ["snapshotSha256", "原始摘录 SHA-256"], ["upstreamSha256", "完整上游 CSV SHA-256"],
] as const;

export function RealCasesPage({ state, save }: PageProps) {
  const [caseId, setCaseId] = useState(caseStudies[0].id);
  const study = caseStudies.find((item) => item.id === caseId)!;
  const [startDate, setStartDate] = useState(study.observations[0].date);
  const [endDate, setEndDate] = useState(study.observations[study.observations.length - 1].date);
  const [notice, setNotice] = useState("");
  const figure = getCaseFigure(study);
  const comparison = compareCaseDates(study, startDate, endDate);
  const switchCase = (id: string) => {
    const selected = caseStudies.find((item) => item.id === id)!;
    setCaseId(id); setStartDate(selected.observations[0].date); setEndDate(selected.observations[selected.observations.length - 1].date); setNotice("");
  };
  const attachEvidence = () => {
    const evidence = caseEvidenceText(study, startDate, endDate);
    if (state.capstone.evidence.includes(evidence)) { setNotice("同一案例与日期比较的来源记录已经加入，保留原分析。"); return; }
    const joined = [state.capstone.evidence, evidence].filter(Boolean).join("\n\n");
    if (joined.length > 20000) { setNotice("终课证据文字已接近保存上限，请先整理原分析后再加入来源。"); return; }
    save({ ...state, capstone: { ...state.capstone, evidence: joined } });
    setNotice("来源、选定日期、数值与解释边界已加入终课作品第 5 部分，原有文字保留。");
  };
  return <article className="real-cases-page">
    <div className="eyebrow">历史观测 · 原始快照 · 可审查的证据</div>
    <h1>现实案例：从观测到机制</h1>
    <p className="lead">两个有来源的历史案例，用同一份本地快照生成图、表和日期比较。先明确测量对象，再提出可能被证据推翻的机制。</p>
    <p>这里是 <strong>observed 历史资料</strong>。课程实验使用 <strong>synthetic 合成参数</strong>；二者分别标明。快照包含固定日期与版本，应用不会请求实时 API 或自动更新资料。</p>
    <label>选择现实案例<select aria-label="选择现实案例" value={caseId} onChange={(event) => switchCase(event.target.value)}>{caseStudies.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <section className="panel">
      <div className="eyebrow">observed · 2020 年春季</div><h2>{study.title}</h2><p>{study.question}</p>
      <h3>先把对象说清楚</h3><p>{study.object}</p><p>{study.observed}</p>
      <CaseFigure study={study} />
      <div className="table-scroll" tabIndex={0} aria-label="历史观测数值表，可横向滚动"><table>
        <caption>固定来源快照 · {study.provenance.observationPeriod}</caption>
        <thead><tr><th>日期</th>{study.series.map((series) => <th key={series.id}>{series.label}（{series.unit}）</th>)}</tr></thead>
        <tbody>{figure.table.map((row) => <tr key={row.date}><th>{row.date}</th>{study.series.map((series) => <td key={series.id}>{format(row.values[series.id])}</td>)}</tr>)}</tbody>
      </table></div>
      <p className="small">显示最多三位小数，计算保留原始精度。{study.missingData}</p>
      <details><summary>查看转换前的原始值</summary><div className="table-scroll" tabIndex={0} aria-label="案例原始值表，可横向滚动"><table><caption>来源 CSV 原始数值；未另做季调或价格平减</caption>
        <thead><tr><th>日期</th>{study.series.map((series) => <th key={series.id}>{series.id}</th>)}</tr></thead><tbody>{study.observations.map((row) => <tr key={row.date}><th>{row.date}</th>{study.series.map((series) => <td key={series.id}>{row.values[series.id] ?? "缺失（未补值）"}</td>)}</tr>)}</tbody>
      </table></div></details>
    </section>
    <section className="panel">
      <h2>比较两个已观测日期</h2><p>改变选择只会比较已经保存的值，不会制造新的价格冲击或因果效果。</p>
      <div className="case-date-pickers"><label>起点日期<select aria-label="案例比较起点日期" value={startDate} onChange={(event) => setStartDate(event.target.value)}>{study.observations.map((row) => <option key={row.date}>{row.date}</option>)}</select></label>
        <label>终点日期<select aria-label="案例比较终点日期" value={endDate} onChange={(event) => setEndDate(event.target.value)}>{study.observations.map((row) => <option key={row.date}>{row.date}</option>)}</select></label></div>
      <div className="table-scroll" tabIndex={0} aria-label="日期比较表，可横向滚动"><table><caption>描述性差值 · {startDate} → {endDate}</caption><thead><tr><th>指标</th><th>起点</th><th>终点</th><th>差值</th></tr></thead>
        <tbody>{comparison.map((row) => <tr key={row.id}><th>{row.label}</th><td>{format(row.start)} {row.unit}</td><td>{format(row.end)} {row.unit}</td><td>{format(row.difference)} {row.differenceUnit}</td></tr>)}</tbody>
      </table></div>
      <h3>与模型怎么连接</h3><p>{study.modelConnection}</p><h3>这张图不能识别什么</h3><p>{study.identificationBoundary}</p>
    </section>
    {study.questions.map((question) => <section className="panel" key={question.title}><h2>{question.title}</h2><p>{question.prompt}</p>
      <details><summary>对照参考解释与自评标准</summary><p>{question.explanation}</p><ul>{question.rubric.map((line) => <li key={line}>{line}</li>)}</ul></details>
    </section>)}
    <section className="panel"><h2>我的案例分析</h2><p>用自己的话记录测量对象、机制假说、替代机制和识别条件。这里与 M12-B 共用本节笔记，切换案例时保留；写清案例名便于区分。</p>
      <label>M12-B 案例笔记<textarea aria-label="M12-B 案例笔记" rows={7} maxLength={20000} value={state.notes["M12-B"] ?? ""} onChange={(event) => save({ ...state, notes: { ...state.notes, "M12-B": event.target.value } })} /></label>
      <p><button onClick={attachEvidence}>将当前来源与日期比较加入终课作品</button></p><p role="status">{notice}</p><p><a href="#/capstone">编辑终课作品与证据判断 →</a> · <a href="#/lesson/M12-B">回看 M12-B 的识别方法</a></p>
    </section>
    <section className="panel"><div className="eyebrow">synthetic · 模型内反事实</div><h2>单独改变条件，练习机制</h2><p>{study.syntheticPractice.explanation}</p><a className="button" href={`#/lesson/${study.syntheticPractice.lessonId}`}>{study.syntheticPractice.label} →</a>
      <p className="small">在终课作品中，把模型计算与本页的观测分段说明；不得把合成模型结果写成实际政策效果。</p>
    </section>
    <section className="panel case-provenance"><h2>来源、时期和转换</h2><p><strong>{study.referenceId}</strong> · <a href={study.provenance.sourceUrl} target="_blank" rel="noreferrer">打开固定版本的来源 CSV</a> · <a href={study.provenance.originalProviderUrl} target="_blank" rel="noreferrer">原始提供者入口</a></p>
      <dl>{provenanceLabels.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{study.provenance[key]}</dd></div>)}</dl>
      <p><button className="secondary" onClick={() => download(study.provenance.rawSnapshotFile, getCaseRawSnapshot(study), "text/csv;charset=utf-8")}>导出原始 CSV 摘录</button> <button className="secondary" onClick={() => download(`${study.id}-provenance.json`, JSON.stringify(study.provenance, null, 2) + "\n", "application/json;charset=utf-8")}>导出来源说明</button></p>
      <p>OI Economic Tracker：<a href="https://tracktherecovery.org" target="_blank" rel="noreferrer">官方入口</a>。配套研究：Raj Chetty、John Friedman、Nathaniel Hendren、Michael Stepner 与 Opportunity Insights 团队，The Economic Impacts of COVID-19: Evidence from a New Public Database Built Using Private Sector Data，2020。</p>
      <ul>{caseMethodologyLinks.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{link.title}</a></li>)}</ul><p className="small">外链只在你点击时打开。获取日期是快照核验日期，不代表观测发生于今天。原始提供者入口作为查证路线，本页数字来自已固定、已核验的 OI 发布文件。</p>
    </section>
  </article>;
}

export default RealCasesPage;
