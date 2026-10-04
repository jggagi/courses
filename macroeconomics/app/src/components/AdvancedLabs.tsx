import { useEffect, useState } from "react";
import type { LearningState, LabState } from "../persistence";
import {
  advancedDefaults,
  advancedFields,
  calculateAdvanced,
  validateAdvancedInput,
  labBoundaries,
  type AdvancedLabId,
  type AdvancedInput,
  type CreditInput,
  type Field,
} from "../models/advanced";
import { simulateGrowth } from "../models/growth";
import { simulateSpending } from "../models/spending";
import { simulatePolicy } from "../models/policy";
import { replayCreditEvents, type CreditEvent } from "../models/credit";
import { simulateDebt } from "../models/debt";
import { calculateExternal } from "../models/external";
import { SeriesChart, TableReadingHelp, TableScroll } from "./Charts";
import { parameterGuidance } from "./parameterGuidance";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const creditEventNames: Record<CreditEvent["type"], string> = {
  loan: "发放贷款",
  payment: "跨行支付",
  repayment: "偿还本金",
  loss: "确认历史贷款损失",
};
const customerNames: Record<string, string> = {
  historicalDepositorA: "A银行原有存款人",
  historicalBorrowerA: "A银行历史借款人",
  historicalDepositorB: "B银行原有存款人",
  historicalBorrowerB: "B银行历史借款人",
  newBorrower: "A银行新增借款人",
  recipient: "B银行收款人",
};
export const formatNumber = (value: unknown, scale = 1) =>
  typeof value === "number" && Number.isFinite(value * scale)
    ? Number((value * scale).toFixed(8)).toString()
    : value === null
      ? "未定义"
      : String(value);
