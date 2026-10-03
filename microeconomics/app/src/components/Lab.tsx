import { useEffect, useId, useState } from "react";
import type { LabId, LabState, LabParameters } from "../persistence/store";
import { defaultLabParameters } from "../persistence/store";
import {
  budgetGeometry,
  evaluateBundle,
  utility,
  representedUtility,
  compareBundles,
  mrs,
  solveChoice,
  demandSeries,
  type Preference,
} from "../models/economics";
import { BudgetPlot, PreferencePlot, DemandPlot, fmt } from "./Charts";

export function NumberField({
  label,
  value,
  min,
  max,
  step = "any",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step?: number | "any";
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState("");
  const errorId = useId();
  useEffect(() => {
    setDraft(String(value));
    setError("");
  }, [value]);
  return (
    <label className="number-field">
      {label}
      <input
        type="number"
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        value={draft}
        min={min}
        max={max}
        step={step}
        aria-invalid={!!error}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const n = Number(raw);
          if (
            raw === "" ||
            !Number.isFinite(n) ||
            n < min ||
            (max !== undefined && n > max)
          ) {
            setError(
              `请输入 ${min} 至 ${max ?? "任意有限非负数"}；未应用无效值。`,
            );
            return;
          }
          setError("");
          onChange(n);
        }}
      />
      {error && (
        <span id={errorId} role="alert" className="field-error">
          {error}
        </span>
      )}
    </label>
  );
}
export const pref = (p: LabParameters): Preference => ({
  kind: p.kind,
  alpha: p.alpha,
  a: p.a,
  b: p.b,
});
const representation = (p: LabParameters) =>
  p.representation === "square" ? ("u2" as const) : ("u" as const);
