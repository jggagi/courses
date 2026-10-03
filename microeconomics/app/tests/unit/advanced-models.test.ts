import { describe, expect, it } from "vitest";
import { ADVANCED_LAB_IDS, advancedDefaults, advancedLabDefinitions, runAdvancedLab, type AdvancedLabId, type AdvancedParameters, type AdvancedLabResult } from "../../src/models/advanced";

const run = (id: AdvancedLabId, patch: Partial<AdvancedParameters> = {}) => runAdvancedLab(id, { ...advancedDefaults(id), ...patch } as AdvancedParameters);
function value(result: AdvancedLabResult, key: string): number {
  const v = result.metrics[key];
  if (typeof v !== "number") throw new Error(`Expected numeric metric ${key}`);
  return v;
}
function close(actual: number, expected: number): void {
  // Theory oracle absolute/relative tolerance 1e-8; no UI rounding in tests.
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-8 + 1e-8 * Math.abs(expected));
}
function oracle(result: AdvancedLabResult, metrics: Record<string, number>): void {
  for (const [key, expected] of Object.entries(metrics)) close(value(result, key), expected);
}

describe("ML04 costs, shutdown and competitive aggregation", () => {
  it("matches both firm oracles and reconciles the market with individual best responses", () => {
    oracle(run("ML04"), { q: 6, profit: -2, mc: 8, ac: 25 / 3, marketPrice: 8, marketQuantity: 60, marketFirmQ: 6 });
    oracle(run("ML04", { p: 9 }), { q: 7, profit: 4.5 });
    const equilibrium = run("ML04", { n: 20, A: 120, B: 10, c: 3, d: 2 });
    const p = value(equilibrium, "marketPrice"), Q = value(equilibrium, "marketQuantity");
    close(Q, 120 - 10 * p);
    close(Q / 20, value(run("ML04", { p, c: 3, d: 2 }), "q"));
  });
  it("keeps unavoidable F in shutdown profits and distinguishes zero trade prices", () => {
    for (const p of [0, 1, 2]) {
      const r = run("ML04", { p });
      oracle(r, { q: 0, profit: -20, mc: 2, shutdownProfit: -20 });
      expect(r.metrics.ac).toBeNull();
    }
    for (const F of [0, 20, 200]) {
      const r = run("ML04", { F });
      oracle(r, { q: 6, profit: 18 - F, mc: 8 });
      expect(value(r, "profit")).toBeGreaterThanOrEqual(-F);
    }
    for (const A of [10, 20]) {
      const r = run("ML04", { A, B: 10, c: 2 });
      expect(r.metrics.marketPrice).toBeNull();
      close(value(r, "marketQuantity"), 0);
      expect(r.notes.join(" ")).toContain("不唯一");
    }
  });
  it("accepts economic corners but rejects invalid cost domains and fractional enterprise counts", () => {
    for (const patch of [{ F: -1 }, { c: -1 }, { d: 0 }, { p: -1 }, { n: 0 }, { n: 1.5 }, { A: 0 }, { B: 0 }]) expect(() => run("ML04", patch)).toThrow(RangeError);
  });
});

describe("ML05 tax incidence and welfare accounting", () => {
  it("matches all tax oracles including truncation with undefined transaction prices", () => {
    oracle(run("ML05", { tau: 0 }), { q: 40, q0: 40, buyerPrice: 60, sellerPrice: 60, cs: 800, ps: 800, baselineSurplus: 1600, dwl: 0 });
    oracle(run("ML05"), { q: 30, buyerPrice: 70, sellerPrice: 50, taxRevenue: 600, cs: 450, ps: 450, dwl: 100, demandElasticity: -7 / 3 });
    for (const tau of [80, 100, 300]) {
      const r = run("ML05", { tau });
      oracle(r, { q: 0, taxRevenue: 0, cs: 0, ps: 0, dwl: 1600 });
      expect(r.metrics.buyerPrice).toBeNull(); expect(r.metrics.sellerPrice).toBeNull(); expect(r.metrics.demandElasticity).toBeNull();
    }
  });
  it("reconciles tax revenue as a transfer and remains invariant to the statutory payer", () => {
    for (const B of [.25, 1, 3]) for (const D of [.5, 1, 4]) for (const tau of [0, 5, 40, 79, 80, 120]) {
      const r = run("ML05", { B, D, tau });
      close(value(r, "cs") + value(r, "ps") + value(r, "taxRevenue") + value(r, "dwl"), value(r, "baselineSurplus"));
      expect(run("ML05", { B, D, tau, legalPayer: 1 }).metrics).toEqual(r.metrics);
      if (value(r, "q") > 0) close(value(r, "buyerPrice") - value(r, "sellerPrice"), tau);
    }
    const p = advancedDefaults("ML05"); delete p.legalPayer;
    expect(runAdvancedLab("ML05", p).metrics).toEqual(run("ML05").metrics);
  });
  it("rejects domain violations rather than turning an invalid market into zero trade", () => {
    for (const patch of [{ A: 20 }, { B: 0 }, { C: -1 }, { D: -1 }, { tau: -1 }, { legalPayer: .5 }]) expect(() => run("ML05", patch)).toThrow(RangeError);
  });
});

