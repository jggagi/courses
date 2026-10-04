import { describe, expect, it } from "vitest";
import {
  EXTENSION_LAB_IDS, enumerateEquilibriumRegions, extensionDefaults,
  extensionLabDefinitions, runExtensionLab,
  type EquilibriumRegion, type ExtensionLabId, type ExtensionParameters, type ExtensionLabResult,
} from "../../src/models/extensions";

const run = (id: ExtensionLabId, patch: ExtensionParameters = {}) => runExtensionLab(id, { ...extensionDefaults(id), ...patch });
const value = (r: ExtensionLabResult, key: string) => {
  expect(r.metrics[key], key).not.toBeNull();
  expect(Number.isFinite(r.metrics[key]), key).toBe(true);
  return r.metrics[key] as number;
};
const close = (actual: number, expected: number, tolerance = 1e-8) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected)));
const oracle = (r: ExtensionLabResult, expected: Record<string, number>) => {
  for (const [key, target] of Object.entries(expected)) close(value(r, key), target);
};

describe("MX01 independent finite compensation oracles", () => {
  it("distinguishes Slutsky purchasing power from Hicks constant utility", () => {
    oracle(run("MX01"), {
      x0: 20, y0: 30, x1: 10, y1: 30, totalEffect: -10,
      slutskyIncome: 180, slutskyX: 15, slutskyY: 45,
      slutskySubstitution: -5, slutskyIncomeEffect: -5,
      hicksIncome: 120 * Math.SQRT2, hicksX: 10 * Math.SQRT2, hicksY: 30 * Math.SQRT2,
      hicksSubstitution: 10 * Math.SQRT2 - 20, hicksIncomeEffect: 10 - 10 * Math.SQRT2,
      u0: Math.sqrt(600), u1: Math.sqrt(300), hicksUtility: Math.sqrt(600), slutskyUtility: Math.sqrt(675),
    });
    const r = run("MX01");
    expect(value(r, "slutskyIncome")).toBeGreaterThan(value(r, "hicksIncome"));
    expect(value(r, "slutskyUtility")).toBeGreaterThan(value(r, "u0"));
  });
  it("satisfies each budget, the original bundle's Slutsky cost, utility compensation and both decompositions", () => {
    for (const m of [0, 1, 120, 277.5]) for (const alpha of [.1, .37, .5, .9]) for (const px1 of [.8, 3, 6, 13.4]) {
      const r = run("MX01", { m, alpha, px1 });
      close(3 * value(r, "x0") + 2 * value(r, "y0"), m);
      close(px1 * value(r, "x1") + 2 * value(r, "y1"), m);
      close(px1 * value(r, "slutskyX") + 2 * value(r, "slutskyY"), value(r, "slutskyIncome"));
      close(px1 * value(r, "hicksX") + 2 * value(r, "hicksY"), value(r, "hicksIncome"));
      close(px1 * value(r, "x0") + 2 * value(r, "y0"), value(r, "slutskyIncome"));
      close(value(r, "hicksUtility"), value(r, "u0"));
      close(value(r, "slutskySubstitution") + value(r, "slutskyIncomeEffect"), value(r, "totalEffect"));
      close(value(r, "hicksSubstitution") + value(r, "hicksIncomeEffect"), value(r, "totalEffect"));
      expect(value(r, "slutskyIncome") + 1e-9).toBeGreaterThanOrEqual(value(r, "hicksIncome"));
      if (px1 > 3) for (const key of ["slutskySubstitution", "hicksSubstitution", "slutskyIncomeEffect", "hicksIncomeEffect"]) expect(value(r, key)).toBeLessThanOrEqual(1e-9);
      if (px1 < 3) for (const key of ["slutskySubstitution", "hicksSubstitution", "slutskyIncomeEffect", "hicksIncomeEffect"]) expect(value(r, key)).toBeGreaterThanOrEqual(-1e-9);
    }
  });
  it("matches independent expenditure minimization along the original isoquant", () => {
    for (const alpha of [.2, .5, .8]) for (const px1 of [.8, 6, 13]) {
      const r = run("MX01", { alpha, px1 });
      // This oracle uses the original utility directly, not any kernel utility
      // or expenditure helper. Every grid point delivers exactly that utility.
      const originalX = alpha * 120 / 3, originalY = (1 - alpha) * 120 / 2;
      const target = originalX ** alpha * originalY ** (1 - alpha);
      const optimumCost = value(r, "hicksIncome"), xH = value(r, "hicksX");
      for (let i = 1; i <= 800; i += 1) {
        const x = xH * i / 200;
        const y = (target / x ** alpha) ** (1 / (1 - alpha));
        expect(px1 * x + 2 * y + 1e-8).toBeGreaterThanOrEqual(optimumCost);
      }
      const yH = (target / xH ** alpha) ** (1 / (1 - alpha));
      close(px1 * xH + 2 * yH, optimumCost);
    }
  });
  it("preserves physical quantities under currency scaling and is linear in income", () => {
    const original = run("MX01", { alpha: .37 });
    for (const scale of [.1, 2, 10, 1000]) {
      const currency = run("MX01", { m: 120 * scale, px0: 3 * scale, px1: 6 * scale, py: 2 * scale, alpha: .37 });
      for (const key of ["x0", "y0", "x1", "y1", "slutskyX", "slutskyY", "hicksX", "hicksY", "totalEffect", "hicksSubstitution", "hicksIncomeEffect", "slutskySubstitution", "slutskyIncomeEffect", "u0", "hicksUtility"]) close(value(currency, key), value(original, key));
      for (const key of ["slutskyIncome", "hicksIncome"]) close(value(currency, key), value(original, key) * scale);
      const income = run("MX01", { m: 120 * scale, alpha: .37 });
      for (const key of Object.keys(original.metrics)) close(value(income, key), value(original, key) * scale);
    }
  });
  it("reports zero budget and unchanged prices without a logarithmic singularity", () => {
    const zero = run("MX01", { m: 0 });
    for (const v of Object.values(zero.metrics)) expect(v).toBe(0);
    expect(zero.status).toContain("零预算");
    for (const line of zero.curves) expect(line.points).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    const unchanged = run("MX01", { px1: 3, alpha: .37 });
    for (const key of ["totalEffect", "slutskySubstitution", "slutskyIncomeEffect", "hicksSubstitution", "hicksIncomeEffect"]) close(value(unchanged, key), 0);
    close(value(unchanged, "slutskyIncome"), 120); close(value(unchanged, "hicksIncome"), 120);
    expect(unchanged.status).toContain("价格不变");
  });
  it("approaches the same differential substitution response as price changes shrink", () => {
    const alpha = .37, x0 = alpha * 120 / 3;
    const derivative = -(1 - alpha) * x0 / 3;
    for (const step of [1e-3, 1e-4, 1e-5]) {
      const r = run("MX01", { px1: 3 + step, alpha });
      close(value(r, "slutskySubstitution") / step, derivative, 5e-4);
      close(value(r, "hicksSubstitution") / step, derivative, 5e-4);
    }
  });
  it("uses budget lines with the same goods units and all numerical results from the kernel", () => {
    const r = run("MX01");
    const budgets = [[120, 3], [120, 6], [value(r, "slutskyIncome"), 6], [value(r, "hicksIncome"), 6]];
    r.curves.forEach((line, i) => line.points.forEach(pt => close(budgets[i][1] * pt.x + 2 * pt.y, budgets[i][0])));
    for (const entry of r.rows) close(entry.value as number, value(r, entry.key));
  });
  it("rejects invalid income, prices and Cobb–Douglas weights", () => {
    const invalid: ExtensionParameters[] = [{ m: -1 }, { px0: 0 }, { px1: 0 }, { py: -1 }, { alpha: 0 }, { alpha: 1 }, { alpha: -.1 }];
    for (const patch of invalid) expect(() => run("MX01", patch)).toThrow(RangeError);
  });
});

