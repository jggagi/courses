import { describe, expect, it } from "vitest";
import {
  budgetGeometry,
  compareBundles,
  demandSeries,
  evaluateBundle,
  indifferenceCurve,
  mrs,
  representedUtility,
  solveChoice,
  utility,
  type Budget,
  type Point,
  type Preference,
  type UniqueChoice,
} from "../../src/models/economics";

const budget: Budget = { m: 120, px: 3, py: 2 };
const cd: Preference = { kind: "cd", alpha: 0.5, a: 1, b: 1 };
const linear: Preference = { ...cd, kind: "linear" };
const complements: Preference = { ...cd, kind: "complements" };
const preferences = [cd, linear, complements];

function close(actual: number, expected: number): void {
  // Theory oracle: absolute + relative 1e-8, independent of UI precision.
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    1e-8 + 1e-8 * Math.abs(expected),
  );
}

function unique(b: Budget, p: Preference): UniqueChoice {
  const result = solveChoice(b, p);
  expect(result.kind).toBe("unique");
  if (result.kind !== "unique") throw new Error("Expected a unique choice");
  return result;
}

function pointClose(actual: Point, expected: Point): void {
  close(actual.x, expected.x);
  close(actual.y, expected.y);
}

describe("ML01: budget geometry and feasibility", () => {
  it("matches all default, doubled-income and zero-budget oracles", () => {
    const defaultGeometry = budgetGeometry(budget);
    close(defaultGeometry.xIntercept, 40);
    close(defaultGeometry.yIntercept, 60);
    close(defaultGeometry.slope, -1.5);
    expect(defaultGeometry.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 0, y: 60 },
    ]);
    expect(evaluateBundle(budget, { x: 20, y: 30 })).toEqual({
      spending: 120,
      balance: 0,
      feasible: true,
      boundary: true,
    });
    expect(evaluateBundle(budget, { x: 30, y: 30 })).toEqual({
      spending: 150,
      balance: -30,
      feasible: false,
      boundary: false,
    });
    expect(evaluateBundle(budget, { x: 10, y: 20 })).toEqual({
      spending: 70,
      balance: 50,
      feasible: true,
      boundary: false,
    });
    const doubled = budgetGeometry({ ...budget, m: 240 });
    close(doubled.xIntercept, 80);
    close(doubled.yIntercept, 120);
    const zero = { ...budget, m: 0 };
    expect(budgetGeometry(zero).vertices).toEqual([{ x: 0, y: 0 }]);
    expect(evaluateBundle(zero, { x: 0, y: 0 }).feasible).toBe(true);
    expect(evaluateBundle(zero, { x: 1e-16, y: 0 }).feasible).toBe(false);
    expect(evaluateBundle(zero, { x: 0, y: 1 }).feasible).toBe(false);
  });

  it("distinguishes a price rotation from an income expansion", () => {
    const doubledPx = budgetGeometry({ ...budget, px: 6 });
    pointClose(
      { x: doubledPx.xIntercept, y: doubledPx.yIntercept },
      { x: 20, y: 60 },
    );
    close(doubledPx.slope, -3);
    const lowerPx = budgetGeometry({ ...budget, px: 1.5 });
    pointClose(
      { x: lowerPx.xIntercept, y: lowerPx.yIntercept },
      { x: 80, y: 60 },
    );
    close(lowerPx.slope, -0.75);
  });

  it("preserves all feasible combinations under currency-unit scaling", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 20, y: 30 },
      { x: 30, y: 30 },
    ];
    for (const scale of [0.001, 0.1, 1.1, 2, 10, 10_000]) {
      const scaled = {
        m: budget.m * scale,
        px: budget.px * scale,
        py: budget.py * scale,
      };
      const original = budgetGeometry(budget);
      const transformed = budgetGeometry(scaled);
      close(transformed.xIntercept, original.xIntercept);
      close(transformed.yIntercept, original.yIntercept);
      close(transformed.slope, original.slope);
      for (const point of points) {
        const originalEvaluation = evaluateBundle(budget, point);
        const transformedEvaluation = evaluateBundle(scaled, point);
        expect(transformedEvaluation.feasible).toBe(
          originalEvaluation.feasible,
        );
        expect(transformedEvaluation.boundary).toBe(
          originalEvaluation.boundary,
        );
        close(
          transformedEvaluation.spending,
          originalEvaluation.spending * scale,
        );
        close(
          transformedEvaluation.balance,
          originalEvaluation.balance * scale,
        );
      }
    }
  });
});

