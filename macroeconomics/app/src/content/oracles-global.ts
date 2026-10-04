import type { Lesson } from "./types";
import {
  calculateExternal,
  defaultExternalParameters,
} from "../models/external";
import {
  defaultSpendingParameters,
  simulateSpending,
} from "../models/spending";
import { computePrices } from "../models/prices";

// 实验相关客观答案直接取同一纯计算内核；不从图表显示后的舍入值反推。
export const externalExample = calculateExternal(defaultExternalParameters());
export const exchangeExample = calculateExternal({
  ...defaultExternalParameters(),
  exchangeRate: 7.7,
});
export const spendingBase = simulateSpending({
  ...defaultSpendingParameters(),
  C0: 20,
  c: 0.6,
  T: 0,
  I0: 20,
  G: 20,
});
export const spendingChange = simulateSpending({
  ...defaultSpendingParameters(),
  C0: 20,
  c: 0.6,
  T: 0,
  I0: 20,
  G: 10,
});
export const priceExample = computePrices({
  periods: [
    { px: 1, py: 1, qx: 100, qy: 0 },
    { px: 1.1, py: 1.1, qx: 100, qy: 0 },
  ],
  priceBase: 0,
  basketBase: 0,
  normalization: 100,
});
// 杠杆与描述性变化差是正文独立例的定义计算，未假装由LA07/06推导。
export const leverageExample = (100 - 5) / (100 - 90 - 5);
export const descriptiveDifference = 98 - 100 - (99 - 100);

type GlobalLesson = Omit<Lesson, "id" | "labId"> & {
  id: "A10-A" | "A10-B" | "A11-A" | "A11-B" | "A12-A" | "A12-B";
  labId: "LA05" | "LA06" | "LA07" | "LA09";
};

/** 原创教学情景，所有数值均为 synthetic，不能解释为现实校准或预测。 */