describe("MX02 short-run competition and long-run free entry", () => {
  it("matches continuous and discrete oracles without equating integer profits to zero", () => {
    const q = Math.sqrt(40), p = 2 + q, Q = 100 - 5 * p;
    oracle(run("MX02"), {
      shortRunPrice: 8, shortRunQ: 60, shortRunFirmQ: 6, shortRunProfit: -2,
      pLR: p, qFirm: q, QLR: Q, nLR: Q / q, profitLR: 0,
      integerN: 9, integerMinN: 9, integerMaxN: 9,
      integerPrice: 2 + 90 / 14, integerQ: 9 * 90 / 14,
      incumbentProfit: (90 / 14) ** 2 / 2 - 20, entrantProfit: -2,
    });
  });
  it("checks every returned integer count against independently recalculated market profits", () => {
    for (const F of [2, 18, 20, 60, 10000]) for (const c of [0, 2, 12]) for (const d of [.25, 1, 5]) for (const A of [0, 5, 100, 240]) for (const B of [.1, 5]) {
      const r = run("MX02", { F, c, d, A, B });
      const n = value(r, "integerN");
      const independent = (count: number) => {
        const price = (d * A + count * c) / (count + d * B);
        const supply = Math.max(0, (price - c) / d);
        return (price - c) * supply - d * supply * supply / 2 - F;
      };
      if (n > 0) { expect(independent(n) + 1e-8).toBeGreaterThanOrEqual(0); close(value(r, "incumbentProfit"), independent(n)); }
      else expect(r.metrics.incumbentProfit).toBeNull();
      expect(independent(n + 1)).toBeLessThanOrEqual(1e-8);
      close(value(r, "entrantProfit"), independent(n + 1));
      // Independent enumeration, not the continuous formula or its floor.
      const all: number[] = [];
      for (let candidate = 0; candidate <= n + 2; candidate += 1) if ((candidate === 0 || independent(candidate) >= -1e-8) && independent(candidate + 1) <= 1e-8) all.push(candidate);
      expect(all).toContain(n);
      close(value(r, "QLR"), Math.max(0, A - B * value(r, "pLR")));
      close(value(r, "nLR") * value(r, "qFirm"), value(r, "QLR"));
    }
  });
  it("preserves weak entry multiplicity exactly at a zero-profit boundary", () => {
    oracle(run("MX02", { F: 18 }), { integerN: 10, integerMinN: 9, integerMaxN: 10, incumbentProfit: 0 });
    expect(run("MX02", { F: 18 }).rows.find(r => r.key === "integer-equilibria")!.value).toBe("9、10");
    oracle(run("MX02", { F: 18 - 1e-10 }), { integerN: 10, integerMinN: 10, integerMaxN: 10 });
    oracle(run("MX02", { F: 18 + 1e-10 }), { integerN: 9, integerMinN: 9, integerMaxN: 9 });
    const loneBoundary = run("MX02", { F: 112.5, A: 40 }); // q(1)=5, profit 12.5−112.5 <0
    expect(value(loneBoundary, "integerN")).toBe(0);
    const one = run("MX02", { F: 12.5, A: 40 });
    oracle(one, { integerN: 1, integerMinN: 0, integerMaxN: 1, incumbentProfit: 0 });
  });
  it("finds the global minimum of AC on an independent quantity grid", () => {
    for (const F of [1, 20, 300]) for (const d of [.2, 1, 5]) {
      const r = run("MX02", { F, d });
      const q = value(r, "qFirm"), p = value(r, "pLR");
      close(F / q + 2 + d * q / 2, p);
      for (let i = 1; i <= 400; i += 1) {
        const gridQ = q * i / 100;
        expect(F / gridQ + 2 + d * gridQ / 2 + 1e-8).toBeGreaterThanOrEqual(p);
      }
      close(2 + d * q, p); // MC=AC at the minimum.
    }
  });
  it("satisfies market clearing and independent short-run profit maximization", () => {
    for (const n of [1, 3, 10, 50]) for (const c of [0, 2, 25]) {
      const r = run("MX02", { n, c });
      const q = value(r, "shortRunFirmQ");
      close(n * q, value(r, "shortRunQ"));
      if (r.metrics.shortRunPrice === null) { expect(q).toBe(0); close(value(r, "shortRunProfit"), -20); continue; }
      const p = value(r, "shortRunPrice");
      close(n * q, Math.max(0, 100 - 5 * p));
      close(q, Math.max(0, p - c));
      for (let i = 0; i <= 200; i += 1) {
        const candidate = Math.max(1, q * 2) * i / 200;
        expect(value(r, "shortRunProfit") + 1e-8).toBeGreaterThanOrEqual(p * candidate - 20 - c * candidate - candidate ** 2 / 2);
      }
    }
  });
  it("keeps physical long-run outcomes invariant under a currency-unit change", () => {
    const base = run("MX02");
    for (const scale of [.1, 2, 10, 1000]) {
      const changed = run("MX02", { F: 20 * scale, c: 2 * scale, d: scale, B: 5 / scale });
      for (const key of ["shortRunQ", "shortRunFirmQ", "qFirm", "QLR", "nLR", "integerN", "integerMinN", "integerMaxN", "integerQ"]) close(value(changed, key), value(base, key));
      for (const key of ["shortRunPrice", "shortRunProfit", "pLR", "profitLR", "integerPrice", "incumbentProfit", "entrantProfit"]) close(value(changed, key), value(base, key) * scale);
    }
  });
  it("does not assign a finite free-entry count when F=0 and positive demand exists", () => {
    const r = run("MX02", { F: 0 });
    oracle(r, { pLR: 2, qFirm: 0, QLR: 90 });
    for (const key of ["nLR", "profitLR", "integerN", "integerMinN", "integerMaxN", "integerPrice", "integerQ", "incumbentProfit", "entrantProfit"]) expect(r.metrics[key], key).toBeNull();
    expect(r.status).toContain("无限进入极限");
    for (const n of [1, 10, 100, 1000000]) {
      const q = 90 / (n + 5);
      expect(q * q / 2).toBeGreaterThan(0);
    }
  });
  it("distinguishes zero market and entry-too-expensive from an actual transaction price", () => {
    for (const A of [0, 5, 10]) {
      const r = run("MX02", { A });
      oracle(r, { shortRunQ: 0, shortRunFirmQ: 0, shortRunProfit: -20, QLR: 0, nLR: 0, integerN: 0, integerQ: 0, entrantProfit: -20 });
      for (const key of ["shortRunPrice", "profitLR", "integerPrice", "incumbentProfit"]) expect(r.metrics[key]).toBeNull();
    }
    const noFixed = run("MX02", { F: 0, A: 0 });
    oracle(noFixed, { nLR: 0, integerN: 0, integerMinN: 0, integerQ: 0, entrantProfit: 0 });
    expect(noFixed.metrics.integerMaxN).toBeNull();
    expect(noFixed.rows.find(r => r.key === "integer-equilibria")!.value).toContain("任何非负整数");
    const costly = run("MX02", { F: 10000 });
    expect(value(costly, "shortRunQ")).toBeGreaterThan(0);
    expect(value(costly, "integerQ")).toBe(0);
    expect(costly.metrics.integerPrice).toBeNull();
  });
  it("graphs market prices and discrete profits as separate groups with truthful points", () => {
    const r = run("MX02");
    for (const line of r.curves) {
      if (line.label.startsWith("市场：反需求")) for (const pt of line.points) close(pt.x, Math.max(0, 100 - 5 * pt.y));
      if (line.label.startsWith("市场：初始")) for (const pt of line.points) close(pt.x, 10 * Math.max(0, pt.y - 2));
      if (line.label.startsWith("利润：各整数")) for (const pt of line.points) { expect(Number.isInteger(pt.x)).toBe(true); close(pt.y, (90 / (pt.x + 5)) ** 2 / 2 - 20); }
    }
  });
  it("rejects invalid cost, demand and noninteger initial firm counts", () => {
    const invalid: ExtensionParameters[] = [{ F: -1 }, { c: -1 }, { d: 0 }, { A: -1 }, { B: 0 }, { n: 0 }, { n: 1.5 }, { n: Number.MAX_SAFE_INTEGER }];
    for (const patch of invalid) expect(() => run("MX02", patch)).toThrow(RangeError);
  });
});

