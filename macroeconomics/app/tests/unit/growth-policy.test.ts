import { describe, expect, it } from "vitest";
import {
  defaultGrowthParameters,
  simulateGrowth,
  type GrowthParameters,
} from "../../src/models/growth";
import {
  defaultSpendingParameters,
  simulateSpending,
  type SpendingParameters,
} from "../../src/models/spending";
import {
  defaultPolicyParameters,
  simulatePolicy,
  type PolicyParameters,
} from "../../src/models/policy";

const growth = (patch: Partial<GrowthParameters> = {}) =>
  simulateGrowth({ ...defaultGrowthParameters(), ...patch });
const spending = (patch: Partial<SpendingParameters> = {}) =>
  simulateSpending({ ...defaultSpendingParameters(), ...patch });
const policy = (patch: Partial<PolicyParameters> = {}) =>
  simulatePolicy({ ...defaultPolicyParameters(), ...patch });

describe("LA04 总量积累、每工人过渡与固定A稳态", () => {
  it("独立oracle: k0=1,k1=1.1;固定A稳态4/2/1.6", () => {
    const result = growth();
    expect(result.periods[0]).toMatchObject({
      K: 1,
      L: 1,
      Y: 1,
      k: 1,
      y: 1,
      c: 0.8,
      KNext: 1.1,
      kNext: 1.1,
    });
    expect(result.periods[1].k).toBeCloseTo(1.1, 8);
    expect(result.periods[1].Y).toBeCloseTo(Math.sqrt(1.1), 8);
    expect(result.steadyState).toEqual({
      A: 1,
      k: 4,
      y: 2,
      c: 1.6,
      appliesFromPeriod: 0,
    });
    expect(result.periods[0].gY).toBeNull();
    expect(result.periods[0].gy).toBeNull();
  });

  it("s=.4的稳态为16/4/2.4，过渡路径不会瞬间跳至稳态", () => {
    const result = growth({ s: 0.4, periods: 200 });
    expect(result.steadyState).toEqual({
      A: 1,
      k: 16,
      y: 4,
      c: 2.4,
      appliesFromPeriod: 0,
    });
    expect(result.periods[1].k).toBeCloseTo(1.3, 8);
    expect(result.periods[1].k).not.toBe(16);
    expect(result.periods[200].k).toBeGreaterThan(15.9);
    expect(result.periods[200].gy!).toBeLessThan(0.0001);
  });

  it("更高储蓄率能提高稳态产出，却不保证提高稳态消费", () => {
    const high = growth({ s: 0.95 });
    expect(high.steadyState!.y).toBeGreaterThan(growth().steadyState!.y);
    expect(high.steadyState!.c).toBeCloseTo(0.475, 8);
    expect(high.steadyState!.c).toBeLessThan(growth().steadyState!.c);
    expect(high.periods[0].c).toBeCloseTo(0.05, 8);
  });

  it("总量与每工人积累独立一致，投资与折旧来自同一期产出和资本", () => {
    const params = {
      ...defaultGrowthParameters(),
      A: 1.2,
      alpha: 0.3,
      K0: 13,
      L0: 7,
      n: 0.03,
      s: 0.25,
      delta: 0.08,
    };
    const result = simulateGrowth(params);
    for (const row of result.periods) {
      expect(row.Y).toBeCloseTo(
        row.A * row.K ** params.alpha * row.L ** (1 - params.alpha),
        8,
      );
      expect(row.y).toBeCloseTo(row.Y / row.L, 8);
      expect(row.kNext).toBeCloseTo(
        ((1 - params.delta) * row.k +
          params.s * row.A * row.k ** params.alpha) /
          (1 + params.n),
        8,
      );
      expect(row.KNext).toBeCloseTo(
        row.K - row.depreciation + row.investment,
        8,
      );
      expect(row.LNext).toBeCloseTo((1 + params.n) * row.L, 8);
      expect(row.KNext / row.LNext).toBeCloseTo(row.kNext, 8);
      expect(row.c + params.s * row.y).toBeCloseTo(row.y, 8);
    }
    result.periods.slice(1).forEach((row, index) => {
      expect(row.K).toBe(result.periods[index].KNext);
      expect(row.L).toBe(result.periods[index].LNext);
      expect(1 + row.gY!).toBeCloseTo((1 + row.gy!) * (1 + params.n), 8);
    });
  });

  it("人口增长下每工人固定点成立，总量仍按人口增速增长", () => {
    const params = { ...defaultGrowthParameters(), n: 0.1, K0: 1, L0: 1 };
    // Independent calculation: (.2/(.1+.1))^2 = 1.
    const result = simulateGrowth(params);
    expect(result.steadyState?.k).toBe(1);
    expect(result.periods[1]).toMatchObject({ K: 1.1, L: 1.1, k: 1 });
    expect(result.periods[1].gy).toBeCloseTo(0, 8);
    expect(result.periods[1].gY).toBeCloseTo(0.1, 8);
  });

  it("一次技术水平变化只在指定期发生，稳态参考使用新A", () => {
    const result = growth({
      K0: 4,
      technologyShock: 1.2,
      shockPeriod: 2,
      periods: 4,
    });
    expect(result.periods[0].A).toBe(1);
    expect(result.periods[1].A).toBe(1);
    expect(result.periods[2].A).toBe(1.2);
    expect(result.periods[2].y).toBeCloseTo(2.4, 8);
    expect(result.periods[3].A).toBe(1.2);
    expect(result.steadyState?.k).toBeCloseTo(5.76, 8);
    expect(result.steadyState?.appliesFromPeriod).toBe(2);
  });

  it("持续技术趋势与一次水平变化分别生效，不能显示固定A稳态", () => {
    const result = growth({
      technologyGrowth: 0.02,
      technologyShock: 1.5,
      shockPeriod: 2,
      periods: 3,
    });
    expect(result.periods.map((row) => row.A)).toEqual([
      1,
      1.02,
      1.02 ** 2 * 1.5,
      1.02 ** 3 * 1.5,
    ]);
    expect(result.steadyState).toBeNull();
    expect(result.steadyStateReason).toContain("不能沿用固定A");
    expect(growth({ technologyGrowth: -0.1 }).steadyState).toBeNull();
  });

  it("零储蓄与全部折旧时下一期产出为0，此后增长未定义；不虚构资本", () => {
    const result = growth({ s: 0, delta: 1, periods: 3 });
    expect(result.steadyState?.k).toBe(0);
    expect(result.periods.map((row) => row.k)).toEqual([1, 0, 0, 0]);
    expect(result.periods[1].gy).toBe(-1);
    expect(result.periods[2].gy).toBeNull();
    const absorbing = growth({ K0: 0 });
    expect(absorbing.periods.every((row) => row.Y === 0 && row.K === 0)).toBe(
      true,
    );
    expect(absorbing.steadyStateReason).toContain("零资本吸收态");
  });

  it.each([
    { alpha: 0 },
    { alpha: 1 },
    { s: 1 },
    { delta: 0 },
    { delta: 1.01 },
    { n: -0.01 },
    { K0: -1 },
    { L0: 0 },
    { A: 0 },
    { technologyShock: 0 },
    { technologyGrowth: -1 },
    { periods: 0 },
    { periods: 201 },
    { periods: 1.5 },
    { shockPeriod: 0 },
    { shockPeriod: 31 },
    { shockPeriod: 1.5 },
  ])("拒绝域外参数 %j 而不裁剪", (patch) =>
    expect(() => growth(patch)).toThrow(),
  );

  it("所有原始数值必须有限且类型正确，溢出与精度不足明确报错", () => {
    for (const key of Object.keys(
      defaultGrowthParameters(),
    ) as (keyof GrowthParameters)[])
      for (const invalid of [
        NaN,
        Infinity,
        -Infinity,
        "1",
        null,
        1_000_000_001,
      ])
        expect(() => growth({ [key]: invalid } as never)).toThrow();
    expect(() => growth({ n: 1e9, periods: 200 })).toThrow("有限");
    expect(() =>
      growth({ technologyGrowth: -0.999999999999, periods: 200 }),
    ).toThrow("精度");
    expect(() => growth({ alpha: 1 - Number.EPSILON })).toThrow("有限");
  });
});