describe("ML06 monopoly conditional on operation and fixed resource costs", () => {
  it("matches competition/monopoly oracles and deducts F exactly once from resource surplus", () => {
    oracle(run("ML06", { F: 0 }), { competitiveQ: 80, competitivePrice: 20, monopolyQ: 40, monopolyPrice: 60, mr: 20, profit: 1600, cs: 800, competitiveSurplus: 3200, monopolySurplus: 2400, dwl: 800 });
    const base = run("ML06", { F: 20 }), large = run("ML06", { F: 1800 });
    for (const key of ["monopolyQ", "monopolyPrice", "competitiveQ", "competitivePrice", "dwl"]) close(value(base, key), value(large, key));
    close(value(base, "profit") - value(large, "profit"), 1780);
    for (const r of [base, large]) {
      close(value(r, "profit") + value(r, "cs"), value(r, "monopolySurplus"));
      close(value(r, "competitiveProfit") + value(r, "competitiveCS"), value(r, "competitiveSurplus"));
      close(value(r, "competitiveSurplus") - value(r, "monopolySurplus"), value(r, "dwl"));
    }
    expect(large.status).toContain("条件于运营");
  });
  it("finds the global profit maximum against an independent quantity grid and differentiates revenue", () => {
    for (const p of [{ a: 100, b: 1, c: 20, F: 20 }, { a: 47, b: 2.3, c: 7, F: 300 }]) {
      const r = run("ML06", p), q = value(r, "monopolyQ"), h = 1e-4;
      const revenue = (Q: number) => (p.a - p.b * Q) * Q;
      close((revenue(q + h) - revenue(q - h)) / (2 * h), p.c);
      for (let i = 0; i <= 400; i += 1) {
        const gridQ = p.a / p.b * i / 400;
        const profit = revenue(gridQ) - p.c * gridQ - p.F;
        expect(value(r, "profit") + 1e-8).toBeGreaterThanOrEqual(profit);
      }
      expect(r.curves.find(line => line.label.includes("MR"))!.points.some(point => point.y < 0)).toBe(true);
    }
  });
  it("does not silently extend an inner-operation formula to an invalid demand/cost domain", () => {
    for (const patch of [{ a: 20 }, { b: 0 }, { c: -1 }, { F: -1 }]) expect(() => run("ML06", patch)).toThrow(RangeError);
  });
});