const pointIn = (p: number, q: number, regions: EquilibriumRegion[]) => regions.some(r => p >= r.p[0] && p <= r.p[1] && q >= r.q[0] && q <= r.q[1]);
/** Independent best-response check using both action payoffs separately. */
function noProfitableDeviation(game: ExtensionParameters, p: number, q: number, tolerance = 0): boolean {
  const row0 = q * game.r00 + (1 - q) * game.r01;
  const row1 = q * game.r10 + (1 - q) * game.r11;
  const col0 = p * game.c00 + (1 - p) * game.c10;
  const col1 = p * game.c01 + (1 - p) * game.c11;
  const rowValue = p * row0 + (1 - p) * row1;
  const colValue = q * col0 + (1 - q) * col1;
  return row0 - rowValue <= tolerance && row1 - rowValue <= tolerance && col0 - colValue <= tolerance && col1 - colValue <= tolerance;
}

describe("MX03 complete 2×2 support enumeration", () => {
  it("matches matching pennies, coordination, PD and asymmetric mixing oracles", () => {
    oracle(run("MX03"), { pureCount: 0, mixedCount: 1, mixedP: .5, mixedQ: .5, continuumCount: 0 });
    const coordination = extensionLabDefinitions.find(d => d.id === "MX03")!.presets!.find(p => p.label === "协调")!.parameters;
    oracle(run("MX03", coordination), { pureCount: 2, mixedCount: 1, mixedP: 1 / 3, mixedQ: 1 / 3, continuumCount: 0 });
    const pd = extensionLabDefinitions.find(d => d.id === "MX03")!.presets!.find(p => p.label === "囚徒困境矩阵")!.parameters;
    oracle(run("MX03", pd), { pureCount: 1, mixedCount: 0, continuumCount: 0 });
    expect(run("MX03", pd).metrics.mixedP).toBeNull();
    expect(enumerateEquilibriumRegions({ ...extensionDefaults("MX03"), ...pd })).toEqual([{ p: [0, 0], q: [0, 0] }]);
    oracle(run("MX03", { r00: 1, r10: 0, r01: 0, r11: 3, c00: 0, c01: 3, c10: 1, c11: 0 }), { pureCount: 0, mixedCount: 1, mixedP: .25, mixedQ: .75 });
  });
  it("returns the entire square when all actions tie, without miscounting a continuum", () => {
    const matrix = Object.fromEntries(["00", "01", "10", "11"].flatMap(cell => [[`r${cell}`, 1], [`c${cell}`, 1]]));
    expect(enumerateEquilibriumRegions(matrix)).toEqual([{ p: [0, 1], q: [0, 1] }]);
    const r = run("MX03", matrix);
    oracle(r, { pureCount: 4, continuumCount: 1 });
    expect(r.metrics.mixedCount).toBeNull(); expect(r.metrics.mixedP).toBeNull(); expect(r.metrics.mixedQ).toBeNull();
    expect(r.rows.find(r => r.key === "equilibrium0")!.value).toContain("[0, 1]");
    expect(r.status).toContain("连续概率集合");
  });
  it("preserves semi-mixed continua, crossing solution lines and strict near ties", () => {
    const colDominates = { r00: 0, r01: 0, r10: 0, r11: 0, c00: 1, c01: 0, c10: 1, c11: 0 };
    expect(enumerateEquilibriumRegions(colDominates)).toEqual([{ p: [0, 1], q: [1, 1] }]);
    oracle(run("MX03", colDominates), { pureCount: 2, continuumCount: 1 });
    const cross = { r00: 0, r01: 0, r10: 1, r11: 0, c00: 0, c01: 1, c10: 0, c11: 0 };
    const regions = enumerateEquilibriumRegions(cross);
    expect(regions).toHaveLength(2);
    expect(regions).toEqual(expect.arrayContaining([{ p: [0, 0], q: [0, 1] }, { p: [0, 1], q: [0, 0] }]));
    oracle(run("MX03", cross), { pureCount: 3, continuumCount: 2 });
    const strict = { r00: 1 + 1e-10, r01: 1 + 1e-10, r10: 1, r11: 1, c00: 1, c01: 1, c10: 1, c11: 1 };
    expect(enumerateEquilibriumRegions(strict)).toEqual([{ p: [1, 1], q: [0, 1] }]);
  });
  it("matches every best-response point in all 256 binary-payoff games", () => {
    const keys = ["r00", "c00", "r01", "c01", "r10", "c10", "r11", "c11"];
    for (let mask = 0; mask < 256; mask += 1) {
      const game = Object.fromEntries(keys.map((key, i) => [key, (mask >> i) & 1]));
      const regions = enumerateEquilibriumRegions(game);
      expect(regions.length).toBeGreaterThan(0); // finite game existence.
      for (let i = 0; i <= 16; i += 1) for (let j = 0; j <= 16; j += 1) {
        const p = i / 16, q = j / 16;
        // Binary payoffs and dyadic probabilities make this check exact; no
        // tolerance hides missing boundary ties or erroneous intervals.
        expect(pointIn(p, q, regions), `game ${mask}, (${p},${q})`).toBe(noProfitableDeviation(game, p, q));
      }
      for (const region of regions) {
        for (const p of [region.p[0], (region.p[0] + region.p[1]) / 2, region.p[1]]) for (const q of [region.q[0], (region.q[0] + region.q[1]) / 2, region.q[1]]) expect(noProfitableDeviation(game, p, q)).toBe(true);
      }
      regions.forEach((a, i) => regions.forEach((b, j) => { if (i !== j) expect(a.p[0] >= b.p[0] && a.p[1] <= b.p[1] && a.q[0] >= b.q[0] && a.q[1] <= b.q[1]).toBe(false); }));
    }
  });
  it("checks support corners and interiors of all 6561 ternary-payoff games", () => {
    const keys = ["r00", "c00", "r01", "c01", "r10", "c10", "r11", "c11"];
    for (let code = 0; code < 3 ** 8; code += 1) {
      const game = Object.fromEntries(keys.map((key, i) => [key, Math.floor(code / 3 ** i) % 3 - 1]));
      const regions = enumerateEquilibriumRegions(game);
      expect(regions.length, `game ${code}`).toBeGreaterThan(0);
      for (const r of regions) for (const p of [r.p[0], (r.p[0] + r.p[1]) / 2, r.p[1]]) for (const q of [r.q[0], (r.q[0] + r.q[1]) / 2, r.q[1]]) expect(noProfitableDeviation(game, p, q, 1e-12), `game ${code}, (${p},${q})`).toBe(true);
      for (const p of [0, .25, .5, .75, 1]) for (const q of [0, .25, .5, .75, 1]) expect(pointIn(p, q, regions)).toBe(noProfitableDeviation(game, p, q));
    }
  });
  it("preserves equilibria under each player's positive affine payoff transformation", () => {
    const matrix = { r00: 2, c00: 2, r01: 0, c01: 0, r10: 0, c10: 0, r11: 1, c11: 1 };
    const base = enumerateEquilibriumRegions(matrix);
    const transformed = Object.fromEntries(Object.entries(matrix).map(([key, v]) => [key, key.startsWith("r") ? 3 * v + 7 : 5 * v - 8]));
    expect(enumerateEquilibriumRegions(transformed)).toEqual(base);
  });
});

