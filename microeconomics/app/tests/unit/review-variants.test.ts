import { describe, expect, it } from "vitest";
import { lessons } from "../../src/content";
import { getNumericAnswer } from "../../src/content/answers";
import { getReviewVariant } from "../../src/content/review-variants";
import { runAdvancedLab, type AdvancedLabId } from "../../src/models/advanced";
import type { NumericQuestion } from "../../src/content/types";

const numericQuestions = lessons.flatMap(lesson => lesson.checks).filter((question): question is NumericQuestion => question.kind === "numeric");
const question = (id: string) => numericQuestions.find(item => item.id === id)!;
const variant = (id: string, n = 0) => getReviewVariant(question(id), n) as NumericQuestion;

describe("fresh numeric review scenarios", () => {
  it("covers all 24 lessons, with complete visible inputs and finite same-kernel answers over a full variant cycle", () => {
    expect(numericQuestions).toHaveLength(24);
    for (const original of numericQuestions) {
      const before = JSON.stringify(original);
      for (let n = 0; n < 23; n += 1) {
        const revised = getReviewVariant(original, n) as NumericQuestion;
        expect(revised.id).toBe(original.id);
        expect(revised.prompt).not.toBe(original.prompt);
        expect(revised.feedback).not.toBe(original.feedback);
        expect(revised.answerBasis).toContain("参数");
        expect(revised.model).toBeDefined();
        expect(Number.isFinite(getNumericAnswer(revised))).toBe(true);
        for (const [key, value] of Object.entries(revised.model!.parameters)) {
          // Basic prompts use explicit Chinese quantity labels for x/y; advanced
          // prompts contain the exact numeric parameter name and value.
          if (revised.calculation === "advanced-lab") expect(revised.prompt).toContain(`${key}=${Number(value.toPrecision(12))}`);
        }
      }
      expect(JSON.stringify(original)).toBe(before);
    }
  });

  it("uses independent resource arithmetic, representation, MRS and choice oracles in the first six lessons", () => {
    expect(getNumericAnswer(variant("M01-A-number"))).toBe(3);
    expect(getNumericAnswer(variant("M01-B-number"))).toBe(53);
    expect(getNumericAnswer(variant("M02-A-number"))).toBeCloseTo(256, 10);
    expect(getNumericAnswer(variant("M02-B-number"))).toBeCloseTo((.45 / .55) * 4 / 11, 10);
    expect(getNumericAnswer(variant("M03-A-number"))).toBeCloseTo(13.5, 10);
    expect(getNumericAnswer(variant("M03-B-number"))).toBeCloseTo(13.5, 10);
  });

  it("does not silently reuse the original numerical answer in the initial review, except invariant game counts", () => {
    for (const original of numericQuestions) {
      if (original.model?.labId === "ML07") continue;
      expect(Math.abs(getNumericAnswer(getReviewVariant(original, 0) as NumericQuestion) - getNumericAnswer(original))).toBeGreaterThan(original.tolerance);
    }
  });

  it("independently checks revised marginal cost, profit, market clearing, tax loss and monopoly output", () => {
    expect(getNumericAnswer(variant("M04-A-number"))).toBeCloseTo(11, 10);
    expect(getNumericAnswer(variant("M04-B-number"))).toBeCloseTo(11 * 6.4 - 29 - 3 * 6.4 - 1.25 * 6.4 ** 2 / 2, 10);
    expect(getNumericAnswer(variant("M05-A-number"))).toBeCloseTo((1.25 * 118 + 12 * 3) / (12 + 1.25 * 6.5), 10);
    expect(getNumericAnswer(variant("M06-B-number"))).toBeCloseTo(24 ** 2 / (2 * (1.25 + 1.2)), 10);
    expect(getNumericAnswer(variant("M07-A-number"))).toBeCloseTo((115 - 23) / (2 * 1.25), 10);
    expect(getNumericAnswer(variant("M07-B-number"))).toBeCloseTo((75 - 3) ** 2 / (8 * 2.5), 10);
  });

  it("shows the new game payoff matrix and preserves best responses under positive affine changes", () => {
    for (const id of ["M08-A-number", "M08-B-number"]) {
      for (let n = 0; n < 23; n += 1) {
        const revised = variant(id, n), p = revised.model!.parameters;
        expect(revised.prompt).toContain(`00=(${p.r00},${p.c00})`);
        expect(getNumericAnswer(revised)).toBe(getNumericAnswer(question(id)));
        expect(revised.feedback).toContain("正仿射");
      }
    }
  });

  it("checks external damage, information updating, risk, labor and the binding borrowing constraint", () => {
    expect(getNumericAnswer(variant("M09-A-number"))).toBeCloseTo(97 / (1.25 + 1.2 + 2.6), 10);
    expect(getNumericAnswer(variant("M09-B-number"))).toBeCloseTo(2.6 * 97 / (1.25 + 1.2 + 2.6), 10);
    expect(getNumericAnswer(variant("M10-B-number"))).toBeCloseTo(5.4, 10);
    expect(getNumericAnswer(variant("M10-A-number"))).toBeCloseTo(.3 * .7 * (Math.sqrt(132) - 2) ** 2, 10);
    expect(getNumericAnswer(variant("M11-A-number"))).toBeCloseTo(27 - .5 * (54 + 12 * 27) / 12, 10);
    const constrained = variant("M11-B-number");
    expect(constrained.model!.parameters.noBorrow).toBe(1);
    expect(getNumericAnswer(constrained)).toBeCloseTo(30, 10);
  });

  it("keeps every revised trade scenario physically feasible with conserved goods and an interior relative price", () => {
    for (const id of ["M12-A-number", "M12-B-number"]) for (let n = 0; n < 23; n += 1) {
      const revised = variant(id, n), p = revised.model!.parameters;
      const result = runAdvancedLab(revised.model!.labId as AdvancedLabId, p);
      expect(p.price).toBeGreaterThan(Math.min(p.ax / p.ay, p.bx / p.by));
      expect(p.price).toBeLessThan(Math.max(p.ax / p.ay, p.bx / p.by));
      expect(Math.abs(p.tradeX)).toBeLessThan(result.metrics.maxTradeX as number);
      expect((result.metrics.consumeAx as number) + (result.metrics.consumeBx as number)).toBeCloseTo(result.metrics.worldX as number, 10);
      expect((result.metrics.consumeAy as number) + (result.metrics.consumeBy as number)).toBeCloseTo(result.metrics.worldY as number, 10);
      expect(getNumericAnswer(revised)).toBeCloseTo(p.price * p.tradeX, 10);
    }
  });

  it("is deterministic and rejects invalid variant counters", () => {
    expect(getReviewVariant(question("M06-B-number"), 7)).toEqual(getReviewVariant(question("M06-B-number"), 7));
    for (const n of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => getReviewVariant(question("M06-B-number"), n)).toThrow();
  });
});

