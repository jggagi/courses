import { assertNumber, assertRecord, moneyCents } from "./validation";

export interface ExternalParameters {
  output: number;
  consumption: number;
  government: number;
  investment: number;
  exports: number;
  imports: number;
  netPrimaryIncome: number;
  netCurrentTransfers: number;
  openingNFA: number;
  valuationChange: number;
  /** e为本币/单位外币；P与P*均为各自货币下的一致参考篮子价格。 */
  exchangeRate: number;
  foreignPrice: number;
  domesticPrice: number;
  baseExchangeRate: number;
  baseForeignPrice: number;
  baseDomesticPrice: number;
}

export interface ExternalResult {
  production: number;
  expenditure: number;
  NX: number;
  YD: number;
  S: number;
  CA: number;
  CAFromSaving: number;
  NFAChange: number;
  closingNFA: number;
  q: number;
  qBase: number;
  qChange: number;
  reciprocalQ: number;
  reciprocalQBase: number;
  reciprocalQChange: number;
  convention: "domestic_per_foreign";
  realMovement: "depreciation" | "appreciation" | "unchanged";
  omittedAdjustments: string[];
}

export function defaultExternalParameters(): ExternalParameters {
  return {
    output: 100,
    consumption: 60,
    government: 20,
    investment: 25,
    exports: 15,
    imports: 20,
    netPrimaryIncome: 2,
    netCurrentTransfers: 1,
    openingNFA: 0,
    valuationChange: 4,
    exchangeRate: 7,
    foreignPrice: 100,
    domesticPrice: 100,
    baseExchangeRate: 7,
    baseForeignPrice: 100,
    baseDomesticPrice: 100,
  };
}

function bounded(value: number, label: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000_000)
    throw new Error(`${label}超出有限计算范围；未伪造或裁剪结果。`);
  return value;
}

/** 原始生产与使用记录须先对账；汇率变化只改变相对价格，不暗中重写贸易流。 */
export function calculateExternal(
  parameters: ExternalParameters,
): ExternalResult {
  assertRecord(parameters, "开放经济参数");
  const cents = {} as Record<
    | "output"
    | "consumption"
    | "government"
    | "investment"
    | "exports"
    | "imports"
    | "netPrimaryIncome"
    | "netCurrentTransfers"
    | "openingNFA"
    | "valuationChange",
    number
  >;
  for (const key of [
    "output",
    "consumption",
    "government",
    "investment",
    "exports",
    "imports",
    "netPrimaryIncome",
    "netCurrentTransfers",
    "openingNFA",
    "valuationChange",
  ] as const)
    cents[key] = moneyCents(parameters[key], key, {
      signed: [
        "netPrimaryIncome",
        "netCurrentTransfers",
        "openingNFA",
        "valuationChange",
      ].includes(key),
    });
  const NX = cents.exports - cents.imports;
  const expenditure =
    cents.consumption + cents.government + cents.investment + NX;
  if (expenditure !== cents.output)
    throw new Error(
      "生产与最终使用不一致：Y必须等于C+G+I+X−M；请修改原始记录，不能用调整项补平。",
    );
  const YD = cents.output + cents.netPrimaryIncome + cents.netCurrentTransfers;
  const S = YD - cents.consumption - cents.government;
  const CA = NX + cents.netPrimaryIncome + cents.netCurrentTransfers;
  const CAFromSaving = S - cents.investment;
  if (CA !== CAFromSaving) throw new Error("经常账户与储蓄投资核算不一致。");
  const NFAChange = CA + cents.valuationChange;
  for (const key of [
    "exchangeRate",
    "foreignPrice",
    "domesticPrice",
    "baseExchangeRate",
    "baseForeignPrice",
    "baseDomesticPrice",
  ] as const)
    assertNumber(parameters[key], key, { positive: true });
  const q = bounded(
    (parameters.exchangeRate * parameters.foreignPrice) /
      parameters.domesticPrice,
    "实际汇率q",
  );
  const qBase = bounded(
    (parameters.baseExchangeRate * parameters.baseForeignPrice) /
      parameters.baseDomesticPrice,
    "基准实际汇率q",
  );
  if (q <= 0 || qBase <= 0)
    throw new Error("实际汇率数值下溢，不能计算增长率或倒数。");
  const qChange = bounded(q / qBase - 1, "实际汇率变化率");
  const reciprocalQ = bounded(1 / q, "倒数定义的实际汇率");
  const reciprocalQBase = bounded(1 / qBase, "基准倒数实际汇率");
  const reciprocalQChange = bounded(
    reciprocalQ / reciprocalQBase - 1,
    "倒数实际汇率变化率",
  );
  return {
    production: cents.output / 100,
    expenditure: expenditure / 100,
    NX: NX / 100,
    YD: YD / 100,
    S: S / 100,
    CA: CA / 100,
    CAFromSaving: CAFromSaving / 100,
    NFAChange: NFAChange / 100,
    closingNFA: (cents.openingNFA + NFAChange) / 100,
    q,
    qBase,
    qChange,
    reciprocalQ,
    reciprocalQBase,
    reciprocalQChange,
    convention: "domestic_per_foreign",
    realMovement:
      q > qBase ? "depreciation" : q < qBase ? "appreciation" : "unchanged",
    omittedAdjustments: ["资本账户", "其他外部资产存量流量调整"],
  };
}