describe("MX03 grim-trigger is an independent infinite-horizon model", () => {
  it("matches default continuation values and the boundary threshold", () => {
    oracle(run("MX03"), { threshold: .5, cooperationValue: 12, deviationValue: 8, sustainable: 1 });
    oracle(run("MX03", { delta: .5 }), { cooperationValue: 6, deviationValue: 6, sustainable: 1 });
    oracle(run("MX03", { delta: .5 - 1e-10 }), { sustainable: 0 });
    oracle(run("MX03", { delta: .5 + 1e-10 }), { sustainable: 1 });
    oracle(run("MX03", { delta: 0 }), { cooperationValue: 3, deviationValue: 5, sustainable: 0 });
  });
  it("compares continuation values with independently summed discounted paths", () => {
    for (const delta of [0, .2, .5, .75, .95]) {
      const r = run("MX03", { delta });
      let cooperate = 0, deviate = 5, factor = 1;
      for (let t = 0; t < 2000; t += 1) {
        cooperate += factor * 3;
        if (t > 0) deviate += factor;
        factor *= delta;
      }
      close(value(r, "cooperationValue"), cooperate); close(value(r, "deviationValue"), deviate);
      expect(value(r, "sustainable")).toBe(cooperate + 1e-9 >= deviate ? 1 : 0);
    }
  });
  it("does not let a matrix preset alter repeated payoffs or discounting alter stage Nash", () => {
    const changedMatrix = run("MX03", { r00: 3, c00: 3, r01: 0, c01: 5, r10: 5, c10: 0, r11: 1, c11: 1 });
    for (const key of ["threshold", "cooperationValue", "deviationValue", "sustainable"]) close(value(changedMatrix, key), value(run("MX03"), key));
    for (const delta of [0, .25, .75, .99]) for (const key of ["pureCount", "mixedCount", "mixedP", "mixedQ", "continuumCount"]) close(value(run("MX03", { delta }), key), value(run("MX03"), key));
    const text = run("MX03").notes.join(" ");
    for (const scope of ["无限期", "完美监测", "不保证", "有限期", "向后归纳", "相互独立"]) expect(text).toContain(scope);
  });
  it("uses independent best-response lines and actual grim-trigger continuation curves", () => {
    const r = run("MX03");
    for (const line of r.curves) for (const pt of line.points) {
      if (line.label.includes("玩家 1")) close(pt.y, 4 * pt.x - 2);
      if (line.label.includes("玩家 2")) close(pt.y, 2 - 4 * pt.x);
      if (line.label.startsWith("重复博弈：永远")) close(pt.y, 3 / (1 - pt.x));
      if (line.label.startsWith("重复博弈：单次")) close(pt.y, 5 + pt.x / (1 - pt.x));
    }
  });
  it("rejects non-PD payoffs and a unit or negative discount factor", () => {
    const invalid: ExtensionParameters[] = [{ R: 5 }, { P: 3 }, { S: 1 }, { T: 1 }, { delta: -1 }, { delta: 1 }];
    for (const patch of invalid) expect(() => run("MX03", patch)).toThrow(RangeError);
  });
});