type Column = { key: string; label: string; unit?: string; scale?: number };
type Presentation = {
  columns: Column[];
  rows: Record<string, unknown>[];
  summary: { label: string; value: unknown; unit?: string; scale?: number }[];
  chart?: { key: string; label: string; unit: string };
  warnings: string[];
  extraCharts?: { key: string; label: string; unit: string }[];
};
const col = (
  key: string,
  label: string,
  unit?: string,
  scale?: number,
): Column => ({ key, label, unit, scale });
function present(id: AdvancedLabId, input: AdvancedInput): Presentation {
  const warnings: string[] = [];
  const result = calculateAdvanced(id, input);
  if (id === "LA04") {
    const r = result as ReturnType<typeof simulateGrowth>;
    return {
      columns: [
        col("period", "合成时期"),
        col("A", "生产率 A"),
        col("K", "总资本 K", "资本单位"),
        col("L", "劳动 L", "工人"),
        col("k", "每工人资本 k", "资本/工人"),
        col("y", "每工人产出 y", "产出/工人/期"),
        col("c", "每工人消费 c", "产出/工人/期"),
        col("kNext", "下一期 k", "资本/工人"),
      ],
      rows: r.periods.map((p) => ({ ...p })),
      summary: [
        { label: "稳态 k*", value: r.steadyState?.k ?? null },
        { label: "稳态 y*", value: r.steadyState?.y ?? null },
        { label: "稳态 c*", value: r.steadyState?.c ?? null },
      ],
      chart: { key: "k", label: "每工人资本过渡", unit: "资本/工人" },
      extraCharts: [
        { key: "y", label: "每工人产出路径", unit: "产出/工人/期" },
        { key: "c", label: "每工人消费路径", unit: "产出/工人/期" },
      ],
      warnings: r.steadyState ? [] : [r.steadyStateReason],
    };
  }
  if (id === "LA05") {
    const r = result as ReturnType<typeof simulateSpending>;
    return {
      columns: [
        col("period", "合成时期"),
        col("Y", "实现产出 Y", "货币单位/期"),
        col("C", "消费 C", "货币单位/期"),
        col("Z", "计划支出 Z", "货币单位/期"),
        col("unplannedInventory", "非计划存货 Y−Z", "货币单位/期"),
        col("actualInvestment", "实际投资", "货币单位/期"),
        col("nationalSaving", "国民储蓄", "货币单位/期"),
        col("YNext", "下一期产出", "货币单位/期"),
      ],
      rows: r.periods.map((p) => ({ ...p })),
      summary: [
        { label: "均衡产出 Y*", value: r.equilibrium.Y },
        { label: "均衡消费 C*", value: r.equilibrium.C },
        { label: "均衡私人储蓄", value: r.equilibrium.privateSaving },
        { label: "均衡政府储蓄", value: r.equilibrium.governmentSaving },
        { label: "均衡国民储蓄", value: r.equilibrium.nationalSaving },
        { label: "购买乘数", value: r.multiplier },
      ],
      chart: { key: "Y", label: "短期收入调整", unit: "货币单位/期" },
      warnings,
    };
  }
  if (id === "LA06") {
    const r = result as ReturnType<typeof simulatePolicy>;
    if (r.status === "unstable")
      warnings.push(r.unstableReason || "轨迹不稳定，不能当作收敛路径。");
    return {
      columns: [
        col("period", "合成时期"),
        col("x", "产出缺口 x", "百分点"),
        col("pi", "通胀 π", "百分数"),
        col("expectedPi", "预期通胀 πe", "百分数"),
        col("i", "操作利率 i", "百分数"),
        col("realRate", "当期事前实际利率 i−πe", "百分数"),
        col("demandShock", "需求冲击 d", "百分点"),
        col("supplyShock", "成本冲击 s", "百分点"),
      ],
      rows: r.periods.map((p) => ({ ...p })),
      summary: [
        {
          label: "第1期产出缺口",
          value: r.periods[1]?.x ?? null,
          unit: "百分点",
        },
        { label: "第1期通胀", value: r.periods[1]?.pi ?? null, unit: "百分数" },
        {
          label: "第1期预期通胀",
          value: r.periods[1]?.expectedPi ?? null,
          unit: "百分数",
        },
        {
          label: "第1期操作利率",
          value: r.periods[1]?.i ?? null,
          unit: "百分数",
        },
      ],
      chart: { key: "x", label: "滞后政策与产出缺口", unit: "百分点" },
      extraCharts: [
        { key: "pi", label: "通胀动态", unit: "百分数" },
        { key: "i", label: "操作利率动态", unit: "百分数" },
      ],
      warnings,
    };
  }
  if (id === "LA07") {
    const r = result as ReturnType<typeof replayCreditEvents>;
    for (const [key, bank] of [
      ["A", r.A],
      ["B", r.B],
    ] as const) {
      if (bank.equity < 0)
        warnings.push(`银行${key}权益为负：偿付能力风险，未自动注资。`);
      if (bank.reserves === 0)
        warnings.push(`银行${key}准备金耗尽：无融资机制时不能继续跨行支付。`);
    }
    return {
      columns: [
        col("bank", "银行"),
        col("reserves", "准备金", "货币单位"),
        col("loanAsset", "净贷款资产", "货币单位"),
        col("depositLiability", "存款负债", "货币单位"),
        col("equity", "权益", "货币单位"),
      ],
      rows: [
        { bank: "A", ...r.A },
        { bank: "B", ...r.B },
      ],
      summary: [
        {
          label: "系统存款",
          value: r.A.depositLiability + r.B.depositLiability,
        },
        { label: "系统净贷款", value: r.A.loanAsset + r.B.loanAsset },
      ],
      warnings,
    };
  }
  if (id === "LA08") {
    const r = result as ReturnType<typeof simulateDebt>;
    if (r.periods.some((p) => p.debt < 0))
      warnings.push(
        "债务额为负的时期按政府净金融资产解释，不能称为负的毛债务。",
      );
    return {
      columns: [
        col("period", "合成时期"),
        col("GDP", "名义 GDP", "货币单位"),
        col("debt", "债务额 / 净负债", "货币单位"),
        col("debtRatio", "债务率 b", "%", 100),
        col("interest", "利息支出", "货币单位/期"),
        col("primaryDeficit", "初级赤字", "货币单位/期"),
      ],
      rows: r.periods.map((p) => ({ ...p })),
      summary: [
        {
          label: "第1期债务率",
          value: r.periods[1]?.debtRatio ?? null,
          unit: "%",
          scale: 100,
        },
        { label: "第1期债务额", value: r.periods[1]?.debt ?? null },
        { label: "第1期名义 GDP", value: r.periods[1]?.GDP ?? null },
      ],
      chart: {
        key: "debtRatio",
        label: "债务率路径（小数表示）",
        unit: "债务/当期名义GDP",
      },
      warnings,
    };
  }
  const r = result as ReturnType<typeof calculateExternal>;
  return {
    columns: [
      col("metric", "对象"),
      col("value", "核算结果"),
      col("unit", "单位"),
    ],
    rows: [
      { metric: "净出口 NX", value: r.NX, unit: "货币单位/期" },
      { metric: "可支配国民收入 YD", value: r.YD, unit: "货币单位/期" },
      { metric: "国民储蓄 S", value: r.S, unit: "货币单位/期" },
      { metric: "经常账户 CA", value: r.CA, unit: "货币单位/期" },
      { metric: "S−I", value: r.CAFromSaving, unit: "货币单位/期" },
      { metric: "外部净资产变化", value: r.NFAChange, unit: "货币单位" },
      { metric: "期末外部净资产", value: r.closingNFA, unit: "货币单位" },
      { metric: "实际汇率 q", value: r.q, unit: "本币相对国外价格" },
      { metric: "q相对基准变化", value: r.qChange * 100, unit: "%" },
      {
        metric: "倒数约定 1/q",
        value: r.reciprocalQ,
        unit: "国外相对本币价格",
      },
    ],
    summary: [
      { label: "经常账户 CA", value: r.CA },
      { label: "外部净资产变化", value: r.NFAChange },
      { label: "实际汇率 q", value: r.q },
    ],
    warnings,
  };
}
function DataTable({
  id,
  view,
  label,
}: {
  id: string;
  view: Presentation;
  label: string;
}) {
  return (
    <TableScroll label={`${label}表格滚动区域`}>
      <table data-testid={`${id.toLowerCase()}-results`}>
        <caption>{label} · 原始参数复算；A/B单位与口径相同</caption>
        <thead>
          <tr>
            {view.columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
                {c.unit && <small>（{c.unit}）</small>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row, i) => (
            <tr key={i}>
              {view.columns.map((c, j) =>
                j === 0 ? (
                  <th scope="row" key={c.key}>
                    {formatNumber(row[c.key], c.scale)}
                    {c.key === "period" ? "期" : ""}
                  </th>
                ) : (
                  <td key={c.key}>{formatNumber(row[c.key], c.scale)}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
export default function AdvancedLabs({
  id,
  state,
  onChange,
}: {
  id: AdvancedLabId;
  state: LearningState["labStates"];
  onChange: (next: LearningState["labStates"]) => void;
}) {
  const value = state[id] as LabState<AdvancedInput>;
  const update = (next: LabState<AdvancedInput>) =>
    onChange({ ...state, [id]: next });
  const fields = id === "LA07" ? [] : advancedFields[id];
  const makeDraft = () =>
    Object.fromEntries(
      fields.map((f) => [
        f.key,
        String(
          (value.input as unknown as Record<string, number>)[f.key] *
            (f.scale || 1),
        ),
      ]),
    );
  const [draft, setDraft] = useState(makeDraft);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState(value.prediction);
  const [amount, setAmount] = useState("10");
  useEffect(() => {
    setDraft(makeDraft());
    setError("");
  }, [value.input, id]);
  useEffect(() => setPrediction(value.prediction), [value.prediction]);
  const canRun = !!value.prediction.trim() || value.skipped;
  const choose = (input: AdvancedInput) => {
    try {
      validateAdvancedInput(id, input);
      update({ ...value, input: clone(input), hasRun: false });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const edit = (field: Field, text: string) => {
    const next = { ...draft, [field.key]: text };
    setDraft(next);
    try {
      if (Object.values(next).some((v) => !v.trim()))
        throw new Error("请填写每个原始参数，不能用空值代替0。");
      const input = Object.fromEntries(
        fields.map((f) => [f.key, Number(next[f.key]) / (f.scale || 1)]),
      ) as unknown as AdvancedInput;
      if (id === "LA08" && (input as { growthRate: number }).growthRate <= -1)
        throw new Error("名义 GDP 增长必须高于−100%，否则下一期 GDP 不为正。");
      validateAdvancedInput(id, input);
      setError("");
      update({ ...value, input, hasRun: false });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const reset = () => {
    const input = advancedDefaults()[id];
    setError("");
    setDraft(
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          String(
            (input as unknown as Record<string, number>)[f.key] *
              (f.scale || 1),
          ),
        ]),
      ),
    );
    update({ ...value, input, baseline: clone(input), hasRun: false });
  };
  const run = () => {
    try {
      validateAdvancedInput(id, value.input);
      update({ ...value, hasRun: true });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const creditEvent = (
    type: CreditEvent["type"],
    eventAmount = Number(amount),
  ) => {
    if (!canRun) {
      setError("先保存预测，或明确跳过预测。");
      return;
    }
    const input = value.input as CreditInput;
    const events = [
      ...input.events,
      {
        id: `bank-${Date.now()}-${input.events.length + 1}`,
        sequence: (input.events.at(-1)?.sequence ?? 0) + 1,
        type,
        amount: eventAmount,
      },
    ];
    try {
      const next = { ...input, events };
      validateAdvancedInput("LA07", next);
      update({ ...value, input: next, hasRun: true });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const creditOracle = () => {
    if (!canRun) return;
    const initial = advancedDefaults().LA07.initial;
    const events: CreditEvent[] = (
      [
        ["loan", 10],
        ["payment", 7],
        ["repayment", 3],
        ["loss", 8],
      ] as const
    ).map(([type, amount], i) => ({
      id: `oracle-${i + 1}`,
      sequence: i + 1,
      type,
      amount,
    }));
    const input = { initial, events };
    validateAdvancedInput("LA07", input);
    update({ ...value, input, hasRun: true });
    setError("");
  };
  let a: Presentation | undefined, b: Presentation | undefined;
  try {
    if (value.hasRun) {
      a = present(id, value.baseline);
      b = present(id, value.input);
    }
  } catch (e) {
    if (!error) return <p role="alert">{(e as Error).message}</p>;
  }
  return (
    <div className="advanced-lab" data-testid={`${id.toLowerCase()}-lab`}>
      <p className="synthetic-label">
        教学合成数据 synthetic · 第0期起 · 无真实国家校准
      </p>
      <details open className="panel">
        <summary>模型对象、假设与边界</summary>
        {labBoundaries[id].map((t) => (
          <p key={t}>{t}</p>
        ))}
      </details>
      <details className="panel parameter-guidance">
        <summary>参数怎么改 · 建议试验与允许范围</summary>
        <h2>做一组可解释的 A/B 对照</h2>
        <p>{parameterGuidance[id].comparison}</p>
        <p>
          “设A为当前情景”会冻结当前有效参数。随后只改B，先一次改一个因素；
          组合冲击留到单项机制看清之后。预设按钮从默认参数构造B，
          若要保留自己改过的其他参数，请直接编辑对应格子。
        </p>
        <h3>建议从哪里开始</h3>
        <p>{parameterGuidance[id].suggested}</p>
        <h3>允许范围与联合约束</h3>
        <p>
          下列范围是模型约束，不是现实中的合理区间。所有输入须为有限数字；
          各项分别合法后，完整情景仍须满足账表、非负消费等联合约束。
          极端情景可能超出可推演范围，请结合错误或稳定性提示检查。
        </p>
        <dl className="parameter-range-list">
          {Object.entries(parameterGuidance[id].fields).map(([key, help]) => (
            <div key={key}>
              <dt>
                {fields.find((field) => field.key === key)?.label ?? "事件金额"}
              </dt>
              <dd>{help.allowed}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="parameter-unit-note">{parameterGuidance[id].unitNote}</p>
      <TableReadingHelp />
      <section className="panel">
        <h2>先预测，再运行</h2>
        <label>
          实验预测与理由
          <textarea
            aria-label="实验预测与理由"
            maxLength={10000}
            value={prediction}
            onChange={(e) => setPrediction(e.target.value)}
          />
        </label>
        <div className="button-row">
          <button
            disabled={!prediction.trim()}
            onClick={() =>
              update({ ...value, prediction, skipped: false, hasRun: false })
            }
          >
            保存实验预测
          </button>
          <button
            className="secondary"
            onClick={() =>
              update({ ...value, prediction: "", skipped: true, hasRun: false })
            }
          >
            跳过预测
          </button>
        </div>
        <p>
          {value.skipped
            ? "已明确跳过预测。"
            : value.prediction
              ? "预测已保存，可以运行。"
              : "尚未保存预测。"}
        </p>
      </section>
      {fields.length > 0 && (
        <section className="panel">
          <h2>原始参数 · 只改变 B 实验</h2>
          <fieldset className="parameter-fieldset">
            <legend>B实验 · 可编辑参数</legend>
            <div className="parameter-grid">
              {fields.map((f) => (
                <label key={f.key}>
                  {f.label}（{f.unit}）
                  <input
                    aria-label={f.label}
                    aria-describedby={`${id}-${f.key}-help`}
                    type="number"
                    step="any"
                    value={draft[f.key] ?? ""}
                    onChange={(e) => edit(f, e.target.value)}
                  />
                  <span className="parameter-help" id={`${id}-${f.key}-help`}>
                    {parameterGuidance[id].fields[f.key].meaning}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      )}
      <div className="button-row">
        {id === "LA04" && (
          <>
            <button
              className="secondary"
              onClick={() => choose({ ...advancedDefaults().LA04, s: 0.4 })}
            >
              提高储蓄率至40%
            </button>
            <button
              className="secondary"
              onClick={() =>
                choose({ ...advancedDefaults().LA04, technologyShock: 1.2 })
              }
            >
              一次生产率水平提升
            </button>
            <button
              className="secondary"
              onClick={() =>
                choose({ ...advancedDefaults().LA04, technologyGrowth: 0.02 })
              }
            >
              持续技术增长2%
            </button>
          </>
        )}
        {id === "LA05" && (
          <>
            <button
              className="secondary"
              onClick={() => choose({ ...advancedDefaults().LA05, G: 40 })}
            >
              政府购买增加10
            </button>
            <button
              className="secondary"
              onClick={() => choose({ ...advancedDefaults().LA05, C0: 10 })}
            >
              自主消费减少10
            </button>
          </>
        )}
        {id === "LA06" && (
          <>
            <button
              className="secondary"
              onClick={() =>
                choose({
                  ...advancedDefaults().LA06,
                  demandShock: 0,
                  supplyShock: 0,
                })
              }
            >
              无冲击基准
            </button>
            <button
              className="secondary"
              onClick={() =>
                choose({
                  ...advancedDefaults().LA06,
                  demandShock: 1,
                  supplyShock: 0,
                })
              }
            >
              需求冲击 +1
            </button>
            <button
              className="secondary"
              onClick={() =>
                choose({
                  ...advancedDefaults().LA06,
                  demandShock: 0,
                  supplyShock: 1,
                })
              }
            >
              成本冲击 +1
            </button>
          </>
        )}
        {id === "LA08" && (
          <>
            <button
              className="secondary"
              onClick={() =>
                choose({ ...advancedDefaults().LA08, growthRate: 0.06 })
              }
            >
              名义增长升至6%
            </button>
            <button
              className="secondary"
              onClick={() =>
                choose({
                  ...advancedDefaults().LA08,
                  primaryDeficitRatio: 0.04,
                })
              }
            >
              初级赤字升至4%
            </button>
          </>
        )}
        {id === "LA09" && (
          <>
            <button
              className="secondary"
              onClick={() =>
                choose({ ...advancedDefaults().LA09, exchangeRate: 7.7 })
              }
            >
              本币价格每外币7.7
            </button>
            <button
              className="secondary"
              onClick={() =>
                choose({
                  ...advancedDefaults().LA09,
                  consumption: 90,
                  imports: 50,
                })
              }
            >
              进口消费同时增加30
            </button>
          </>
        )}
      </div>
      {id === "LA07" && (
        <section className="panel">
          <h2>事件菜单 · 每一笔独立对账</h2>
          <label>
            事件金额（货币单位）
            <input
              aria-label="银行事件金额"
              aria-describedby="LA07-amount-help"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="parameter-help" id="LA07-amount-help">
              {parameterGuidance.LA07.fields.amount.meaning}
            </span>
          </label>
          <div className="button-row">
            {(
              [
                ["loan", "发放贷款"],
                ["payment", "跨行支付"],
                ["repayment", "偿还本金"],
                ["loss", "确认历史贷款损失"],
              ] as const
            ).map(([type, label]) => (
              <button
                key={type}
                disabled={!canRun}
                onClick={() => creditEvent(type)}
              >
                {label}
              </button>
            ))}
            <button disabled={!canRun} onClick={creditOracle}>
              运行10/7/3/8示例
            </button>
            <button
              className="secondary"
              disabled={!(value.input as CreditInput).events.length}
              onClick={() => {
                const input = value.input as CreditInput;
                update({
                  ...value,
                  input: { ...input, events: input.events.slice(0, -1) },
                  hasRun: true,
                });
                setError("");
              }}
            >
              撤销最后银行事件
            </button>
          </div>
          <ol>
            {(value.input as CreditInput).events.map((e) => (
              <li key={e.id}>
                第{e.sequence}笔 · {creditEventNames[e.type]} · {e.amount}
                货币单位
              </li>
            ))}
          </ol>
        </section>
      )}
      {error && (
        <div className="error" role="alert">
          <p>{error}</p>
          <p>非法草稿未覆盖有效记录与 A 基准；修正参数后再运行。</p>
        </div>
      )}
      <div className="button-row">
        <button disabled={!canRun || !!error} onClick={run}>
          运行实验
        </button>
        <button
          className="secondary"
          disabled={!!error}
          onClick={() => update({ ...value, baseline: clone(value.input) })}
        >
          设A为当前情景
        </button>
        <button className="secondary" onClick={reset}>
          重置实验
        </button>
      </div>
      <p className="muted">
        重置只恢复实验参数与A基准；预测、解释和课程笔记保留。A为冻结基准，B为当前实验。
      </p>
      {a && b && (
        <section className="panel" aria-label="实验结果">
          <h2>运行结果 · A/B 对照</h2>
          <TableScroll label="A/B指标对照表格滚动区域">
            <table data-testid={`${id.toLowerCase()}-summary`}>
              <caption>同口径指标（未定义不替换为0）</caption>
              <thead>
                <tr>
                  <th scope="col">指标</th>
                  <th scope="col">A基准</th>
                  <th scope="col">B实验</th>
                  <th scope="col">单位</th>
                </tr>
              </thead>
              <tbody>
                {b.summary.map((m, i) => (
                  <tr key={m.label}>
                    <th scope="row">{m.label}</th>
                    <td>{formatNumber(a!.summary[i]?.value, m.scale)}</td>
                    <td>{formatNumber(m.value, m.scale)}</td>
                    <td>{m.unit || "模型单位"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          {b.warnings.map((w) => (
            <p role="alert" key={w}>
              {w}
            </p>
          ))}
          {a.warnings.map((w) => (
            <p key={w}>A基准：{w}</p>
          ))}
          {b.chart && (
            <SeriesChart
              title={b.chart.label}
              unit={b.chart.unit}
              periods={Array.from(
                { length: Math.max(a.rows.length, b.rows.length) },
                (_, i) => String(i),
              )}
              series={[
                {
                  label: "A 基准",
                  style: "dashed",
                  values: Array.from(
                    { length: Math.max(a.rows.length, b.rows.length) },
                    (_, i) =>
                      typeof a!.rows[i]?.[b!.chart!.key] === "number"
                        ? (a!.rows[i][b!.chart!.key] as number)
                        : null,
                  ),
                },
                {
                  label: "B 实验",
                  style: "solid",
                  values: Array.from(
                    { length: Math.max(a.rows.length, b.rows.length) },
                    (_, i) =>
                      typeof b!.rows[i]?.[b!.chart!.key] === "number"
                        ? (b!.rows[i][b!.chart!.key] as number)
                        : null,
                  ),
                },
              ]}
            />
          )}
          {b.extraCharts?.map((chart) => (
            <SeriesChart
              key={chart.key}
              title={chart.label}
              unit={chart.unit}
              periods={Array.from(
                { length: Math.max(a!.rows.length, b!.rows.length) },
                (_, i) => String(i),
              )}
              series={[
                {
                  label: "A 基准",
                  style: "dashed",
                  values: Array.from(
                    { length: Math.max(a!.rows.length, b!.rows.length) },
                    (_, i) =>
                      typeof a!.rows[i]?.[chart.key] === "number"
                        ? (a!.rows[i][chart.key] as number)
                        : null,
                  ),
                },
                {
                  label: "B 实验",
                  style: "solid",
                  values: Array.from(
                    { length: Math.max(a!.rows.length, b!.rows.length) },
                    (_, i) =>
                      typeof b!.rows[i]?.[chart.key] === "number"
                        ? (b!.rows[i][chart.key] as number)
                        : null,
                  ),
                },
              ]}
            />
          ))}
          {a.rows.length !== b.rows.length && (
            <p>情景推演期数不同；缺失时期显示断点，不伪造A/B数值。</p>
          )}
          <DataTable id={id} view={b} label="B实验完整数字表" />
          <details>
            <summary>A基准完整数字表</summary>
            <DataTable id={`${id}-baseline`} view={a} label="A冻结基准" />
          </details>
          {id === "LA07" && (
            <CreditDetails input={value.input as CreditInput} />
          )}
        </section>
      )}
      {value.hasRun && (
        <section className="panel">
          <h2>运行后解释与反例</h2>
          <label>
            实验解释
            <textarea
              aria-label="实验解释"
              maxLength={10000}
              value={value.explanation}
              onChange={(e) =>
                update({ ...value, explanation: e.target.value })
              }
            />
          </label>
          <p>
            用自己的话说明对象、变化、机制、成立条件，以及哪种现实情况会使这个模型不足。解释由你自评，不自动判卷。
          </p>
        </section>
      )}
    </div>
  );
}
function CreditDetails({ input }: { input: CreditInput }) {
  const r = replayCreditEvents(input.initial, input.events);
  return (
    <>
      <TableScroll label="客户对手方表格滚动区域">
        <table>
          <caption>客户对手方 · 合同债务与银行净债权分开</caption>
          <thead>
            <tr>
              <th scope="col">客户</th>
              <th scope="col">银行</th>
              <th scope="col">存款</th>
              <th scope="col">合同贷款</th>
              <th scope="col">其他资产</th>
              <th scope="col">净值</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(r.customers).map(([id, c]) => (
              <tr key={id}>
                <th scope="row">{customerNames[id] ?? id}</th>
                <td>{c.bank}</td>
                <td>{c.deposit}</td>
                <td>{c.loan}</td>
                <td>{c.otherAssets}</td>
                <td>{c.netWorth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      {(["A", "B"] as const).map((bank) => (
        <TableScroll label={`银行${bank}分项表格滚动区域`} key={bank}>
          <table>
            <caption>银行{bank}分项 · 不隐藏历史客户余额</caption>
            <thead>
              <tr>
                <th scope="col">客户</th>
                <th scope="col">存款负债</th>
                <th scope="col">净贷款账面额</th>
                <th scope="col">损失准备</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(r[bank].deposits).map((customer) => (
                <tr key={customer}>
                  <th scope="row">{customerNames[customer] ?? customer}</th>
                  <td>{r[bank].deposits[customer] || 0}</td>
                  <td>{r[bank].loans[customer] || 0}</td>
                  <td>{r[bank].lossAllowances[customer] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ))}
    </>
  );
}