const preferenceNames = {
  cd: "Cobb–Douglas",
  linear: "完全替代",
  complements: "完全互补（1:1）",
};
const labNames = {
  ML01: "可行域工作台",
  ML02: "偏好与表示实验室",
  ML03: "从选择生成需求",
};
export function Lab({
  id,
  state,
  update,
}: {
  id: LabId;
  state: LabState;
  update: (s: LabState) => void;
}) {
  const p = state.scenario,
    a = state.baseline;
  const [notice, setNotice] = useState("");
  const set = (patch: Partial<LabParameters>) =>
    update({ ...state, scenario: { ...p, ...patch } });
  const preset = (key: "m" | "px") => {
    const limit = key === "m" ? 300 : 20;
    if (p[key] * 2 > limit) {
      setNotice(
        `不能应用：${key} 翻倍超出有效域上限 ${limit}，请先输入域内参数。`,
      );
      return;
    }
    setNotice("");
    set({ [key]: p[key] * 2 });
  };
  return (
    <section className="lab" aria-labelledby={`${id}-title`} data-testid={id}>
      <div className="eyebrow">{id} · synthetic 教学数据 · 本地实验</div>
      <h3 id={`${id}-title`}>{labNames[id]}</h3>
      <p>
        {id === "ML01"
          ? "先预测截距与形状，再改变约束。预算集回答能选什么，还没有替你决定最喜欢什么。"
          : id === "ML02"
            ? "先比较两组组合：更换表示会改变排序吗？更换偏好与更换表示是两个不同操作。"
            : "先手选一个组合，再预测价格变化后的选择。求解器同时生成图形、答案和需求表。"}
      </p>
      <label>
        实验预测与理由
        <textarea
          aria-label={`${id} 实验预测`}
          value={state.prediction}
          onChange={(e) => update({ ...state, prediction: e.target.value })}
          maxLength={10000}
          placeholder="我预测……因为……；还不确定的是……"
        />
      </label>
      {!state.revealed && (
        <div className="actions">
          <button
            disabled={!state.prediction.trim()}
            onClick={() => update({ ...state, revealed: true })}
          >
            保存预测并运行
          </button>
          <button
            className="secondary"
            onClick={() =>
              update({
                ...state,
                prediction: "（已显式跳过预测）",
                revealed: true,
              })
            }
          >
            跳过预测并运行
          </button>
        </div>
      )}
      {state.revealed && (
        <>
          <div className="baseline">
            <strong>基准情景 A</strong> ·{" "}
            {id === "ML02"
              ? `组合 (${fmt(a.x)}, ${fmt(a.y)}) 与 (${fmt(a.secondX)}, ${fmt(a.secondY)})`
              : `m=${fmt(a.m)}，px=${fmt(a.px)}，py=${fmt(a.py)}`}
            {id !== "ML01" && `，${preferenceNames[a.kind]}，α=${a.alpha}`}
            。基准保持不变，控件仅改变实验情景 B。
          </div>
          <fieldset>
            <legend>B 实验情景 · 数值输入均可键盘操作</legend>
            <div className="controls">
              {id !== "ML02" && (
                <>
                  <NumberField
                    label="预算 m（货币单位）"
                    value={p.m}
                    min={0}
                    max={id === "ML01" ? 300 : 200}
                    onChange={(m) => set({ m })}
                  />
                  <NumberField
                    label="x 单价 px（货币 / x）"
                    value={p.px}
                    min={1}
                    max={20}
                    onChange={(px) => set({ px })}
                  />
                  <NumberField
                    label="y 单价 py（货币 / y）"
                    value={p.py}
                    min={1}
                    max={20}
                    onChange={(py) => set({ py })}
                  />
                </>
              )}
              {id !== "ML01" && (
                <>
                  <label>
                    偏好模型
                    <select
                      aria-label="偏好模型"
                      value={p.kind}
                      onChange={(e) =>
                        set({ kind: e.target.value as LabParameters["kind"] })
                      }
                    >
                      {Object.entries(preferenceNames).map(([k, v]) => (
                        <option value={k} key={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  {p.kind === "cd" && (
                    <NumberField
                      label="偏好权重 α"
                      value={p.alpha}
                      min={0.1}
                      max={0.9}
                      step={0.1}
                      onChange={(alpha) => set({ alpha })}
                    />
                  )}
                  <label>
                    效用表示
                    <select
                      aria-label="效用表示"
                      value={p.representation}
                      onChange={(e) =>
                        set({
                          representation: e.target
                            .value as LabParameters["representation"],
                        })
                      }
                    >
                      <option value="u">u</option>
                      <option value="square">u²（非负域）</option>
                    </select>
                  </label>
                  {id === "ML02" && p.kind === "linear" && (
                    <>
                      <NumberField
                        label="x 权重 a"
                        value={p.a}
                        min={0.01}
                        max={20}
                        onChange={(a) => set({ a })}
                      />
                      <NumberField
                        label="y 权重 b"
                        value={p.b}
                        min={0.01}
                        max={20}
                        onChange={(b) => set({ b })}
                      />
                    </>
                  )}
                </>
              )}
              <NumberField
                label={id === "ML02" ? "组合 A 的 x" : "手选组合 x"}
                value={p.x}
                min={0}
                max={id === "ML02" ? 60 : 10000}
                onChange={(x) => set({ x })}
              />
              <NumberField
                label={id === "ML02" ? "组合 A 的 y" : "手选组合 y"}
                value={p.y}
                min={0}
                max={id === "ML02" ? 60 : 10000}
                onChange={(y) => set({ y })}
              />
              {id === "ML02" && (
                <>
                  <NumberField
                    label="组合 B 的 x"
                    value={p.secondX}
                    min={0}
                    max={60}
                    onChange={(secondX) => set({ secondX })}
                  />
                  <NumberField
                    label="组合 B 的 y"
                    value={p.secondY}
                    min={0}
                    max={60}
                    onChange={(secondY) => set({ secondY })}
                  />
                </>
              )}
              {id === "ML01" && (
                <NumberField
                  label="计价单位倍数（仅改变表示）"
                  value={p.unitScale}
                  min={0.01}
                  max={100}
                  onChange={(unitScale) => set({ unitScale })}
                />
              )}
            </div>
          </fieldset>
          {id === "ML01" && (
            <div className="actions">
              <button className="secondary" onClick={() => preset("m")}>
                收入变为 2 倍
              </button>
              <button className="secondary" onClick={() => preset("px")}>
                x 价格变为 2 倍
              </button>
              <button
                className="secondary"
                onClick={() => set({ unitScale: p.unitScale === 10 ? 1 : 10 })}
              >
                全部货币数值 ×10
              </button>
            </div>
          )}
          {notice && <p role="alert">{notice}</p>}
          <LabResults id={id} state={state} />
          <div className="actions">
            <button
              className="secondary"
              onClick={() => {
                const defaults = defaultLabParameters(id);
                setNotice("");
                update({
                  baseline: { ...defaults },
                  scenario: { ...defaults },
                  prediction: "",
                  revealed: false,
                });
              }}
            >
              重置实验
            </button>
          </div>
          <p className="small">
            重置仅恢复本实验默认参数与预测；练习、笔记和课程状态分别保存。
          </p>
        </>
      )}
    </section>
  );
}
function LabResults({ id, state }: { id: LabId; state: LabState }) {
  const p = state.scenario,
    a = state.baseline;
  try {
    if (id === "ML02") {
      const preference = pref(p),
        first = { x: p.x, y: p.y },
        second = { x: p.secondX, y: p.secondY };
      const order = compareBundles(
        preference,
        first,
        second,
        representation(p),
      );
      const baseOrder = compareBundles(
        pref(a),
        { x: a.x, y: a.y },
        { x: a.secondX, y: a.secondY },
        representation(a),
      );
      return (
        <div aria-live="polite">
          <p className="result" data-testid="ranking">
            B 偏好排序：
            {order === "indifferent"
              ? "组合 A 与 B 无差别"
              : order === "a_preferred"
                ? "组合 A 更受偏好"
                : "组合 B 更受偏好"}
          </p>
          <p>
            A 基准排序：
            {baseOrder === "indifferent"
              ? "组合 A 与 B 无差别"
              : baseOrder === "a_preferred"
                ? "组合 A 更受偏好"
                : "组合 B 更受偏好"}
            ；比较变化前请先检查组合与偏好是否保持不变。
          </p>
          <PreferencePlot
            preference={preference}
            first={first}
            second={second}
          />
          <p className="small">
            图中组合 A 的等值标签为 {p.representation === "square" ? "u²" : "u"}
            ={fmt(representedUtility(preference, first, representation(p)))}
            ，组合 B 为{" "}
            {fmt(representedUtility(preference, second, representation(p)))}
            。下表保留基准情景的数值与局部 MRS。
          </p>
          <table>
            <caption>效用标签与局部 MRS（MRS 的单位为 y / x）</caption>
            <thead>
              <tr>
                <th>组合</th>
                <th>u</th>
                <th>各情景当前表示</th>
                <th>MRS</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  params: a,
                  points: [
                    { x: a.x, y: a.y },
                    { x: a.secondX, y: a.secondY },
                  ],
                  name: "基准情景 A",
                },
                { params: p, points: [first, second], name: "实验情景 B" },
              ].flatMap(({ params, points, name }, group) =>
                points.map((point, i) => {
                  const preference = pref(params),
                    m = mrs(preference, point);
                  return (
                    <tr key={group + "-" + i}>
                      <th>
                        {name} · 组合 {i === 0 ? "A" : "B"} ({fmt(point.x)},{" "}
                        {fmt(point.y)})
                      </th>
                      <td>{fmt(utility(preference, point))}</td>
                      <td
                        data-testid={group === 1 ? `utility-${i}` : undefined}
                      >
                        {fmt(
                          representedUtility(
                            preference,
                            point,
                            representation(params),
                          ),
                        )}
                      </td>
                      <td>
                        {m.defined
                          ? fmt(m.value!)
                          : `未定义 / 不适用：${m.reason}`}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
          <p>
            平方在本模型的非负效用域保序，曲线集合与排序保持。改变 α 或 a/b
            会改变偏好；数值标签不计量幸福，也不能跨人比较。
          </p>
          {p.kind === "complements" && (
            <p>互补等值集合是精确折线；拐角没有唯一 MRS，仍然能比较组合。</p>
          )}
        </div>
      );
    }
    const geometryA = budgetGeometry(a),
      geometryB = budgetGeometry(p),
      bundle = evaluateBundle(p, { x: p.x, y: p.y });
    if (id === "ML01")
      return (
        <div aria-live="polite">
          <BudgetPlot baseline={a} scenario={p} point={{ x: p.x, y: p.y }} />
          <table>
            <caption>A/B 预算几何 · 截距为商品单位，斜率为 y / x</caption>
            <thead>
              <tr>
                <th>情景</th>
                <th>x 截距</th>
                <th>y 截距</th>
                <th>斜率</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>A 基准</th>
                <td>{fmt(geometryA.xIntercept)}</td>
                <td>{fmt(geometryA.yIntercept)}</td>
                <td>{fmt(geometryA.slope)}</td>
              </tr>
              <tr>
                <th>B 实验</th>
                <td data-testid="x-intercept">{fmt(geometryB.xIntercept)}</td>
                <td data-testid="y-intercept">{fmt(geometryB.yIntercept)}</td>
                <td>{fmt(geometryB.slope)}</td>
              </tr>
            </tbody>
          </table>
          <p data-testid="bundle-result">
            手选组合支出 {fmt(bundle.spending * p.unitScale)}、余额{" "}
            {fmt(bundle.balance * p.unitScale)}（当前货币单位）；
            {bundle.feasible ? "可行" : "不可行"}
            {bundle.boundary ? "，位于边界" : ""}。
          </p>
          <p>
            当前显示 m={fmt(p.m * p.unitScale)}，px={fmt(p.px * p.unitScale)}
            ，py={fmt(p.py * p.unitScale)}；计价倍数 {fmt(p.unitScale)}{" "}
            只改变货币表示，截距与可行性不变。m=0 时预算集退化为原点。
          </p>
          <p>
            收入改变约束；更喜欢 x
            改变偏好，不移动预算线。不可收回的已付款不能从付款后预算重复扣除。
          </p>
        </div>
      );
    const c = solveChoice(p, pref(p), representation(p)),
      ca = solveChoice(a, pref(a), representation(a));
    const resultText = (choice: typeof c) =>
      choice.kind === "unique"
        ? `(${fmt(choice.point.x)}, ${fmt(choice.point.y)})`
        : `最优集合：连接 (${fmt(choice.endpoints[0].x)}, ${fmt(choice.endpoints[0].y)}) 与 (${fmt(choice.endpoints[1].x)}, ${fmt(choice.endpoints[1].y)}) 的整个预算边界`;
    return (
      <div aria-live="polite">
        <p className="result" data-testid="choice-result">
          B 最优选择 {resultText(c)}
        </p>
        <p>
          A 最优选择 {resultText(ca)}。{c.explanation}
        </p>
        <BudgetPlot
          baseline={a}
          scenario={p}
          point={{ x: p.x, y: p.y }}
          preference={pref(p)}
          baselinePreference={pref(a)}
          choices
        />
        <p>
          橙点是手选组合，支出 {fmt(bundle.spending)}、余额{" "}
          {fmt(bundle.balance)}；{bundle.feasible ? "可行" : "不可行"}。
          {bundle.feasible
            ? utility(pref(p), { x: p.x, y: p.y }) < c.utility - 1e-8
              ? "该组合效用低于最优值：沿预算内调整商品搭配，可达到图上更优的等值集合。"
              : "该组合已达到最优效用。"
            : "先减少支出回到可行集，再比较偏好。"}
        </p>
        <table>
          <caption>最优结果与可行性 · 商品单位 / 货币单位 / 序数标签</caption>
          <thead>
            <tr>
              <th>情景</th>
              <th>选择</th>
              <th>支出</th>
              <th>u</th>
              <th>当前表示</th>
            </tr>
          </thead>
          <tbody>
            {[
              [ca, "A"],
              [c, "B"],
            ].map(([choice, label]) => {
              const v = choice as typeof c;
              return (
                <tr key={label as string}>
                  <th>{label as string}</th>
                  <td>{resultText(v)}</td>
                  <td>{fmt(v.spending)}</td>
                  <td>{fmt(v.utility)}</td>
                  <td>{fmt(v.representedUtility)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <DemandPlot
          baseline={a}
          scenario={p}
          baselinePreference={pref(a)}
          preference={pref(p)}
        />
        <details>
          <summary>展开需求图的精确替代表格</summary>
          <table>
            <caption>
              保持 m、py、偏好不变，逐一改变 px；线性并列显示数量区间
            </caption>
            <thead>
              <tr>
                <th>px（货币 / x）</th>
                <th>A 最优 x</th>
                <th>B 最优 x</th>
              </tr>
            </thead>
            <tbody>
              {demandSeries(
                p,
                pref(p),
                Array.from(
                  new Set([
                    ...demandSeries(
                      a,
                      pref(a),
                      Array.from({ length: 20 }, (_, i) => i + 1),
                    ).map((d) => d.price),
                    ...demandSeries(
                      p,
                      pref(p),
                      Array.from({ length: 20 }, (_, i) => i + 1),
                    ).map((d) => d.price),
                  ]),
                ).sort((x, y) => x - y),
              ).map((sample, i) => {
                const base = demandSeries(a, pref(a), [sample.price])[0];
                const range = (r: [number, number]) =>
                  r[0] === r[1] ? fmt(r[0]) : `[${fmt(r[0])}, ${fmt(r[1])}]`;
                return (
                  <tr key={i}>
                    <th>{fmt(sample.price)}</th>
                    <td>{range(base.xRange)}</td>
                    <td>{range(sample.xRange)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
        <p>
          只改变自身价格是在既定需求关系上移动；改变 m 或偏好改变整条关系。CD 中
          y
          恰好不变不表示购买力不变；总价格效应不能直接叫作纯替代效应。需求表来自模型假设，不是现实预测。
        </p>
      </div>
    );
  } catch (error) {
    return (
      <p role="alert">
        参数无法计算：{error instanceof Error ? error.message : "未知输入错误"}
        。请输入规定域内的有限数。
      </p>
    );
  }
}