describe("extension registry, purity and numerical-domain guards", () => {
  it("provides three complete independent definitions and valid presets", () => {
    expect(extensionLabDefinitions.map(d => d.id)).toEqual([...EXTENSION_LAB_IDS]);
    for (const d of extensionLabDefinitions) {
      expect(Object.keys(d.defaults).sort()).toEqual(d.fields.map(f => f.key).sort());
      expect(new Set(d.fields.map(f => f.key)).size).toBe(d.fields.length);
      for (const f of d.fields) { expect(d.defaults[f.key]).toBeGreaterThanOrEqual(f.min); expect(d.defaults[f.key]).toBeLessThanOrEqual(f.max); }
      const original = extensionDefaults(d.id), frozen = Object.freeze({ ...original });
      const result = runExtensionLab(d.id, frozen);
      expect(frozen).toEqual(original);
      expect(result.status.length).toBeGreaterThan(0); expect(result.rows.length).toBeGreaterThan(0); expect(result.notes.length).toBeGreaterThan(0);
      original[Object.keys(original)[0]] += 1;
      expect(extensionDefaults(d.id)).toEqual(d.defaults);
      for (const preset of d.presets ?? []) expect(() => run(d.id, preset.parameters)).not.toThrow();
    }
  });
  it("rejects missing, unknown, nonfinite and malformed parameters", () => {
    for (const id of EXTENSION_LAB_IDS) {
      const parameters = extensionDefaults(id), key = Object.keys(parameters)[0];
      for (const invalid of [NaN, Infinity, -Infinity]) expect(() => run(id, { [key]: invalid })).toThrow(RangeError);
      expect(() => run(id, { unknown: 1 })).toThrow(/未知参数/);
      delete parameters[key];
      expect(() => runExtensionLab(id, parameters)).toThrow(/缺少参数/);
      for (const input of [null, [], "wrong"]) expect(() => runExtensionLab(id, input as unknown as ExtensionParameters)).toThrow(RangeError);
    }
    expect(() => runExtensionLab("MX99" as ExtensionLabId, {})).toThrow(/未知/);
  });
  it("never returns Infinity/NaN from finite inputs that exceed arithmetic or integer precision", () => {
    expect(() => run("MX01", { m: 1e308, px1: 1e308, px0: 1e-308 })).toThrow(RangeError);
    expect(() => run("MX01", { m: 1e-308, px0: 1e308 })).toThrow(RangeError);
    expect(() => run("MX02", { F: 1e308 })).toThrow(RangeError);
    expect(() => run("MX02", { d: 1e308, B: 1e308, c: 0 })).toThrow(RangeError);
    expect(() => run("MX02", { A: 1e30, F: 1e-10 })).toThrow(RangeError);
    expect(() => run("MX03", { r00: 1e308, r10: -1e308 })).toThrow(RangeError);
    expect(() => run("MX03", { R: 1e308, T: 1.5e308, P: 0, S: -1, delta: .99 })).toThrow(RangeError);
  });
});