describe("choice and explanation review", () => {
  it("reorders choices while keeping stable option IDs and misconception feedback", () => {
    const original = lessons[0].checks.find(item => item.kind === "choice")!;
    const revised = getReviewVariant(original, 0);
    expect(revised.kind).toBe("choice");
    if (original.kind !== "choice" || revised.kind !== "choice") throw new Error("Wrong fixture");
    expect(revised.options.map(item => item.id)).not.toEqual(original.options.map(item => item.id));
    expect(revised.options.slice().sort((a, b) => a.id.localeCompare(b.id))).toEqual(original.options.slice().sort((a, b) => a.id.localeCompare(b.id)));
    expect(revised.answer).toBe(original.answer);
    expect(revised.prompt).toBe(original.prompt);
  });

  it("preserves the reference explanation and adds a transparent transfer self-check without machine scoring", () => {
    const original = lessons[0].checks.find(item => item.kind === "self-explanation")!;
    const revised = getReviewVariant(original, 0);
    if (original.kind !== "self-explanation" || revised.kind !== "self-explanation") throw new Error("Wrong fixture");
    expect(revised.referenceAnswer).toBe(original.referenceAnswer);
    expect(revised.prompt).toContain(original.prompt);
    expect(revised.prompt).toContain("自评");
    expect(revised.rubric).toHaveLength(original.rubric.length + 1);
    expect(revised).not.toHaveProperty("score");
  });
});
