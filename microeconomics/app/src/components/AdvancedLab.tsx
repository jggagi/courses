import { useEffect, useId, useState } from "react";
import {
  advancedDefaults,
  advancedLabDefinitions,
  runAdvancedLab,
  type AdvancedLabId,
  type AdvancedParameters,
} from "../models/advanced";
import { fmt } from "./Charts";
import "./advanced-lab.css";

export interface AdvancedLabState {
  baseline: AdvancedParameters;
  scenario: AdvancedParameters;
  prediction: string;
  revealed: boolean;
  explanation: string;
}

type Definition = (typeof advancedLabDefinitions)[number];
type Field = Definition["fields"][number];
type Result = ReturnType<typeof runAdvancedLab>;
type Curve = Result["curves"][number];
type Side = "baseline" | "scenario";
const sideName: Record<Side, string> = { baseline: "A", scenario: "B" };
const sectionNames = ["风险：期望效用与确定性等价", "跨期：收入、借贷与消费", "劳动：时间与消费选择"];
const riskKeys = new Set(["wLow", "wHigh", "probHigh"]);
const timeKeys = new Set(["y1", "y2", "r", "beta", "noBorrow"]);
const integerKeys = new Set(["n", "noBorrow", "legalPayer"]);

function parameterSections(id: AdvancedLabId, fields: Field[]) {
  if (id !== "ML10") return [{ title: "模型参数", fields }];
  return [
    { title: sectionNames[0], fields: fields.filter((f) => riskKeys.has(f.key)) },
    { title: sectionNames[1], fields: fields.filter((f) => timeKeys.has(f.key)) },
    { title: sectionNames[2], fields: fields.filter((f) => !riskKeys.has(f.key) && !timeKeys.has(f.key)) },
  ];
}