describe("ML07 strategic best responses and Pareto layers", () => {
  it("finds one, two and zero pure equilibria in the three prescribed matrices", () => {
    oracle(run("ML07"), { equilibriumCount: 1, paretoImprovementCount: 1 });
    expect(run("ML07").rows.find(r => r.key === "equilibria")!.value).toBe("11");
    const definition = advancedLabDefinitions.find(d => d.id === "ML07")!;
    const coordination = run("ML07", definition.presets!.find(p => p.label === "协调")!.parameters);
    oracle(coordination, { equilibriumCount: 2, paretoImprovementCount: 5 });
    expect(coordination.rows.find(r => r.key === "equilibria")!.value).toBe("00、11");
    oracle(run("ML07", definition.presets!.find(p => p.label === "正反面零和")!.parameters), { equilibriumCount: 0, paretoImprovementCount: 0 });
  });
  it("preserves every tie and distinguishes unilateral incentives from collective improvements", () => {
    const tied = run("ML07", { r00: 1, c00: 1, r01: 1, c01: 1, r10: 1, c10: 1, r11: 1, c11: 1 });
    oracle(tied, { equilibriumCount: 4, paretoImprovementCount: 0 });
    expect(tied.rows.find(r => r.key === "equilibria")!.value).toBe("00、01、10、11");
    const pd = run("ML07");
    expect(pd.rows.find(r => r.key === "pareto")!.value).toBe("11→00");
    expect(pd.rows.find(r => r.key === "cell00")!.value).toContain("非 Nash");
    // One player's near-tie is a genuine strict payoff difference, not a
    // rounded tie based on displayed decimals.
    const strict = run("ML07", { r00: 1, c00: 1, r01: 1, c01: 1, r10: 1 + 1e-10, c10: 1, r11: 1, c11: 1 });
    expect(value(strict, "equilibriumCount")).toBe(3);
  });
  it("enumerates all-best-response intersections in all 256 binary-payoff games", () => {
    const keys = Object.keys(advancedDefaults("ML07"));
    for (let mask = 0; mask < 256; mask += 1) {
      const p = Object.fromEntries(keys.map((key, i) => [key, (mask >> i) & 1]));
      // Independent deviation criterion: no player has a strictly profitable
      // unilateral deviation at the returned equilibrium.
      let count = 0;
      for (let i = 0; i < 2; i += 1) for (let j = 0; j < 2; j += 1) {
        const unilateralGain1 = p[`r${1 - i}${j}`] - p[`r${i}${j}`];
        const unilateralGain2 = p[`c${i}${1 - j}`] - p[`c${i}${j}`];
        if (unilateralGain1 <= 0 && unilateralGain2 <= 0) count += 1;
      }
      close(value(run("ML07", p), "equilibriumCount"), count);
    }
  });
});

describe("ML08 external damage and corrective policies", () => {
  it("matches the private/social quantity and corrective-tax oracles", () => {
    oracle(run("ML08"), { privateQ: 40, socialQ: 20, correctiveTax: 40, policyQ: 20, privateWelfare: 0, socialWelfare: 800, policyWelfare: 800, privateAccountedSurplus: 1600, policyTaxRevenue: 800 });
    oracle(run("ML08", { e: 0, tau: 0 }), { privateQ: 40, socialQ: 40, correctiveTax: 0, policyQ: 40, privateWelfare: 1600, socialWelfare: 1600, policyWelfare: 1600 });
    oracle(run("ML08", { tau: 80 }), { policyQ: 0, policyWelfare: 0, policyTaxRevenue: 0 });
  });
  it("derives welfare from independent integrals and shows optimal correction dominates the private outcome", () => {
    for (const e of [0, .2, 1, 2, 5]) {
      const base = run("ML08", { e });
      const fixed = run("ML08", { e, tau: value(base, "correctiveTax") });
      close(value(fixed, "policyQ"), value(base, "socialQ"));
      expect(value(fixed, "policyWelfare") + 1e-8).toBeGreaterThanOrEqual(value(base, "privateWelfare"));
      const q = value(fixed, "policyQ");
      const demandIntegral = 100 * q - q * q / 2;
      const resourceCostIntegral = 20 * q + q * q / 2;
      const externalDamageIntegral = e * q * q / 2;
      close(value(fixed, "policyWelfare"), demandIntegral - resourceCostIntegral - externalDamageIntegral);
      // A levy is a transfer and not an additional resource cost.
      close(value(fixed, "policyWelfare"), (100 - q) * q - (20 * q + q * q / 2) + q * q / 2 - externalDamageIntegral);
    }
  });
  it("rejects negative damage and invalid underlying markets", () => {
    expect(() => run("ML08", { e: -1 })).toThrow(RangeError);
    expect(() => run("ML08", { A: 20 })).toThrow(RangeError);
    expect(() => run("ML08", { tau: -1 })).toThrow(RangeError);
  });
});

