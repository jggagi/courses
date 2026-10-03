import { computeCapstone, type CapstoneParameters } from "../models/diagnosis";
export type { CapstoneParameters } from "../models/diagnosis";
export const REPORT_SECTIONS = [
  "发生了什么",
  "如何测量",
  "核算约束",
  "机制比较",
  "支持与反对的证据",
  "政策作用及代价",
  "目前不知道",
] as const;
export const CAPSTONE_RUBRIC = [
  "区分定义、核算、行为与价值判断",
  "完成名义—实际转换和账表对账",
  "比较至少两个模型的机制与边界",
  "记录参数敏感性与可区分解释的证据",
  "注明合成数据、来源与观测时期",
  "明确不确定性并避免把反事实当预测",
] as const;
export const MODEL_OPTIONS = ["growth", "demand", "supply", "finance"] as const;
export type ComparisonModel = (typeof MODEL_OPTIONS)[number];
export interface CapstoneState {
  title: string;
  parameters: CapstoneParameters;
  models: ComparisonModel[];
  report: Record<(typeof REPORT_SECTIONS)[number], string>;
  uncertainty: string;
  rubric: Record<(typeof CAPSTONE_RUBRIC)[number], boolean>;
}
export function initialCapstone(): CapstoneState {
  return {
    title: "合成情景：成本、需求与金融约束的不同解释",
    parameters: {
      priceFactor: 1.1,
      technologyFactor: 1.2,
      spendingChange: -10,
      demandShock: -1,
      supplyShock: 1,
      creditLoss: 8,
      sensitivityFactor: 1.5,
    },
    models: ["growth", "demand", "supply", "finance"],
    report: Object.fromEntries(
      REPORT_SECTIONS.map((k) => [k, ""]),
    ) as CapstoneState["report"],
    uncertainty: "",
    rubric: Object.fromEntries(
      CAPSTONE_RUBRIC.map((k) => [k, false]),
    ) as CapstoneState["rubric"],
  };
}
function record(
  value: unknown,
  keys: string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}须为对象。`);
  const r = value as Record<string, unknown>;
  if (
    Object.keys(r).length !== keys.length ||
    Object.keys(r).some((k) => !keys.includes(k))
  )
    throw new Error(`${label}字段不完整或含未知字段。`);
  return r;
}
export function validateCapstone(value: unknown): CapstoneState {
  const r = record(
    value,
    ["title", "parameters", "models", "report", "uncertainty", "rubric"],
    "终课作品",
  );
  const text = (v: unknown) => {
    if (typeof v !== "string" || v.length > 20000)
      throw new Error("终课文字须为不超过20000字的纯文本。");
    return v;
  };
  const bounds: Record<keyof CapstoneParameters, [number, number]> = {
    priceFactor: [0.1, 5],
    technologyFactor: [0.1, 5],
    spendingChange: [-10, 100],
    demandShock: [-5, 5],
    supplyShock: [-5, 5],
    creditLoss: [0, 40],
    sensitivityFactor: [0.5, 2],
  };
  const p = record(r.parameters, Object.keys(bounds), "终课情景参数");
  for (const [key, [low, high]] of Object.entries(bounds)) {
    const n = p[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < low || n > high)
      throw new Error(`终课参数${key}须在${low}至${high}之间。`);
  }
  const fields = record(r.report, [...REPORT_SECTIONS], "报告章节");
  Object.values(fields).forEach(text);
  const rubric = record(r.rubric, [...CAPSTONE_RUBRIC], "终课自评");
  if (Object.values(rubric).some((v) => typeof v !== "boolean"))
    throw new Error("终课自评须为布尔值。");
  if (
    !Array.isArray(r.models) ||
    r.models.length > 4 ||
    new Set(r.models).size !== r.models.length ||
    r.models.some((m) => !MODEL_OPTIONS.includes(m))
  )
    throw new Error("终课模型选择不合法。");
  text(r.title);
  text(r.uncertainty);
  computeCapstone(p as CapstoneParameters);
  computeCapstone(p as CapstoneParameters, p.sensitivityFactor as number);
  return JSON.parse(JSON.stringify(value)) as CapstoneState;
}