describe("ML02: preferences, ordinal representations and MRS", () => {
  it("matches every ranking and utility oracle", () => {
    const a = { x: 10, y: 10 };
    const b = { x: 20, y: 5 };
    const c = { x: 12, y: 12 };
    for (const [point, u, squared] of [
      [a, 10, 100],
      [b, 10, 100],
      [c, 12, 144],
    ] as const) {
      close(utility(cd, point), u);
      close(representedUtility(cd, point, "u2"), squared);
    }
    expect(compareBundles(cd, a, b)).toBe("indifferent");
    expect(compareBundles(cd, a, c)).toBe("b_preferred");
    expect(compareBundles(cd, c, b, "u2")).toBe("a_preferred");
    close(utility(complements, { x: 10, y: 10 }), 10);
    close(utility(complements, { x: 20, y: 10 }), 10);
  });

  it("preserves every pairwise ranking on a nonnegative grid under squaring", () => {
    const grid: Point[] = [];
    for (let x = 0; x <= 10; x += 2) {
      for (let y = 0; y <= 10; y += 2) grid.push({ x, y });
    }
    for (const preference of [
      ...preferences,
      { ...cd, alpha: 0.8 },
      { ...linear, a: 2, b: 3 },
    ]) {
      for (const a of grid) {
        for (const b of grid) {
          expect(compareBundles(preference, a, b, "u2")).toBe(
            compareBundles(preference, a, b, "u"),
          );
          const ua = utility(preference, a);
          const ub = utility(preference, b);
          // Independent mathematical comparison of transformed numbers.
          const gap = ua - ub;
          const squaredGap =
            representedUtility(preference, a, "u2") -
            representedUtility(preference, b, "u2");
          if (Math.abs(gap) > 1e-8)
            expect(Math.sign(squaredGap)).toBe(Math.sign(gap));
          else close(squaredGap, 0);
        }
      }
    }
  });

  it("makes a preference change distinct from a representation change", () => {
    const a = { x: 20, y: 5 };
    const b = { x: 10, y: 10 };
    expect(compareBundles(cd, a, b)).toBe("indifferent");
    expect(compareBundles({ ...cd, alpha: 0.8 }, a, b)).toBe("a_preferred");
    expect(compareBundles(cd, a, b, "u2")).toBe("indifferent");
  });

  it("matches MRS oracles and handles axes, kink and flat branches explicitly", () => {
    close(mrs(cd, { x: 10, y: 10 }).value!, 1);
    close(mrs(cd, { x: 20, y: 5 }).value!, 0.25);
    close(mrs({ ...linear, a: 4, b: 2 }, { x: 5, y: 7 }).value!, 2);
    expect(mrs(complements, { x: 10, y: 10 })).toMatchObject({
      defined: false,
      value: null,
    });
    expect(mrs(complements, { x: 5, y: 10 })).toMatchObject({
      defined: false,
      value: null,
    });
    expect(mrs(complements, { x: 20, y: 10 })).toMatchObject({
      defined: true,
      value: 0,
    });
    for (const preference of preferences) {
      for (const point of [
        { x: 0, y: 0 },
        { x: 0, y: 20 },
        { x: 20, y: 0 },
      ]) {
        const result = mrs(preference, point);
        expect(result).toMatchObject({ defined: false, value: null });
        expect(result.reason.length).toBeGreaterThan(0);
        close(
          utility(preference, point),
          preference.kind === "linear" ? point.x + point.y : 0,
        );
      }
    }
  });

  it("calculates same-level curves and an exact unsmoothed complement polyline", () => {
    for (const preference of preferences) {
      const through = { x: 12, y: 12 };
      const lines = indifferenceCurve(preference, through);
      expect(lines.length).toBeGreaterThan(0);
      for (const point of lines.flat()) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(60);
        expect(point.y).toBeLessThanOrEqual(60);
        close(utility(preference, point), utility(preference, through));
      }
    }
    expect(indifferenceCurve(complements, { x: 20, y: 10 })).toEqual([
      [
        { x: 10, y: 60 },
        { x: 10, y: 10 },
        { x: 60, y: 10 },
      ],
    ]);
    expect(indifferenceCurve(cd, { x: 0, y: 10 })).toEqual([
      [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 60 },
      ],
    ]);
    expect(indifferenceCurve(complements, { x: 70, y: 80 })).toEqual([]);
    expect(indifferenceCurve(linear, { x: 100, y: 100 })).toEqual([]);
  });
});