describe("ML09 explicit quality beliefs, participation and verification fees", () => {
  it("reveals every default belief round rather than jumping directly to the result", () => {
    const r = run("ML09");
    oracle(r, { initialPrice: 6, finalPrice: 4, highParticipates: 0, lowParticipates: 1, certifiedHighNet: 3, certifiedLowNet: 1 });
    expect(r.rows.find(row => row.key === "belief0")!.value).toBe(.25);
    expect(r.rows.find(row => row.key === "price0")!.value).toBe(6);
    expect(r.rows.find(row => row.key === "participation0")!.value).toContain("高质量：拒绝");
    expect(r.rows.find(row => row.key === "belief1")!.value).toBe(0);
    expect(r.rows.find(row => row.key === "price1")!.value).toBe(4);
    expect(r.notes.join(" ")).toContain("不是全部信念自洽均衡");
  });
  it("accepts at equal reservation thresholds and handles absent types/complete shutdown", () => {
    oracle(run("ML09", { theta: .5 }), { initialPrice: 8, finalPrice: 8, highParticipates: 1, lowParticipates: 1 });
    oracle(run("ML09", { theta: 0 }), { initialPrice: 4, finalPrice: 4, highParticipates: 0, lowParticipates: 1 });
    oracle(run("ML09", { theta: 1 }), { initialPrice: 12, finalPrice: 12, highParticipates: 1, lowParticipates: 0 });
    const absent = run("ML09", { sL: 13, sH: 15 });
    expect(absent.metrics.finalPrice).toBeNull();
    oracle(absent, { highParticipates: 0, lowParticipates: 0 });
    expect(absent.rows.find(row => row.key === "participation1")!.value).toContain("没有卖方");
  });
  it("deducts certification fees from reservation-relative gains and permits refusing verification", () => {
    oracle(run("ML09", { certificationFee: 5 }), { certifiedHighNet: -1, certifiedLowNet: -3 });
    expect(run("ML09", { certificationFee: 5 }).rows.find(r => r.key === "certification-participation")!.value).toBe("高质量拒绝；低质量拒绝");
    oracle(run("ML09", { certificationFee: 4 }), { certifiedHighNet: 0 });
    expect(run("ML09", { certificationFee: 4 }).rows.find(r => r.key === "certification-participation")!.value).toContain("高质量接受");
    for (const patch of [{ theta: 1.1 }, { theta: -1 }, { sL: 9 }, { vH: 3 }, { certificationFee: -1 }]) expect(() => run("ML09", patch)).toThrow(RangeError);
  });
});