describe("LA05 计划支出、调整与实现后的恒等式", () => {
  it("默认均衡oracle170/110/40/−10/30，乘数2.5", () => {
    const result = spending();
    expect(result.equilibrium).toEqual({
      Y: 170,
      C: 110,
      privateSaving: 40,
      governmentSaving: -10,
      nationalSaving: 30,
    });
    expect(result.multiplier).toBe(2.5);
    expect(result.periods[0]).toMatchObject({
      Y: 100,
      C: 68,
      Z: 128,
      unplannedInventory: -28,
      actualInvestment: 2,
      YNext: 114,
    });
  });

  it("政府购买G40令Y195；C0降为10令Y145而实现国民储蓄仍30", () => {
    expect(spending({ G: 40 }).equilibrium.Y).toBe(195);
    const thrift = spending({ C0: 10 });
    expect(thrift.equilibrium.Y).toBe(145);
    expect(thrift.equilibrium.C).toBe(85);
    expect(thrift.equilibrium.nationalSaving).toBe(30);
    expect(thrift.equilibrium.privateSaving).toBe(40);
    expect(spending({ I0: 35 }).equilibrium.Y).toBe(182.5);
  });

  it("每期独立对账：实际投资含非计划存货，S=I从未暂时失效", () => {
    for (const patch of [
      {},
      { G: 40, Y0: 220 },
      { C0: 10 },
      { c: 0.3, eta: 1 },
    ]) {
      const params = { ...defaultSpendingParameters(), ...patch };
      const result = simulateSpending(params);
      for (const row of result.periods) {
        expect(row.C).toBeCloseTo(params.C0 + params.c * (row.Y - params.T), 8);
        expect(row.unplannedInventory).toBeCloseTo(
          row.Y - row.C - params.I0 - params.G,
          8,
        );
        expect(row.Y).toBeCloseTo(row.C + row.actualInvestment + params.G, 8);
        expect(row.nationalSaving).toBeCloseTo(row.actualInvestment, 8);
        expect(row.privateSaving + row.governmentSaving).toBeCloseTo(
          row.nationalSaving,
          8,
        );
        expect(row.YNext).toBeCloseTo(
          (1 - params.eta) * row.Y + params.eta * row.Z,
          8,
        );
      }
      result.periods
        .slice(1)
        .forEach((row, index) =>
          expect(row.Y).toBe(result.periods[index].YNext),
        );
    }
  });

  it("有限调整误差按1−eta(1−c)衰减；不是瞬间跳到均衡", () => {
    const result = spending({ eta: 0.5, periods: 3 });
    // Y0=100; equilibrium170; transition error multiplier=.8.
    expect(result.periods.map((row) => row.Y)).toEqual([
      100, 114, 125.2, 134.16,
    ]);
    expect(result.periods[1].Y).not.toBe(result.equilibrium.Y);
    expect(spending({ periods: 200 }).periods[200].Y).toBeCloseTo(170, 8);
  });

  it("c=0、零支出和零产出是合法角点；负实际投资是存货流量不是负生产", () => {
    const zero = spending({ C0: 0, c: 0, T: 0, I0: 0, G: 0, Y0: 0 });
    expect(zero.equilibrium.Y).toBe(0);
    expect(
      zero.periods.every((row) => row.Y === 0 && row.actualInvestment === 0),
    ).toBe(true);
    const drawdown = spending({ Y0: 50 });
    expect(drawdown.periods[0].actualInvestment).toBe(-18);
    expect(drawdown.assumptions).toContain("期初库存");
    expect(spending({ c: 0, eta: 1 }).periods[1].Y).toBe(80);
  });

  it.each([
    { c: 1 },
    { c: -0.1 },
    { eta: 0 },
    { eta: 1.01 },
    { C0: -1 },
    { I0: -1 },
    { G: -1 },
    { T: -1 },
    { Y0: -1 },
    { periods: 0 },
    { periods: 201 },
    { periods: 2.1 },
    // Nonnegative raw parameters can still imply negative equilibrium or consumption.
    { C0: 0, T: 1_000 },
    { C0: 0, Y0: 0 },
  ])("拒绝非法或不可行情景 %j", (patch) =>
    expect(() => spending(patch)).toThrow(),
  );

  it("所有原始数值必须有限；巨大乘数导致不可可靠对账不能伪造S=I", () => {
    for (const key of Object.keys(
      defaultSpendingParameters(),
    ) as (keyof SpendingParameters)[])
      for (const invalid of [NaN, Infinity, "1", null, 1_000_000_001])
        expect(() => spending({ [key]: invalid } as never)).toThrow();
    expect(() => spending({ c: 1 - Number.EPSILON, C0: 1e9, I0: 31 })).toThrow(
      "对账",
    );
  });
});

