import { evaluateBundle, mrs, representedUtility, solveChoice } from "../models/economics";
import { runAdvancedLab, type AdvancedLabId } from "../models/advanced";
import type { NumericQuestion } from "./types";

/** Objective answers use the exact model functions used by labs, not display rounding. */
export function getNumericAnswer(question: NumericQuestion): number {
  if (question.model && ["ML01", "ML02", "ML03"].includes(question.model.labId) && question.calculation !== "advanced-lab") {
    const { parameters: p, metric } = question.model;
    const preference = { kind: "cd" as const, alpha: p.alpha ?? 0.5, a: 1, b: 1 };
    const budget = { m: p.m, px: p.px, py: p.py };
    const point = { x: p.x, y: p.y };
    let answer: number;
    if (metric === "balance" || metric === "excess") {
      const balance = evaluateBundle(budget, point).balance;
      answer = metric === "excess" ? -balance : balance;
    } else if (metric === "u2") answer = representedUtility(preference, point, "u2");
    else if (metric === "mrs") {
      const result = mrs(preference, point);
      if (!result.defined || result.value === null) throw new Error("MRS 在此点没有有限定义。");
      answer = result.value;
    } else if (metric === "x") {
      const result = solveChoice(budget, preference);
      if (result.kind !== "unique") throw new Error("数值题需要唯一最优解。");
      answer = result.point.x;
    } else throw new Error("未知数值题指标。");
    if (!Number.isFinite(answer)) throw new Error("数值题必须有有限答案。");
    return answer;
  }
  const preference = { kind: "cd" as const, alpha: 0.5, a: 1, b: 1 };
  switch (question.calculation) {
    case "advanced-lab": {
      if (!question.model || !["ML04", "ML05", "ML06", "ML07", "ML08", "ML09", "ML10", "ML11"].includes(question.model.labId)) throw new Error("数值题缺少可计算的模型。");
      const result = runAdvancedLab(question.model.labId as AdvancedLabId, question.model.parameters);
      const answer = result.metrics[question.model.metric];
      if (typeof answer !== "number" || !Number.isFinite(answer)) throw new Error("数值题应处于有效模型域并具有有限答案。");
      return answer;
    }
    case "time-excess":
      return -evaluateBundle({ m: 6, px: 1, py: 1 }, { x: 3, y: 4 }).balance;
    case "budget-balance":
      return evaluateBundle({ m: 120, px: 3, py: 2 }, { x: 10, y: 20 }).balance;
    case "utility-square":
      return representedUtility(preference, { x: 12, y: 12 }, "u2");
    case "mrs-cd": {
      const result = mrs(preference, { x: 20, y: 5 });
      if (!result.defined || result.value === null)
        throw new Error("内容中的MRS题应处于有效内点。");
      return result.value;
    }
    case "choice-cd-x":
    case "demand-cd-x": {
      const result = solveChoice(
        { m: 120, px: question.calculation === "choice-cd-x" ? 3 : 6, py: 2 },
        preference,
      );
      if (result.kind !== "unique") throw new Error("内容中的CD题应有唯一解。");
      return result.point.x;
    }
  }
}