describe("ML10 separate risk, cross-period and labor models", () => {
  it("matches risk, balanced-income, borrowing and no-borrowing numerical oracles", () => {
    oracle(run("ML10"), { expectedWealth: 50, expectedUtility: 5, certaintyEquivalent: 25, riskPremium: 25, c1: 100, c2: 100, borrowing: 80, leisure: 14, labor: 10, laborConsumption: 140 });
    oracle(run("ML10", { y1: 100, y2: 100 }), { c1: 100, c2: 100, borrowing: 0 });
    oracle(run("ML10", { noBorrow: 1 }), { c1: 20, c2: 180, borrowing: 0 });
    for (const probHigh of [0, 1]) close(value(run("ML10", { probHigh }), "riskPremium"), 0);
    oracle(run("ML10", { wLow: 50, wHigh: 50 }), { expectedWealth: 50, certaintyEquivalent: 50, riskPremium: 0 });
  });
  it("satisfies present-value budgets and does not clip the constrained second-period choice", () => {
    for (const r of [-.8, 0, .3]) for (const beta of [.2, 1, 3]) for (const noBorrow of [0, 1]) {
      const result = run("ML10", { r, beta, noBorrow });
      const c1 = value(result, "c1"), c2 = value(result, "c2");
      close(c1 + c2 / (1 + r), 20 + 180 / (1 + r));
      expect(c1).toBeGreaterThan(0); expect(c2).toBeGreaterThan(0);
      if (noBorrow) expect(c1).toBeLessThanOrEqual(20);
      else close(c2 / c1, beta * (1 + r));
    }
    oracle(run("ML10", { y1: 180, y2: 20, noBorrow: 1 }), { c1: 100, c2: 100, borrowing: -80 });
    oracle(run("ML10", { y1: 100, y2: 0, noBorrow: 1 }), { c1: 50, c2: 50 });
  });
  it("reports empty log domains explicitly while preserving independent valid panels", () => {
    for (const patch of [{ y1: 0, y2: 0 }, { y1: 0, y2: 180, noBorrow: 1 }]) {
      const r = run("ML10", patch);
      for (const key of ["c1", "c2", "borrowing", "intertemporalUtility"]) expect(r.metrics[key]).toBeNull();
      close(value(r, "riskPremium"), 25);
      close(value(r, "labor"), 10);
      expect(r.notes.join(" ")).toContain("不能取 log(0)");
    }
    const noConsumption = run("ML10", { wage: 0, nonLabor: 0 });
    expect(noConsumption.metrics.laborUtility).toBeNull(); expect(noConsumption.metrics.labor).toBeNull(); close(value(noConsumption, "laborConsumption"), 0);
    const noTime = run("ML10", { T: 0 });
    expect(noTime.metrics.leisure).toBeNull(); expect(noTime.metrics.laborUtility).toBeNull();
  });
  it("solves labor corners and compares interior choice with independent feasible-grid utility", () => {
    oracle(run("ML10", { nonLabor: 300 }), { leisure: 24, labor: 0, laborConsumption: 300 });
    oracle(run("ML10", { wage: 0, nonLabor: 40 }), { leisure: 24, labor: 0, laborConsumption: 40 });
    oracle(run("ML10", { nonLabor: 0 }), { leisure: 12, labor: 12, laborConsumption: 120 });
    for (const alpha of [.2, .5, .8]) {
      const r = run("ML10", { leisureWeight: alpha });
      close(value(r, "leisure") + value(r, "labor"), 24);
      close(value(r, "laborConsumption"), 40 + 10 * value(r, "labor"));
      for (let i = 1; i <= 240; i += 1) {
        const l = i / 10, consumption = 40 + 10 * (24 - l);
        const u = (1 - alpha) * Math.log(consumption) + alpha * Math.log(l);
        expect(value(r, "laborUtility") + 1e-8).toBeGreaterThanOrEqual(u);
      }
    }
  });
  it("keeps expected-utility transformations distinct from deterministic ordinal transformations", () => {
    // Lottery A={0,100}/2 has EU=5; sure B=30 has sqrt(30)>5.
    // Squaring u before taking expectations instead reverses the ordering.
    const a = run("ML10"), b = run("ML10", { wLow: 30, wHigh: 30 });
    expect(value(a, "expectedUtility")).toBeLessThan(value(b, "expectedUtility"));
    expect(value(a, "expectedWealth")).toBeGreaterThan(value(b, "expectedWealth"));
    for (const patch of [{ wLow: -1 }, { wHigh: -1 }, { wLow: 110 }, { probHigh: 1.1 }, { y1: -1 }, { r: -1 }, { beta: 0 }, { noBorrow: .5 }, { T: -1 }, { wage: -1 }, { leisureWeight: 0 }, { leisureWeight: 1 }]) expect(() => run("ML10", patch)).toThrow(RangeError);
  });
});