describe("LA06 需求、供给、滞后利率与适应性预期", () => {
  it("需求冲击第1期独立oracle1/2.25/2.125/3.875", () => {
    const result = policy({ periods: 2 });
    expect(result.periods[0]).toMatchObject({
      x: 0,
      pi: 2,
      expectedPi: 2,
      i: 3,
    });
    expect(result.periods[1]).toMatchObject({
      x: 1,
      pi: 2.25,
      expectedPi: 2.125,
      i: 3.875,
    });
    expect(result.periods[2]).toMatchObject({
      x: 0.125,
      pi: 2.15625,
      expectedPi: 2.140625,
      i: 3.296875,
    });
    expect(result.status).toBe("completed");
    expect(result.stoppedAtPeriod).toBeNull();
    expect(result.stability.classification).toBe("stable");
  });

  it("纯成本冲击当期x不变，下一期政策才传导；第二期oracle−.5/2.375/2.4375/3.3125", () => {
    const result = policy({ demandShock: 0, supplyShock: 1, periods: 2 });
    expect(result.periods[1]).toMatchObject({
      x: 0,
      pi: 3,
      expectedPi: 2.5,
      i: 4.5,
    });
    expect(result.periods[2]).toMatchObject({
      x: -0.5,
      pi: 2.375,
      expectedPi: 2.4375,
      i: 3.3125,
    });
  });

  it("无冲击保持百分数基准，不把2%转换成.02后混用", () => {
    const rows = policy({ demandShock: 0, supplyShock: 0 }).periods;
    expect(
      rows.every(
        (row) =>
          row.x === 0 &&
          row.pi === 2 &&
          row.expectedPi === 2 &&
          row.i === 3 &&
          row.realRate === 1,
      ),
    ).toBe(true);
    expect(rows.every((row) => !row.lowerBoundBinding)).toBe(true);
  });

  it("政策系数改变当期利率却不偷改当期产出；下期差异才出现", () => {
    const baseline = policy({ periods: 2 }).periods;
    const stronger = policy({ phiPi: 9, periods: 2 }).periods;
    expect(stronger[1].x).toBe(baseline[1].x);
    expect(stronger[1].pi).toBe(baseline[1].pi);
    expect(stronger[1].i).toBe(5.75);
    expect(stronger[2].x).toBe(-0.8125);
  });

  it("冲击起始期与持续时间有精确边界，结束后不得继续注入", () => {
    const rows = policy({
      shockPeriod: 2,
      shockDuration: 2,
      periods: 5,
    }).periods;
    expect(rows.map((row) => row.demandShock)).toEqual([0, 0, 1, 1, 0, 0]);
    expect(rows[1].x).toBe(0);
    expect(rows[2].x).toBe(1);
    expect(rows[3].x).toBe(1.125);
  });

  it("每期按四条方程的规定次序计算，预期和百分数口径同一内核", () => {
    const params = {
      ...defaultPolicyParameters(),
      rho: 0.7,
      a: 0.4,
      kappa: 0.3,
      lambda: 0.2,
      demandShock: -0.5,
      supplyShock: 0.7,
      shockDuration: 3,
    };
    const rows = simulatePolicy(params).periods;
    rows.slice(1).forEach((row, index) => {
      const previous = rows[index];
      expect(row.x).toBeCloseTo(
        params.rho * previous.x -
          params.a * (previous.i - previous.expectedPi - params.rStar) +
          row.demandShock,
        8,
      );
      expect(row.pi).toBeCloseTo(
        previous.expectedPi + params.kappa * row.x + row.supplyShock,
        8,
      );
      expect(row.expectedPi).toBeCloseTo(
        (1 - params.lambda) * previous.expectedPi + params.lambda * row.pi,
        8,
      );
      expect(row.i).toBeCloseTo(
        Math.max(
          params.iMin,
          params.rStar +
            params.piTarget +
            params.phiPi * (row.pi - params.piTarget) +
            params.phiX * row.x,
        ),
        8,
      );
      expect(row.realRate).toBeCloseTo(row.i - row.expectedPi, 8);
    });
  });

  it("只有政策下限按定义取max；负缺口、负通胀和下一期路径不裁剪", () => {
    const rows = policy({ demandShock: -10, periods: 2 }).periods;
    expect(rows[1]).toMatchObject({
      x: -10,
      pi: -0.5,
      expectedPi: 0.75,
      i: 0,
      lowerBoundBinding: true,
    });
    expect(rows[2].x).toBe(-4.125);
    expect(
      policy({ iMin: -1, demandShock: -10, periods: 1 }).periods[1].i,
    ).toBe(-1);
  });

  it("不稳定规则和发散量级被标记，仍保留原始有限路径而不压平曲线", () => {
    const result = policy({ phiPi: 0, phiX: 0, periods: 200 });
    expect(result.stability.classification).toBe("unstable");
    expect(result.stability.spectralRadius).toBeGreaterThan(1);
    expect(result.status).toBe("unstable");
    expect(result.unstableReason).toBeTruthy();
    expect(result.periods.length).toBe(201);
    expect(result.periods.at(-1)!.x).toBeGreaterThan(1e6);
    expect(result.periods.at(-1)!.x).toBeGreaterThan(result.periods.at(-2)!.x);
    expect(
      result.periods.every((row) =>
        Object.values(row).every(
          (value) => typeof value !== "number" || Number.isFinite(value),
        ),
      ),
    ).toBe(true);
  });

  it("上溢时停止于最后有限期，并明确失败时期，不能返回Infinity或伪零", () => {
    const result = policy({
      a: 1e9,
      kappa: 1e9,
      phiPi: 1e9,
      phiX: 1e9,
      periods: 200,
    });
    expect(result.status).toBe("unstable");
    expect(result.stoppedAtPeriod).not.toBeNull();
    expect(result.periods.length).toBe(result.stoppedAtPeriod);
    expect(result.unstableReason).toContain("没有裁剪");
    expect(
      result.periods.every(
        (row) => Number.isFinite(row.x) && Number.isFinite(row.pi),
      ),
    ).toBe(true);
  });

  it("lambda=0的锚定预期是合法中性边界，lambda=1完整当期更新", () => {
    expect(
      policy({ lambda: 0 }).periods.every((row) => row.expectedPi === 2),
    ).toBe(true);
    expect(policy({ lambda: 0 }).stability.classification).toBe("neutral");
    const row = policy({ lambda: 1, periods: 1 }).periods[1];
    expect(row.expectedPi).toBe(row.pi);
    expect(policy({ a: 0 }).periods[1].x).toBe(1);
  });

  it.each([
    { rho: -0.1 },
    { rho: 1.01 },
    { a: -1 },
    { kappa: -1 },
    { lambda: -0.1 },
    { lambda: 1.01 },
    { phiPi: -1 },
    { phiX: -1 },
    { i0: -1 },
    { periods: 0 },
    { periods: 201 },
    { periods: 1.5 },
    { shockPeriod: 0 },
    { shockPeriod: 31 },
    { shockPeriod: 1.5 },
    { shockDuration: 0 },
    { shockDuration: 201 },
  ])("拒绝域外参数 %j", (patch) => expect(() => policy(patch)).toThrow());

  it("每个原始参数都拒绝非有限数和非数字类型", () => {
    for (const key of Object.keys(
      defaultPolicyParameters(),
    ) as (keyof PolicyParameters)[])
      for (const invalid of [
        NaN,
        Infinity,
        -Infinity,
        "1",
        null,
        1_000_000_001,
      ])
        expect(() => policy({ [key]: invalid } as never)).toThrow();
  });
});

it("工厂、原始输入和计算结果互不污染，A基准可以冻结", () => {
  const inputs = [
    defaultGrowthParameters(),
    defaultSpendingParameters(),
    defaultPolicyParameters(),
  ];
  const copies = structuredClone(inputs);
  inputs.forEach(Object.freeze);
  simulateGrowth(inputs[0] as GrowthParameters);
  simulateSpending(inputs[1] as SpendingParameters);
  simulatePolicy(inputs[2] as PolicyParameters);
  expect(inputs).toEqual(copies);
  const growthDefault = defaultGrowthParameters();
  growthDefault.s = 0.9;
  expect(defaultGrowthParameters().s).toBe(0.2);
  const spendingDefault = defaultSpendingParameters();
  spendingDefault.G = 1;
  expect(defaultSpendingParameters().G).toBe(30);
  const policyDefault = defaultPolicyParameters();
  policyDefault.piTarget = 8;
  expect(defaultPolicyParameters().piTarget).toBe(2);
});
