import { defaultPriceInput, computePrices } from "./prices";
import { defaultGrowthParameters, simulateGrowth } from "./growth";
import { defaultSpendingParameters, simulateSpending } from "./spending";
import { defaultPolicyParameters, simulatePolicy } from "./policy";
import {
  defaultCreditState,
  replayCreditEvents,
  type CreditEvent,
} from "./credit";
export type CapstoneParameters = {
  priceFactor: number;
  technologyFactor: number;
  spendingChange: number;
  demandShock: number;
  supplyShock: number;
  creditLoss: number;
  sensitivityFactor: number;
};
type ComparisonModel = "growth" | "demand" | "supply" | "finance";
export function computeCapstone(parameters: CapstoneParameters, factor = 1) {
  const p = parameters;
  const prices = defaultPriceInput();
  prices.periods[1] = {
    ...prices.periods[1],
    px: prices.periods[1].px * p.priceFactor ** factor,
    py: prices.periods[1].py * p.priceFactor ** factor,
  };
  const priceResult = computePrices(prices);
  const growth = simulateGrowth({
    ...defaultGrowthParameters(),
    technologyShock: p.technologyFactor ** factor,
    periods: 10,
  });
  const demand = simulateSpending({
    ...defaultSpendingParameters(),
    C0: 20 + p.spendingChange * factor,
    periods: 10,
  });
  const supply = simulatePolicy({
    ...defaultPolicyParameters(),
    demandShock: p.demandShock * factor,
    supplyShock: p.supplyShock * factor,
    periods: 10,
  });
  const loss = Math.round(p.creditLoss * factor * 100) / 100;
  const events: CreditEvent[] = (
    [
      ["loan", 10],
      ["payment", 7],
      ["repayment", 3],
    ] as const
  ).map(([type, amount], index) => ({
    id: `capstone-${index + 1}`,
    sequence: index + 1,
    type,
    amount,
  }));
  if (loss > 0)
    events.push({
      id: "capstone-loss",
      sequence: 4,
      type: "loss",
      amount: loss,
    });
  const finance = replayCreditEvents(defaultCreditState(), events);
  const results: Record<
    ComparisonModel,
    { metric: string; value: number; unit: string; boundary: string }
  > = {
    growth: {
      metric: "第1期每工人产出",
      value: growth.periods[1].y,
      unit: "产出/工人/期",
      boundary: "一次技术水平改变、外生储蓄；不等于短期就业预测。",
    },
    demand: {
      metric: "均衡产出",
      value: demand.equilibrium.Y,
      unit: "货币单位/期",
      boundary: "固定价格、有闲置产能、投资外生；没有供应或利率反馈。",
    },
    supply: {
      metric: "第1期通胀",
      value: supply.periods[1].pi,
      unit: "百分数",
      boundary: "滞后反应和外生自然利率；缺口与通胀来自合成参数。",
    },
    finance: {
      metric: "银行A期末权益",
      value: finance.A.equity,
      unit: "货币单位",
      boundary: "历史债权减值，不自动免债或减少存款；损失按最小货币单位舍入。",
    },
  };
  return { prices: priceResult, growth, demand, supply, finance, results };
}