describe("ML11 comparative advantage, feasibility and trade conservation", () => {
  it("matches the default production, opportunity-cost and consumption oracles", () => {
    oracle(run("ML11"), { opportunityA: .5, opportunityB: 1, tradeY: 30, consumeAx: 80, consumeAy: 30, consumeBx: 40, consumeBy: 10, worldX: 120, worldY: 40, usedLaborA: 120, usedLaborB: 120, autarkyLaborForAConsumption: 140, autarkyLaborForBConsumption: 150 });
    expect(run("ML11").curves.map(c => c.label)).toEqual(["A PPF（生产边界）", "A CPF（有限双边贸易）", "B PPF（生产边界）", "B CPF（有限双边贸易）"]);
  });
  it("identifies weak trade-price endpoints without claiming strict gains for both economies", () => {
    const lower = run("ML11", { price: .5 });
    close(value(lower, "autarkyLaborForAConsumption"), 120);
    expect(value(lower, "autarkyLaborForBConsumption")).toBeGreaterThan(120);
    const upper = run("ML11", { price: 1 });
    close(value(upper, "autarkyLaborForBConsumption"), 120);
    expect(value(upper, "autarkyLaborForAConsumption")).toBeGreaterThan(120);
    for (const r of [lower, upper]) expect(r.status).toContain("弱");
    const outside = run("ML11", { price: .25 });
    expect(outside.status).toContain("区间外");
    expect(value(outside, "autarkyLaborForAConsumption")).toBeLessThan(120);
  });
  it("reverses specialization and signed exchange when comparative advantage reverses", () => {
    const r = run("ML11", { ax: 3, ay: 3, bx: 1, by: 2, tradeX: -40 });
    oracle(r, { opportunityA: 1, opportunityB: .5, tradeY: -30, produceAx: 0, produceAy: 40, produceBx: 120, produceBy: 0, consumeAx: 40, consumeAy: 10, consumeBx: 80, consumeBy: 30 });
    expect(r.notes[0]).toContain("B 产 x、A 产 y");
    expect(() => run("ML11", { ax: 3, ay: 3, bx: 1, by: 2, tradeX: 40 })).toThrow(/tradeX≤0/);
  });
  it("conserves both world goods and resource use at every feasible trade amount", () => {
    for (const price of [.5, .75, 1, 1.5]) {
      const limit = value(run("ML11", { price, tradeX: 0 }), "maxTradeX");
      for (const share of [0, .2, .5, 1]) {
        const r = run("ML11", { price, tradeX: share * limit });
        close(value(r, "consumeAx") + value(r, "consumeBx"), value(r, "worldX"));
        close(value(r, "consumeAy") + value(r, "consumeBy"), value(r, "worldY"));
        for (const key of ["consumeAx", "consumeAy", "consumeBx", "consumeBy"]) expect(value(r, key)).toBeGreaterThanOrEqual(-1e-8);
        close(value(r, "usedLaborA"), 120); close(value(r, "usedLaborB"), 120);
        for (const line of r.curves) for (const point of line.points) expect(Math.min(point.x, point.y)).toBeGreaterThanOrEqual(-1e-8);
      }
    }
  });
  it("handles equal opportunity costs, zero resources and rejects infeasible transfers without clamping", () => {
    expect(run("ML11", { ax: 2, ay: 2, price: 1 }).status).toContain("没有严格");
    oracle(run("ML11", { laborA: 0, laborB: 0, tradeX: 0 }), { consumeAx: 0, consumeAy: 0, consumeBx: 0, consumeBy: 0, worldX: 0, worldY: 0 });
    for (const patch of [{ laborA: -1 }, { ax: 0 }, { by: 0 }, { price: 0 }, { tradeX: -1 }, { tradeX: 60 }]) expect(() => run("ML11", patch)).toThrow(RangeError);
  });
});

describe("advanced pure API consistency and numerical-domain guards", () => {
  it("offers eight unique complete definitions, independent default copies and valid preset results", () => {
    expect(advancedLabDefinitions.map(d => d.id)).toEqual([...ADVANCED_LAB_IDS]);
    for (const d of advancedLabDefinitions) {
      expect(Object.keys(d.defaults).sort()).toEqual(d.fields.map(f => f.key).sort());
      expect(new Set(d.fields.map(f => f.key)).size).toBe(d.fields.length);
      for (const f of d.fields) expect(d.defaults[f.key]).toBeGreaterThanOrEqual(f.min);
      for (const f of d.fields) expect(d.defaults[f.key]).toBeLessThanOrEqual(f.max);
      const defaults = advancedDefaults(d.id), frozen = Object.freeze({ ...defaults });
      const r = runAdvancedLab(d.id, frozen);
      expect(r.status.length).toBeGreaterThan(0); expect(r.notes.length).toBeGreaterThan(0); expect(r.rows.length).toBeGreaterThan(0);
      expect(frozen).toEqual(defaults);
      defaults[Object.keys(defaults)[0]] += 1;
      expect(advancedDefaults(d.id)).toEqual(d.defaults);
      for (const preset of d.presets ?? []) expect(() => run(d.id, preset.parameters)).not.toThrow();
    }
  });
  it("rejects missing, unknown, nonfinite inputs and arithmetic overflow before rendering", () => {
    for (const id of ADVANCED_LAB_IDS) {
      const defaults = advancedDefaults(id), key = Object.keys(defaults)[0];
      for (const invalid of [NaN, Infinity, -Infinity]) expect(() => run(id, { [key]: invalid })).toThrow(RangeError);
      expect(() => run(id, { unexpected: 1 })).toThrow(/未知参数/);
      delete defaults[key];
      expect(() => runAdvancedLab(id, defaults)).toThrow(/缺少参数/);
    }
    expect(() => runAdvancedLab("ML99" as AdvancedLabId, {})).toThrow(/未知/);
    expect(() => runAdvancedLab("ML04", null as unknown as AdvancedParameters)).toThrow(RangeError);
    expect(() => run("ML04", { p: 1e308, d: .1 })).toThrow(RangeError);
    expect(() => run("ML05", { A: 1e308, B: 1e-308 })).toThrow(RangeError);
  });
});
