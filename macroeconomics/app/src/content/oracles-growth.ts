import type { Lesson } from "./types";
import { defaultGrowthParameters, simulateGrowth } from "../models/growth";
import {
  defaultSpendingParameters,
  simulateSpending,
} from "../models/spending";

// 客观答案与实验使用同一计算内核；不读图形坐标或已舍入的显示值。
export const baseGrowth = simulateGrowth(defaultGrowthParameters());
export const higherSaving = simulateGrowth({
  ...defaultGrowthParameters(),
  s: 0.4,
});
export const productivityLevel = simulateGrowth({
  ...defaultGrowthParameters(),
  K0: 4,
  L0: 1,
  technologyShock: 1.2,
  shockPeriod: 1,
});
export const baseSpending = simulateSpending(defaultSpendingParameters());
// IS插页把利率敏感投资的明确行为假设转换成LA05的外生投资场景。
export const interestScenario = simulateSpending({
  ...defaultSpendingParameters(),
  I0: 40 - 100 * 0.05,
});