describe("ML03: optimal choices and demand relations", () => {
  it("matches all CD, linear and complement oracles", () => {
    pointClose(unique(budget, cd).point, { x: 20, y: 30 });
    pointClose(unique({ ...budget, px: 6 }, cd).point, { x: 10, y: 30 });
    pointClose(unique({ ...budget, m: 200 }, cd).point, { x: 100 / 3, y: 50 });
    pointClose(unique(budget, linear).point, { x: 0, y: 60 });
    pointClose(unique(budget, complements).point, { x: 24, y: 24 });
    pointClose(unique({ ...budget, px: 6 }, complements).point, {
      x: 15,
      y: 15,
    });
    expect(unique(budget, cd).solutionType).toBe("interior");
    expect(unique(budget, linear).solutionType).toBe("corner");
    expect(unique(budget, complements).solutionType).toBe("kink");
    close(unique(budget, cd).utility, Math.sqrt(600));
    close(unique({ ...budget, px: 6 }, cd).utility, Math.sqrt(300));
  });

  it("returns the whole optimal boundary for a linear tie and all weighted cases", () => {
    const tiedBudget = { m: 120, px: 2, py: 2 };
    const tied = solveChoice(tiedBudget, linear);
    expect(tied.kind).toBe("optimal_set");
    if (tied.kind !== "optimal_set") throw new Error("Missing optimal set");
    expect(tied.endpoints).toEqual([
      { x: 0, y: 60 },
      { x: 60, y: 0 },
    ]);
    for (let t = 0; t <= 1; t += 0.05) {
      const point = { x: 60 * t, y: 60 * (1 - t) };
      expect(evaluateBundle(tiedBudget, point).feasible).toBe(true);
      close(utility(linear, point), tied.utility);
    }
    const weighted: Preference = { ...linear, a: 3, b: 2 };
    expect(solveChoice({ m: 120, px: 3, py: 2 }, weighted).kind).toBe(
      "optimal_set",
    );
    pointClose(
      unique({ m: 120, px: 3, py: 2 }, { ...weighted, a: 3 + 1e-9 }).point,
      { x: 40, y: 0 },
    );
    pointClose(
      unique({ m: 120, px: 3, py: 2 }, { ...weighted, a: 3 - 1e-9 }).point,
      { x: 0, y: 60 },
    );
  });

  it("treats zero budget as a unique feasible point in every mode, including a linear tie", () => {
    for (const preference of preferences) {
      const result = unique({ m: 0, px: 2, py: 2 }, preference);
      expect(result.point).toEqual({ x: 0, y: 0 });
      expect(result.solutionType).toBe("degenerate");
      expect(result.utility).toBe(0);
      expect(result.spending).toBe(0);
      expect(result.representedUtility).toBe(0);
    }
  });

  it("satisfies nonnegativity and the budget across valid parameter combinations", () => {
    for (const m of [0, 1, 120, 200]) {
      for (const px of [1, 3.1, 20]) {
        for (const py of [1, 2.7, 20]) {
          for (const preference of [
            ...preferences,
            { ...cd, alpha: 0.1 },
            { ...cd, alpha: 0.9 },
          ]) {
            const b = { m, px, py };
            const result = solveChoice(b, preference);
            const points =
              result.kind === "unique" ? [result.point] : result.endpoints;
            for (const point of points) {
              expect(point.x).toBeGreaterThanOrEqual(0);
              expect(point.y).toBeGreaterThanOrEqual(0);
              expect(evaluateBundle(b, point).feasible).toBe(true);
              close(evaluateBundle(b, point).spending, m);
            }
          }
        }
      }
    }
  });

  it("preserves optimal choice sets under currency and ordinal transformations", () => {
    for (const preference of preferences) {
      for (const b of [
        budget,
        { m: 120, px: 2, py: 2 },
        { m: 0, px: 4, py: 7 },
      ]) {
        const result = solveChoice(b, preference);
        const squared = solveChoice(b, preference, "u2");
        expect(squared.kind).toBe(result.kind);
        close(squared.representedUtility, result.utility ** 2);
        for (const scale of [0.01, 1.1, 10, 1000]) {
          const scaled = solveChoice(
            { m: b.m * scale, px: b.px * scale, py: b.py * scale },
            preference,
          );
          expect(scaled.kind).toBe(result.kind);
          if (
            result.kind === "unique" &&
            scaled.kind === "unique" &&
            squared.kind === "unique"
          ) {
            pointClose(scaled.point, result.point);
            pointClose(squared.point, result.point);
          } else if (
            result.kind === "optimal_set" &&
            scaled.kind === "optimal_set" &&
            squared.kind === "optimal_set"
          ) {
            result.endpoints.forEach((point, i) => {
              pointClose(scaled.endpoints[i], point);
              pointClose(squared.endpoints[i], point);
            });
          }
        }
      }
    }
  });

  it("matches an independent dense two-dimensional feasible grid for CD", () => {
    // Independent oracle: no calls to utility/solveChoice in the grid itself.
    // A 400-step x mesh has quantity resolution (m/px)/400. For each x,
    // a 400-step y mesh independently scans the entire remaining budget.
    const divisions = 400;
    for (const [b, alpha] of [
      [{ m: 120, px: 3, py: 2 }, 0.5],
      [{ m: 137, px: 4.7, py: 3.2 }, 0.31],
      [{ m: 71, px: 1.3, py: 6.1 }, 0.83],
      [{ m: 200, px: 8, py: 1 }, 0.1],
    ] as const) {
      let best = { x: 0, y: 0, value: -1 };
      for (let ix = 0; ix <= divisions; ix += 1) {
        const x = ((b.m / b.px) * ix) / divisions;
        const remainingY = Math.max(0, (b.m - b.px * x) / b.py);
        for (let iy = 0; iy <= divisions; iy += 1) {
          const y = (remainingY * iy) / divisions;
          const value = x ** alpha * y ** (1 - alpha);
          if (value > best.value) best = { x, y, value };
        }
      }
      const analytic = unique(b, { ...cd, alpha });
      expect(analytic.utility + 1e-8).toBeGreaterThanOrEqual(best.value);
      expect(analytic.utility - best.value).toBeLessThan(
        1e-4 * analytic.utility,
      );
      expect(Math.abs(analytic.point.x - best.x)).toBeLessThanOrEqual(
        b.m / b.px / divisions + 1e-8,
      );
      expect(Math.abs(analytic.point.y - best.y)).toBeLessThanOrEqual(
        b.m / b.py / divisions + 1e-8,
      );
    }
  });

  it("generates demand by the solver and exposes a set-valued price without false single values", () => {
    const prices = Array.from({ length: 20 }, (_, i) => i + 1);
    const cdDemand = demandSeries(budget, cd, prices);
    expect(cdDemand).toHaveLength(20);
    for (const entry of cdDemand) {
      close(entry.xRange[0], 60 / entry.price);
      close(entry.xRange[1], entry.xRange[0]);
      expect(entry.choice).toEqual(
        solveChoice({ ...budget, px: entry.price }, cd),
      );
    }
    for (let i = 1; i < cdDemand.length; i += 1)
      expect(cdDemand[i].xRange[0]).toBeLessThan(cdDemand[i - 1].xRange[0]);
    const linearDemand = demandSeries(
      { ...budget, py: 2.7 },
      linear,
      [1, 2, 3, 6],
    );
    const tie = linearDemand.find((entry) => entry.price === 2.7)!;
    expect(tie.choice.kind).toBe("optimal_set");
    pointClose({ x: tie.xRange[0], y: tie.xRange[1] }, { x: 0, y: 120 / 2.7 });
    expect(linearDemand.find((entry) => entry.price === 2)!.xRange).toEqual([
      60, 60,
    ]);
    expect(linearDemand.find((entry) => entry.price === 3)!.xRange).toEqual([
      0, 0,
    ]);
    const continuous = Array.from({ length: 191 }, (_, i) => 1 + i / 10);
    for (const preference of preferences) {
      for (const entry of demandSeries(budget, preference, continuous)) {
        expect(entry.xRange.every(Number.isFinite)).toBe(true);
        expect(entry.choice.spending).toBeLessThanOrEqual(120 + 1e-8);
      }
    }
    expect(demandSeries(budget, cd, [])).toEqual([]);
  });
});