function ParameterInput({ field, label, testId, value, onEdit }: {
  field: Field;
  label: string;
  testId: string;
  value: number;
  onEdit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState("");
  const descriptionId = useId();
  useEffect(() => {
    setDraft(String(value));
    setError("");
  }, [value]);
  return (
    <label className="advanced-parameter">
      {field.label} <span className="small">（{field.unit}）</span>
      <input
        aria-label={label}
        data-testid={testId}
        aria-describedby={descriptionId}
        aria-invalid={!!error}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={draft}
        onChange={(event) => {
          const raw = event.target.value;
          const next = Number(raw);
          setDraft(raw);
          if (raw.trim() === "" || !Number.isFinite(next) || next < field.min || next > field.max ||
            (integerKeys.has(field.key) && !Number.isInteger(next))) {
            setError(`请输入 ${field.min} 至 ${field.max} 的${integerKeys.has(field.key) ? "整数" : "有限数"}；此输入尚未应用。`);
            onEdit(null);
            return;
          }
          setError("");
          onEdit(next);
        }}
      />
      <span id={descriptionId} className={error ? "field-error" : "small"} role={error ? "alert" : undefined}>
        {error || `有效范围 ${field.min}–${field.max}${field.key === "noBorrow" ? "；0 允许借贷，1 禁止借款" : ""}`}
      </span>
    </label>
  );
}

export function AdvancedLab({ id, value, onChange }: {
  id: AdvancedLabId;
  value: AdvancedLabState;
  onChange: (value: AdvancedLabState) => void;
}) {
  const definition = advancedLabDefinitions.find((lab) => lab.id === id);
  const [predictionDraft, setPredictionDraft] = useState(value.prediction);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");
  const [resetCount, setResetCount] = useState<Record<Side, number>>({ baseline: 0, scenario: 0 });
  useEffect(() => {
    setPredictionDraft(value.prediction);
  }, [id, value.prediction]);
  useEffect(() => {
    setInvalidFields({});
    setNotice("");
  }, [id]);
  if (!definition) return <p role="alert">找不到实验 {id} 的模型定义。</p>;
  const invalid = Object.values(invalidFields).some(Boolean);
  const savedPrediction = value.prediction.trim().length > 0 && predictionDraft === value.prediction;
  const editParameter = (side: Side, field: Field, next: number | null) => {
    setNotice("");
    setInvalidFields((current) => ({ ...current, [`${side}:${field.key}`]: next === null }));
    onChange({
      ...value,
      [side]: next === null ? value[side] : { ...value[side], [field.key]: next },
      revealed: false,
    });
  };
  const run = (skip = false) => {
    if (invalid || (!savedPrediction && !skip)) return;
    try {
      // Both panels use this same pure kernel, including cross-parameter domain checks.
      runAdvancedLab(id, value.baseline);
      runAdvancedLab(id, value.scenario);
      setNotice(skip ? "已明确跳过本次预测；现在请比较结果并解释机制。" : "实验已运行。请把预测与表中的 A/B 结果对照。");
      onChange({ ...value, prediction: skip ? "" : value.prediction, revealed: true });
    } catch (error) {
      setNotice(`参数无法计算：${error instanceof Error ? error.message : "模型有效域检查失败"}。请检查各参数范围及参数之间的条件后重试。`);
      onChange({ ...value, revealed: false });
    }
  };
  return (
    <section className="lab advanced-lab" aria-labelledby={`${id}-title`} data-testid={id}>
      <p className="eyebrow">{id} · {definition.modelId}</p>
      <h3 id={`${id}-title`}>{definition.title}</h3>
      <p className="lead">{definition.question}</p>
      <p className="small">synthetic 教学数据。货币、商品和时间均为抽象单位；下列结果是指定模型的反事实计算。</p>
      <details className="advanced-assumptions" open>
        <summary>模型假设与适用条件</summary>
        <ul>{definition.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul>
      </details>
      <div className="advanced-panels">
        {(["baseline", "scenario"] as const).map((side) => (
          <section className="advanced-panel" key={side} aria-label={`${sideName[side]} ${side === "baseline" ? "基准" : "实验"}参数`}>
            <h4>{sideName[side]} · {side === "baseline" ? "保留基准" : "实验情景"}</h4>
            {parameterSections(id, definition.fields).map((group) => (
              <fieldset key={group.title}>
                <legend>{group.title}</legend>
                <div className="advanced-controls">
                  {group.fields.map((field) => (
                    <ParameterInput
                      key={`${id}:${side}:${field.key}:${resetCount[side]}`}
                      field={field}
                      label={`${sideName[side]} ${field.label}`}
                      testId={`input-${sideName[side]}-${field.key}`}
                      value={value[side][field.key]}
                      onEdit={(next) => editParameter(side, field, next)}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
          </section>
        ))}
      </div>
      <p className="small">先仅改变 B 的一个参数观察机制，再尝试组合变化。改变任何参数都会隐藏旧结果，需要重新运行；A 仅在编辑 A 或重置实验时改变。</p>
      {id === "ML06" && <NetworkEffectsPanel onRecord={(observation) => onChange({ ...value, explanation: `${value.explanation}${value.explanation ? "\n\n" : ""}${observation}` })} />}
      {!!definition.presets?.length && (
        <div className="advanced-presets">
          <p className="small">将教学预设应用到 B（保留 A，随后重新预测或运行）：</p>
          <div className="actions">
            {definition.presets.map((preset) => <button type="button" className="secondary" key={preset.label} onClick={() => {
              setInvalidFields((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key.startsWith("baseline:"))));
              setResetCount((current) => ({ ...current, scenario: current.scenario + 1 }));
              setNotice(`已将“${preset.label}”应用到 B；请重新运行。`);
              onChange({ ...value, scenario: { ...value.scenario, ...preset.parameters }, revealed: false });
            }}>{preset.label}</button>)}
          </div>
        </div>
      )}
      <label className="notes-label">
        运行前的预测：哪个结果会变化，为什么？
        <textarea aria-label={`${id} 实验预测`} value={predictionDraft} maxLength={10000} onChange={(event) => {
          setPredictionDraft(event.target.value);
          setNotice("");
          if (value.revealed) onChange({ ...value, revealed: false });
        }} />
      </label>
      <div className="actions">
        <button type="button" className="secondary" disabled={!predictionDraft.trim()} onClick={() => {
          onChange({ ...value, prediction: predictionDraft, revealed: false });
          setNotice("预测已保存。点击“运行实验”检验预测。");
        }}>保存预测</button>
        <button type="button" disabled={invalid || !savedPrediction} onClick={() => run()}>运行实验</button>
        <button type="button" className="secondary" disabled={invalid} onClick={() => run(true)}>跳过预测并运行</button>
        <button type="button" className="secondary" onClick={() => {
          const defaults = advancedDefaults(id);
          setInvalidFields({});
          setPredictionDraft("");
          setResetCount((current) => ({ baseline: current.baseline + 1, scenario: current.scenario + 1 }));
          setNotice("已恢复本实验默认参数、预测与解释；课程进度和笔记分别保存。");
          onChange({ baseline: { ...defaults }, scenario: { ...defaults }, prediction: "", revealed: false, explanation: "" });
        }}>重置实验</button>
      </div>
      {!savedPrediction && !value.revealed && <p className="small">先保存一条预测，再单独运行；也可明确跳过预测。</p>}
      {invalid && <p role="alert" className="field-error">有输入未通过有效域检查，旧结果已隐藏。修正所有标记的参数后才能运行。</p>}
      {notice && <p role="status" className="advanced-notice">{notice}</p>}
      {value.revealed && !invalid && <AdvancedResults id={id} baseline={value.baseline} scenario={value.scenario} />}
      <label className="notes-label">
        实验解释：对象、机制、条件，以及预测需要怎样修正？
        <textarea aria-label={`${id} 实验解释`} maxLength={10000} value={value.explanation} onChange={(event) => onChange({ ...value, explanation: event.target.value })} />
      </label>
      <p className="small">预测需点击保存；实验解释在编辑时保存到本课程的本机记录。重置本实验不会删除其他实验、练习或课程笔记。</p>
    </section>
  );
}

function displayValue(value: number | string | null | undefined) {
  if (value === null) return "未定义 / 不适用";
  if (value === undefined) return "此情景无此项";
  return typeof value === "number" ? fmt(value) : value;
}

function NetworkEffectsPanel({ onRecord }: { onRecord: (observation: string) => void }) {
  const cases = [
    { id: "constant", label: "规模不变", explanation: "使用者数量和互通规则保持不变，不能仅因固定成本变化就说出现了网络效应。上方线性需求中的 a、b 仍是既定参数。" },
    { id: "compatible", label: "更多用户且兼容", explanation: "若新用户与已有用户可互通，一个用户可联系、交换或协作的对象增加，服务价值可能提高。这是需求侧的网络外溢；不是生产边际成本下降，也不证明平台必然只剩一家。" },
    { id: "separate", label: "更多用户但不可互通", explanation: "总用户数增加，但分属不兼容的网络。单个用户能接触的对象未必增加，价值变化取决于互通、用户分布和具体用途；不能把全市场总人数直接代入某个平台的价值。" },
  ];
  const [selected, setSelected] = useState(cases[0].id);
  const current = cases.find((item) => item.id === selected)!;
  return <section className="advanced-network-panel" aria-labelledby="network-effects-heading">
    <h4 id="network-effects-heading">独立概念实验：网络效应</h4>
    <label>
      改变用户规模与互通规则
      <select aria-label="网络效应情景" value={selected} onChange={(event) => setSelected(event.target.value)}>
        {cases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    <p role="status">{current.explanation}</p>
    <p className="small">这个概念面板讨论价值机制，不改变上方的线性定价计算，也未求解平台竞争或网络均衡。要量化它，必须另给用户互动、需求与兼容规则。</p>
    <button type="button" className="secondary" onClick={() => onRecord(`网络效应观察（${current.label}）：${current.explanation}`)}>将观察加入实验解释</button>
  </section>;
}

function ResultTable({ baseline, scenario, title, rowFilter = () => true }: {
  baseline: Result; scenario: Result; title: string;
  rowFilter?: (row: Result["rows"][number]) => boolean;
}) {
  const rows = [...new Map([...baseline.rows, ...scenario.rows].filter(rowFilter).map((row) => [row.key, row])).values()];
  return (
    <table className="advanced-result-table">
      <caption>{title}。单位随指标列出；未定义值保留其经济学边界。</caption>
      <thead><tr><th scope="col">指标 / 单位</th><th scope="col">A 基准</th><th scope="col">B 实验</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.key} data-testid={`metric-${row.key}`}>
        <th scope="row">{row.label}<span className="advanced-unit">{row.unit}</span></th>
        <td data-testid={`advanced-A-${row.key}`}>{displayValue(baseline.rows.find((r) => r.key === row.key)?.value)}</td>
        <td data-testid={`advanced-B-${row.key}`}>{displayValue(scenario.rows.find((r) => r.key === row.key)?.value)}</td>
      </tr>)}</tbody>
    </table>
  );
}

function PayoffTable({ result, name }: { result: Result; name: string }) {
  const cell = (row: number, column: number) => result.rows.find((entry) => entry.key === `cell${row}${column}`);
  return <table className="advanced-game-table">
    <caption>{name}：每格按（玩家 1 收益，玩家 2 收益）读取，最佳回应与 Nash 标记来自枚举计算。</caption>
    <thead><tr><th scope="col">玩家 1 ↓ / 玩家 2 →</th><th scope="col">策略 0</th><th scope="col">策略 1</th></tr></thead>
    <tbody>{[0, 1].map((row) => <tr key={row}><th scope="row">策略 {row}</th>{[0, 1].map((column) => <td key={column}>{displayValue(cell(row, column)?.value)}</td>)}</tr>)}</tbody>
  </table>;
}

function graphSections(id: AdvancedLabId, baseline: Result, scenario: Result) {
  const sections = id === "ML04" ? [
    { title: "企业：成本与产量", match: (curve: Curve) => curve.label.startsWith("企业："), xLabel: "单个企业产量 q（商品单位）", yLabel: "单位价格 / 成本（货币 / 商品）" },
    { title: "市场：供给与需求", match: (curve: Curve) => curve.label.startsWith("市场："), xLabel: "市场数量 Q（商品单位）", yLabel: "价格 p（货币 / 商品）" },
  ] : id === "ML10" ? [
    { title: sectionNames[0], match: (curve: Curve) => curve.label.startsWith("风险："), xLabel: "财富 w（货币单位）", yLabel: "效用标签 u(w)" },
    { title: sectionNames[1], match: (curve: Curve) => curve.label.startsWith("跨期："), xLabel: "本期消费 c₁（商品单位）", yLabel: "下期消费 c₂（商品单位）" },
    { title: sectionNames[2], match: (curve: Curve) => curve.label.startsWith("劳动："), xLabel: "闲暇（时间单位）", yLabel: "消费（商品单位）" },
  ] : id === "ML11" ? [
    { title: "经济体 A：生产边界与贸易后的消费边界", match: (curve: Curve) => curve.label.startsWith("A "), xLabel: baseline.xLabel, yLabel: baseline.yLabel },
    { title: "经济体 B：生产边界与贸易后的消费边界", match: (curve: Curve) => curve.label.startsWith("B "), xLabel: baseline.xLabel, yLabel: baseline.yLabel },
  ] : [{ title: "模型关系与 A/B 对照", match: () => true, xLabel: baseline.xLabel, yLabel: baseline.yLabel }];
  return sections.map((section) => ({ ...section, baseline: baseline.curves.filter(section.match), scenario: scenario.curves.filter(section.match) }))
    .filter((section) => section.baseline.length + section.scenario.length > 0);
}

function AdvancedResults({ id, baseline, scenario }: { id: AdvancedLabId; baseline: AdvancedParameters; scenario: AdvancedParameters }) {
  try {
    const a = runAdvancedLab(id, baseline), b = runAdvancedLab(id, scenario);
    return <div className="advanced-results" aria-live="polite" data-testid={`results-${id}`}>
      <p className="result">A：{a.status}<br />B：{b.status}</p>
      {id === "ML07" && <>
        <PayoffTable name="A 基准" result={a} />
        <PayoffTable name="B 实验" result={b} />
        <p className="small">最佳回应先固定对手策略，再比较自己的收益；Pareto 改善比较双方的结果，不等同于单方偏离。没有纯策略均衡并不表示不存在混合策略均衡。</p>
      </>}
      {id === "ML09" && <p>下表逐轮保留初始信念、报价和参与集合。报价更新来自规定的信念规则；认证交易另行计入认证费用。</p>}
      {id === "ML10" ? ["risk-", "time-", "labor-"].map((prefix, index) => <section className="advanced-output-section" key={prefix}>
        <h4>{sectionNames[index]}</h4>
        <ResultTable baseline={a} scenario={b} title={sectionNames[index]} rowFilter={(row) => row.key.startsWith(prefix)} />
      </section>) : <ResultTable baseline={a} scenario={b} title={id === "ML09" ? "信息、参与与逐轮信念更新" : "模型结果与边界"} rowFilter={(row) => id !== "ML07" || !row.key.startsWith("cell")} />}
      {graphSections(id, a, b).map((section) => <ComparisonPlot key={section.title} title={section.title} baseline={section.baseline} scenario={section.scenario} xLabel={section.xLabel} yLabel={section.yLabel} />)}
      {id === "ML11" && <p className="small">PPF 是生产可行边界，CPF 是给定交易价格、对方供给与有限交换下的消费边界。横轴增加 x，纵轴增加 y；边界扩大不自动证明所有人受益，偏好和内部收入分配仍需另行说明。</p>}
      <div className="advanced-model-notes">
        <h4>如何解释与限制结论</h4>
        <p><strong>A 基准：</strong></p><ul>{a.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
        <p><strong>B 实验：</strong></p><ul>{b.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
      </div>
    </div>;
  } catch (error) {
    return <p role="alert">参数无法计算：{error instanceof Error ? error.message : "模型域外输入"}。当前结果未展示，请修正参数后重新运行。</p>;
  }
}

function ComparisonPlot({ title, baseline, scenario, xLabel, yLabel }: {
  title: string; baseline: Curve[]; scenario: Curve[]; xLabel: string; yLabel: string;
}) {
  const clipId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const palette = ["#1a7965", "#a25931", "#4366a1", "#864d7a", "#667523", "#467d88"];
  const labels = [...new Set([...baseline, ...scenario].map((curve) => curve.label))];
  const curves = ([{ name: "A 基准", values: baseline, dashed: true }, { name: "B 实验", values: scenario, dashed: false }])
    .flatMap((side) => side.values.map((curve) => ({ ...curve, side: side.name, dashed: side.dashed, color: palette[labels.indexOf(curve.label) % palette.length], points: curve.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) })));
  const points = curves.flatMap((curve) => curve.points);
  if (!points.length) return null;
  // The union fixes the A/B scale and includes zero even for signed cost/profit curves.
  const xLow = Math.min(0, ...points.map((point) => point.x)), xHigh = Math.max(0, ...points.map((point) => point.x));
  const yLow = Math.min(0, ...points.map((point) => point.y)), yHigh = Math.max(0, ...points.map((point) => point.y));
  const xRange = xHigh - xLow || 1, yRange = yHigh - yLow || 1;
  const xMin = xLow < 0 ? xLow - xRange * .04 : 0, xMax = xHigh + xRange * .04;
  const yMin = yLow < 0 ? yLow - yRange * .06 : 0, yMax = yHigh + yRange * .06;
  const left = 65, top = 20, width = 470, height = 268;
  const sx = (x: number) => left + (x - xMin) / (xMax - xMin) * width;
  const sy = (y: number) => top + height - (y - yMin) / (yMax - yMin) * height;
  return <figure className="plot advanced-plot">
    <h4>{title}</h4>
    <p className="advanced-axis-guide">横轴：{xLabel}。纵轴：{yLabel}。</p>
    <svg viewBox="0 0 560 330" role="img" aria-label={`${title}，A/B 使用共同坐标尺度，曲线精确数据可展开下方表格`}>
      <title>{title}：A 虚线 / 空心点，B 实线 / 实心点；每个关系有独立图例。</title>
      <defs><clipPath id={clipId}><rect x={left} y={top} width={width} height={height} /></clipPath></defs>
      {[0, 1, 2, 3, 4].map((index) => {
        const x = xMin + index * (xMax - xMin) / 4, y = yMin + index * (yMax - yMin) / 4;
        return <g key={index}>
          <line className="grid" x1={sx(x)} x2={sx(x)} y1={top} y2={top + height} />
          <line className="grid" x1={left} x2={left + width} y1={sy(y)} y2={sy(y)} />
          <text x={sx(x)} y={top + height + 21} textAnchor="middle">{fmt(x)}</text>
          <text x={left - 8} y={sy(y) + 4} textAnchor="end">{fmt(y)}</text>
        </g>;
      })}
      <line x1={left} x2={left + width} y1={sy(0)} y2={sy(0)} stroke="#52615b" />
      <line x1={sx(0)} x2={sx(0)} y1={top} y2={top + height} stroke="#52615b" />
      <g clipPath={`url(#${clipId})`}>{curves.map((curve, index) => <g key={index}>
        {curve.points.length > 1 ? <polyline fill="none" points={curve.points.map((point) => `${sx(point.x)},${sy(point.y)}`).join(" ")} stroke={curve.color} strokeWidth={curve.dashed ? 3.5 : 2} strokeDasharray={curve.dashed ? "7 5" : undefined} /> : curve.points.length === 1 ? <circle cx={sx(curve.points[0].x)} cy={sy(curve.points[0].y)} r={5} stroke={curve.color} strokeWidth={2} fill={curve.dashed ? "#fcfbf7" : curve.color} /> : null}
      </g>)}</g>
    </svg>
    <figcaption>
      A/B 使用同一尺度；重叠表示该关系未改变。A 为虚线 / ○，B 为实线 / ●。
      <ul className="advanced-legend">{curves.map((curve, index) => <li key={index}>
        <svg viewBox="0 0 38 12" aria-hidden="true"><line x1="0" x2="38" y1="6" y2="6" stroke={curve.color} strokeWidth={3} strokeDasharray={curve.dashed ? "6 4" : undefined} /></svg>
        <span>{curve.side} · {curve.label}</span>
      </li>)}</ul>
    </figcaption>
    <details className="advanced-curve-data">
      <summary>展开曲线的精确替代表格</summary>
      <table><caption>{title}：所有绘制点均直接来自计算内核，数值显示保留三位小数。</caption>
        <thead><tr><th scope="col">情景 / 关系</th><th scope="col">{xLabel}</th><th scope="col">{yLabel}</th></tr></thead>
        <tbody>{curves.flatMap((curve, curveIndex) => curve.points.map((point, index) => <tr key={`${curveIndex}-${index}`}><th scope="row">{curve.side} · {curve.label}</th><td>{fmt(point.x)}</td><td>{fmt(point.y)}</td></tr>))}</tbody>
      </table>
    </details>
  </figure>;
}
