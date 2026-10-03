import {
  evaluateBundle,
  mrs,
  representedUtility,
  solveChoice,
} from "../models/economics";
import { lessons } from "./lessons";
import type { NumericQuestion } from "./types";

export * from "./types";
export { lessons } from "./lessons";
export { catalog, modules } from "./catalog";
export { glossary, references } from "./glossary";

export const courseId = "microeconomics" as const;
export const labIds = ["ML01", "ML02", "ML03"] as const;
export function getLesson(id: string) {
  return lessons.find((lesson) => lesson.id === id);
}

/** Objective answers use the exact model functions used by labs, not display rounding. */
export function getNumericAnswer(question: NumericQuestion): number {
  const preference = { kind: "cd" as const, alpha: 0.5, a: 1, b: 1 };
  switch (question.calculation) {
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