describe("domain failures never silently clamp or leak NaN/Infinity", () => {
  it("rejects negative budget, zero/negative/nonfinite prices and invalid points", () => {
    for (const invalid of [
      { ...budget, m: -1 },
      { ...budget, m: NaN },
      { ...budget, m: Infinity },
      { ...budget, px: 0 },
      { ...budget, px: -2 },
      { ...budget, px: NaN },
      { ...budget, py: 0 },
      { ...budget, py: Infinity },
    ]) {
      expect(() => budgetGeometry(invalid)).toThrow(RangeError);
      expect(() => evaluateBundle(invalid, { x: 1, y: 1 })).toThrow(RangeError);
      expect(() => solveChoice(invalid, cd)).toThrow(RangeError);
      expect(() => demandSeries(invalid, cd, [1, 2])).toThrow(RangeError);
    }
    for (const point of [
      { x: -1, y: 2 },
      { x: 1, y: -1 },
      { x: NaN, y: 1 },
      { x: 1, y: Infinity },
    ]) {
      expect(() => utility(cd, point)).toThrow(RangeError);
      expect(() => evaluateBundle(budget, point)).toThrow(RangeError);
      expect(() => mrs(cd, point)).toThrow(RangeError);
      expect(() => indifferenceCurve(cd, point)).toThrow(RangeError);
    }
  });

  it("rejects invalid preferences, representations, sampling and arithmetic overflow", () => {
    for (const invalid of [
      { ...cd, alpha: 0 },
      { ...cd, alpha: 1 },
      { ...cd, alpha: NaN },
      { ...linear, a: 0 },
      { ...linear, b: -1 },
      { ...linear, b: Infinity },
      { ...cd, kind: "unknown" } as unknown as Preference,
    ]) {
      expect(() => utility(invalid, { x: 10, y: 10 })).toThrow(RangeError);
      expect(() => solveChoice(budget, invalid)).toThrow(RangeError);
    }
    expect(() => representedUtility(cd, { x: 1, y: 1 }, "log" as "u")).toThrow(
      RangeError,
    );
    expect(() =>
      compareBundles(cd, { x: 1, y: 1 }, { x: 2, y: 2 }, "log" as "u"),
    ).toThrow(RangeError);
    expect(() => solveChoice(budget, cd, "log" as "u")).toThrow(RangeError);
    expect(() => demandSeries(budget, cd, [1, 0, 2])).toThrow(RangeError);
    expect(() =>
      indifferenceCurve(cd, { x: 1, y: 1 }, { xMax: 0, yMax: 1 }),
    ).toThrow(RangeError);
    expect(() => indifferenceCurve(cd, { x: 1, y: 1 }, undefined, 1)).toThrow(
      RangeError,
    );
    expect(() => indifferenceCurve(cd, { x: 1, y: 1 }, undefined, 2.5)).toThrow(
      RangeError,
    );
    expect(() => evaluateBundle(budget, { x: Number.MAX_VALUE, y: 1 })).toThrow(
      RangeError,
    );
    expect(() =>
      representedUtility(linear, { x: 1e200, y: 1e200 }, "u2"),
    ).toThrow(RangeError);
    expect(() =>
      budgetGeometry({ m: Number.MAX_VALUE, px: Number.MIN_VALUE, py: 1 }),
    ).toThrow(RangeError);
  });

  it("does not mutate input models, arrays or points", () => {
    const b = Object.freeze({ ...budget });
    const preference = Object.freeze({ ...cd });
    const point = Object.freeze({ x: 12, y: 12 });
    const prices = [3, 1, 2];
    solveChoice(b, preference);
    indifferenceCurve(preference, point);
    demandSeries(b, preference, prices);
    expect(prices).toEqual([3, 1, 2]);
    expect(b).toEqual(budget);
    expect(point).toEqual({ x: 12, y: 12 });
  });
});
