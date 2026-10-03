import { computeCapstone } from "../models/diagnosis";
import { useEffect, useState } from "react";
import type {
  CapstoneState,
  CapstoneParameters,
  ComparisonModel,
} from "../persistence/capstone";
import {
  REPORT_SECTIONS,
  CAPSTONE_RUBRIC,
  MODEL_OPTIONS,
  validateCapstone,
  initialCapstone,
} from "../persistence/capstone";
import { formatNumber } from "./AdvancedLabs";

const labels: Record<ComparisonModel, string> = {
  growth: "长期供给 / 资本与技术",
  demand: "短期需求 / 计划支出",
  supply: "成本与预期 / 滞后政策",
  finance: "金融约束 / 银行损失",
};
const parameterFields: [keyof CapstoneParameters, string, string][] = [
  ["priceFactor", "第1期价格倍数", "倍"],
  ["technologyFactor", "一次技术水平倍数", "倍"],
  ["spendingChange", "自主消费变化", "货币单位/期"],
  ["demandShock", "需求冲击", "缺口百分点"],
  ["supplyShock", "成本冲击", "通胀百分点"],
  ["creditLoss", "历史贷款损失", "货币单位"],
  ["sensitivityFactor", "敏感性强度倍数", "倍"],
];
export default function Capstone({
  value,
  onChange,
}: {
  value: CapstoneState;
  onChange: (state: CapstoneState) => void;
}) {
  const [draft, setDraft] = useState(
    Object.fromEntries(
      parameterFields.map(([key]) => [key, String(value.parameters[key])]),
    ),
  );
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(
      Object.fromEntries(
        parameterFields.map(([key]) => [key, String(value.parameters[key])]),
      ),
    );
    setError("");
  }, [value.parameters]);
  let base: ReturnType<typeof computeCapstone> | undefined,
    result: ReturnType<typeof computeCapstone> | undefined,
    sensitive: ReturnType<typeof computeCapstone> | undefined;
  let calculationError = "";
  try {
    base = computeCapstone({
      ...value.parameters,
      priceFactor: 1,
      technologyFactor: 1,
      spendingChange: 0,
      demandShock: 0,
      supplyShock: 0,
      creditLoss: 0,
    });
    result = computeCapstone(value.parameters);
    sensitive = computeCapstone(
      value.parameters,
      value.parameters.sensitivityFactor,
    );
  } catch (e) {
    calculationError = (e as Error).message;
  }
  const edit = (key: keyof CapstoneParameters, text: string) => {
    const next = { ...draft, [key]: text };
    setDraft(next);
    try {
      if (Object.values(next).some((v) => !v.trim()))
        throw new Error("情景参数不能留空。");
      const parameters = Object.fromEntries(
        Object.entries(next).map(([k, v]) => [k, Number(v)]),
      ) as CapstoneParameters;
      const state = { ...value, parameters };
      validateCapstone(state);
      computeCapstone(parameters);
      computeCapstone(parameters, parameters.sensitivityFactor);
      onChange(state);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const exportReport = () => {
    const text = [
      value.title,
      "教学合成情景 synthetic，非现实政策预测",
      `原始参数：${JSON.stringify(value.parameters)}`,
      "模型比较与敏感性：",
      ...value.models.map(
        (m) =>
          `${labels[m]}：${result?.results[m].metric}=${result?.results[m].value}，强度×${value.parameters.sensitivityFactor}时=${sensitive?.results[m].value}（${result?.results[m].unit}）。${result?.results[m].boundary}`,
      ),
      `名义—实际：第1期 N=${result?.prices.periods[1].N}，R=${result?.prices.periods[1].R}`,
      `银行A：${JSON.stringify(result?.finance.A)}`,
      "",
      ...REPORT_SECTIONS.flatMap((key) => [key, value.report[key], ""]),
      "不确定性清单",
      value.uncertainty,
      "",
      ...CAPSTONE_RUBRIC.map(
        (k) => `${value.rubric[k] ? "已自评" : "待自评"}：${k}`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "macroeconomics-private-capstone.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div data-testid="capstone-workspace">
      <p className="eyebrow">A12-B / 终课作品</p>
      <h1>宏观诊断工作台</h1>
      <p className="lead">
        先测量与对账，再比较机制、证据和政策代价。这里的结果全部由课程计算内核复算；模型之间是对照，不是已校准的完整金融宏观系统。
      </p>
      <p className="synthetic-label">
        教学合成数据 synthetic · 第0—10期 · 无现实国家与实时数据
      </p>
      <section className="panel">
        <h2>1 · 选题与合成情景</h2>
        <label>
          作品标题
          <input
            aria-label="作品标题"
            maxLength={500}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </label>
        <div className="parameter-grid">
          {parameterFields.map(([key, label, unit]) => (
            <label key={key}>
              {label}（{unit}）
              <input
                aria-label={`终课${label}`}
                type="number"
                step="any"
                value={draft[key] ?? ""}
                onChange={(e) => edit(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        {(error || calculationError) && (
          <p role="alert">
            {error || calculationError} 非法草稿未覆盖有效情景。
          </p>
        )}
        <p>
          敏感性将自主消费、需求、成本、损失冲击乘以强度；价格和技术倍数取该强度次方。银行金额舍入到分。其余条件固定，不能把这个操作当作概率或置信区间。
        </p>
      </section>
      {base && result && sensitive && (
        <>
          <section className="panel">
            <h2>2 · 名义—实际转换与账本</h2>
            <p>
              固定第0期价格，改变第1期价格、保留数量。时期为合成年度，不季调。
            </p>
            <div className="table-scroll" tabIndex={0}>
              <table data-testid="capstone-measurement">
                <caption>同一 p/q 源表的名义与固定价格实际产出</caption>
                <thead>
                  <tr>
                    <th>时期</th>
                    <th>名义 N</th>
                    <th>实际 R</th>
                    <th>平减指数 D</th>
                  </tr>
                </thead>
                <tbody>
                  {result.prices.periods.map((p, index) => (
                    <tr key={index}>
                      <th scope="row">{index}期</th>
                      <td>{formatNumber(p.N)}</td>
                      <td>{formatNumber(p.R)}</td>
                      <td>{formatNumber(p.D)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              银行账表来自发放10、跨行支付7、偿还3、历史债权减值
              {value.parameters.creditLoss}
              。借款人的合同债务与银行净债权分开，准备金发行方在边界之外。支付按当期使用/转移解释，不取得新的实物资产；因此付款与收款客户净值分别变化。
            </p>
            <div className="table-scroll" tabIndex={0}>
              <table data-testid="capstone-balance">
                <caption>合成资产负债表 · 资产=负债+权益</caption>
                <thead>
                  <tr>
                    <th>银行</th>
                    <th>准备金</th>
                    <th>净贷款</th>
                    <th>存款负债</th>
                    <th>权益</th>
                  </tr>
                </thead>
                <tbody>
                  {(["A", "B"] as const).map((bank) => (
                    <tr key={bank}>
                      <th scope="row">{bank}</th>
                      <td>{formatNumber(result!.finance[bank].reserves)}</td>
                      <td>{formatNumber(result!.finance[bank].loanAsset)}</td>
                      <td>
                        {formatNumber(result!.finance[bank].depositLiability)}
                      </td>
                      <td>{formatNumber(result!.finance[bank].equity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h2>3 · 至少两种机制与敏感性</h2>
            <div className="model-choices">
              {MODEL_OPTIONS.map((model) => (
                <label key={model}>
                  <input
                    type="checkbox"
                    checked={value.models.includes(model)}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        models: e.target.checked
                          ? [...value.models, model]
                          : value.models.filter((m) => m !== model),
                      })
                    }
                  />
                  {labels[model]}
                </label>
              ))}
            </div>
            {value.models.length < 2 && (
              <p role="alert">
                终课作品需要至少两个模型作比较；可以先记录想法，再补齐。
              </p>
            )}
            <div className="table-scroll" tabIndex={0}>
              <table data-testid="capstone-comparison">
                <caption>分别运行模型，不能直接相加不同单位的结果</caption>
                <thead>
                  <tr>
                    <th>模型与指标</th>
                    <th>无冲击基准</th>
                    <th>当前情景</th>
                    <th>强度×{value.parameters.sensitivityFactor}</th>
                    <th>单位</th>
                  </tr>
                </thead>
                <tbody>
                  {value.models.map((model) => (
                    <tr key={model}>
                      <th scope="row">
                        {labels[model]}：{result!.results[model].metric}
                      </th>
                      <td>{formatNumber(base!.results[model].value)}</td>
                      <td>{formatNumber(result!.results[model].value)}</td>
                      <td>{formatNumber(sensitive!.results[model].value)}</td>
                      <td>{result!.results[model].unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {value.models.map((model) => (
              <p key={model}>
                <strong>{labels[model]}</strong>：
                {result!.results[model].boundary}
              </p>
            ))}
            <p>
              需求与供给在同一个 LA06
              系统中可以联合改变；LA04、LA05与银行账本的比较仍是分别解释。要证明现实机制，需要能排除其他解释的证据。
            </p>
          </section>
        </>
      )}
      <section className="panel">
        <h2>4 · 写一份可复核的报告</h2>
        <p>
          有真实资料时请写 provider、series
          ID、网址、观测期、频率、单位、名义/实际、季调、检索日与发布版本；未核验的数据不要补造。默认作品只使用上述合成情景。
        </p>
        {REPORT_SECTIONS.map((key) => (
          <label key={key}>
            {key}
            <textarea
              aria-label={`终课报告 ${key}`}
              maxLength={20000}
              value={value.report[key]}
              onChange={(e) =>
                onChange({
                  ...value,
                  report: { ...value.report, [key]: e.target.value },
                })
              }
            />
          </label>
        ))}
        <label>
          不确定性清单
          <textarea
            aria-label="终课不确定性清单"
            maxLength={20000}
            value={value.uncertainty}
            onChange={(e) =>
              onChange({ ...value, uncertainty: e.target.value })
            }
          />
        </label>
      </section>
      <section className="panel">
        <h2>5 · 自评与重建</h2>
        {CAPSTONE_RUBRIC.map((key) => (
          <label className="check-label" key={key}>
            <input
              type="checkbox"
              checked={value.rubric[key]}
              onChange={(e) =>
                onChange({
                  ...value,
                  rubric: { ...value.rubric, [key]: e.target.checked },
                })
              }
            />
            {key}
          </label>
        ))}
        <p>
          {Object.values(value.rubric).filter(Boolean).length} /{" "}
          {CAPSTONE_RUBRIC.length}{" "}
          项由你自评；不自动生成掌握分数。每个勾选应能在报告中找到自己的证据。
        </p>
        <div className="button-row">
          <button
            disabled={!!error || !!calculationError || value.models.length < 2}
            onClick={exportReport}
          >
            导出作品文本
          </button>
          <button
            className="secondary"
            onClick={() => {
              if (
                confirm("只重置终课作品的情景、正文与自评？其他课程记录保留。")
              )
                onChange(initialCapstone());
            }}
          >
            重置终课作品
          </button>
          <a href="#/records">导出含全部原始参数的学习 JSON</a>
        </div>
        <p>导出含私人文字，请妥善保管；没有自动上传、LLM判卷或云同步。</p>
      </section>
      <a href="#/lesson/A12-B">回到 A12-B 的方法与来源</a>
    </div>
  );
}
