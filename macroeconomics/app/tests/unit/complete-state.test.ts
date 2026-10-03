import { describe, expect, it } from "vitest";
import {
  exportState,
  importState,
  initialState,
  loadState,
  MAX_IMPORT_BYTES,
  saveState,
  STORAGE_KEY,
  validateState,
  LEARNABLE_LESSON_IDS,
  type LearningState,
  type LocalStorageLike,
} from "../../src/persistence";
import {
  CAPSTONE_RUBRIC,
  REPORT_SECTIONS,
  initialCapstone,
  validateCapstone,
  type CapstoneParameters,
} from "../../src/persistence/capstone";
import {
  ADVANCED_LAB_IDS,
  advancedDefaults,
  validateAdvancedInput,
  type AdvancedLabId,
} from "../../src/models/advanced";
import { simulateGrowth } from "../../src/models/growth";
import { simulateSpending } from "../../src/models/spending";
import { simulatePolicy } from "../../src/models/policy";
import { replayCreditEvents, type CreditEvent } from "../../src/models/credit";
import { simulateDebt } from "../../src/models/debt";
import { calculateExternal } from "../../src/models/external";
import { computeCapstone } from "../../src/models/diagnosis";

class LocalMemory implements LocalStorageLike {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.writes++;
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const creditEvents: CreditEvent[] = [
  { id: "loan-1", sequence: 1, type: "loan", amount: 10 },
  { id: "payment-2", sequence: 2, type: "payment", amount: 7 },
  { id: "repayment-3", sequence: 3, type: "repayment", amount: 3 },
  { id: "loss-4", sequence: 4, type: "loss", amount: 8 },
];

/** An actual Phase 1 shape: six lessons, three labs, schema1, no capstone. */
function legacyRecord() {
  const full = initialState();
  full.lastLessonId = "A03-B";
  full.updatedAt = "2026-10-03T12:00:00.000Z";
  full.lessonStates["A01-A"] = { status: "self_checked", confidence: 4 };
  full.lessonStates["A03-B"] = { status: "practiced", confidence: 2 };
  full.notes = {
    "A03-B": "指数水平仍上升。",
    "card:A01": "工资转移存款，本金偿还减少存款。",
  };
  full.selfChecks = { "A03-B-explain": true };
  full.objectiveAttempts = [
    {
      lessonId: "A03-B",
      checkId: "A03-B-numeric",
      answer: "112.2",
      correct: true,
      at: full.updatedAt,
    },
  ];
  full.labStates.LA01.input.events = [
    { id: "old-wage", sequence: 1, type: "wage", amount: 20 },
    { id: "old-service", sequence: 2, type: "service", amount: 10 },
  ];
  full.labStates.LA01.prediction = "总存款不变。";
  full.labStates.LA01.hasRun = true;
  full.labStates.LA02.classifications = { transfer: "转移" };
  full.labStates.LA03.input.normalization = 1000;
  const { capstone: _capstone, ...common } = full;
  return {
    ...common,
    lessonStates: Object.fromEntries(
      LEARNABLE_LESSON_IDS.slice(0, 6).map((id) => [id, full.lessonStates[id]]),
    ),
    labStates: {
      LA01: full.labStates.LA01,
      LA02: full.labStates.LA02,
      LA03: full.labStates.LA03,
    },
  };
}

describe("完整课程与精确首期记录迁移", () => {
  it("旧6课/3实验schema1迁移保留原始输入、笔记、自评和尝试，仅新增默认章节与实验", () => {
    const old = legacyRecord();
    const snapshot = structuredClone(old);
    const migrated = importState(JSON.stringify(old));
    expect(old).toEqual(snapshot);
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.lastLessonId).toBe("A03-B");
    expect(migrated.updatedAt).toBe(old.updatedAt);
    expect(migrated.notes).toEqual(old.notes);
    expect(migrated.selfChecks).toEqual(old.selfChecks);
    expect(migrated.objectiveAttempts).toEqual(old.objectiveAttempts);
    for (const id of LEARNABLE_LESSON_IDS.slice(0, 6))
      expect(migrated.lessonStates[id]).toEqual(old.lessonStates[id]);
    for (const id of LEARNABLE_LESSON_IDS.slice(6))
      expect(migrated.lessonStates[id]).toEqual({
        status: "not_started",
        confidence: 0,
      });
    for (const id of ["LA01", "LA02", "LA03"] as const)
      expect(migrated.labStates[id]).toEqual(old.labStates[id]);
    const defaults = initialState();
    for (const id of ADVANCED_LAB_IDS)
      expect(migrated.labStates[id]).toEqual(defaults.labStates[id]);
    expect(migrated.capstone).toEqual(initialCapstone());
    expect(importState(exportState(migrated))).toEqual(migrated);
  });

  it("刷新加载首期旧记录不会先覆盖原文；保存迁移结果后恢复完整格式", () => {
    const storage = new LocalMemory();
    const original = JSON.stringify(legacyRecord());
    storage.values.set(STORAGE_KEY, original);
    const loaded = loadState(storage);
    expect(loaded.protected).toBe(false);
    expect(Object.keys(loaded.state.lessonStates)).toHaveLength(24);
    expect(storage.values.get(STORAGE_KEY)).toBe(original);
    expect(storage.writes).toBe(0);
    expect(saveState(storage, loaded.state).ok).toBe(true);
    const raw = JSON.parse(storage.values.get(STORAGE_KEY)!);
    expect(Object.keys(raw.labStates)).toHaveLength(9);
    expect(raw.capstone).toEqual(initialCapstone());
    expect(loadState(storage).state).toEqual(loaded.state);
  });

  it.each([
    "缺一课",
    "缺一实验",
    "24课却无作品",
    "旧课夹新实验",
    "旧课夹作品",
    "旧记录最近课越界",
  ])("拒绝不完整或混合旧格式：%s", (kind) => {
    const old = legacyRecord();
    let mixed: unknown = old;
    if (kind === "缺一课") delete old.lessonStates["A01-A"];
    if (kind === "缺一实验") {
      const labs = old.labStates as Partial<typeof old.labStates>;
      delete labs.LA03;
    }
    if (kind === "24课却无作品") {
      const { capstone: _capstone, ...fullWithoutCapstone } = initialState();
      mixed = fullWithoutCapstone;
    }
    if (kind === "旧课夹新实验")
      mixed = {
        ...old,
        labStates: { ...old.labStates, LA04: initialState().labStates.LA04 },
      };
    if (kind === "旧课夹作品") mixed = { ...old, capstone: initialCapstone() };
    if (kind === "旧记录最近课越界") mixed = { ...old, lastLessonId: "A04-A" };
    expect(() => validateState(mixed)).toThrow();
  });

  it("所有24课状态和终课作品可保存，缺少新课或新实验不会伪装成合法全课程记录", () => {
    const state = initialState();
    state.lastLessonId = "A12-B";
    for (const id of LEARNABLE_LESSON_IDS)
      state.lessonStates[id] = { status: "self_checked", confidence: 5 };
    state.capstone.report["机制比较"] = "比较短期支出和长期供给的条件。";
    expect(importState(exportState(state))).toEqual(state);
    const incomplete = structuredClone(state) as Partial<LearningState>;
    delete (incomplete.lessonStates as Partial<LearningState["lessonStates"]>)[
      "A12-B"
    ];
    expect(() => validateState(incomplete)).toThrow();
    const missingLab = structuredClone(state);
    delete (missingLab.labStates as Partial<LearningState["labStates"]>).LA09;
    expect(() => validateState(missingLab)).toThrow();
  });
});

describe("新增六实验的源输入、A/B复算与导入边界", () => {
  it("9实验完整JSON往返保留各自的A基准，新增六实验以同一计算内核复算", () => {
    const state = initialState();
    state.labStates.LA04.input.s = 0.4;
    state.labStates.LA05.input.G = 40;
    state.labStates.LA06.input.demandShock = 0;
    state.labStates.LA06.input.supplyShock = 1;
    state.labStates.LA07.input.events = structuredClone(creditEvents);
    state.labStates.LA08.input.interestRate = 0.06;
    state.labStates.LA09.input.exchangeRate = 7.7;
    for (const id of ADVANCED_LAB_IDS) {
      state.labStates[id].prediction = `${id}只改变B。`;
      state.labStates[id].hasRun = true;
      state.labStates[id].explanation = "注明条件，不把恒等式当因果。";
    }
    const restored = importState(exportState(state));
    expect(restored).toEqual(state);
    expect(simulateGrowth(restored.labStates.LA04.input).steadyState?.k).toBe(
      16,
    );
    expect(
      simulateGrowth(restored.labStates.LA04.baseline).steadyState?.k,
    ).toBe(4);
    expect(simulateSpending(restored.labStates.LA05.input).equilibrium.Y).toBe(
      195,
    );
    expect(
      simulateSpending(restored.labStates.LA05.baseline).equilibrium.Y,
    ).toBe(170);
    expect(simulatePolicy(restored.labStates.LA06.input).periods[1].pi).toBe(3);
    expect(simulatePolicy(restored.labStates.LA06.baseline).periods[1].pi).toBe(
      2.25,
    );
    const credit = replayCreditEvents(
      restored.labStates.LA07.input.initial,
      restored.labStates.LA07.input.events,
    );
    expect(credit.A).toMatchObject({
      reserves: 13,
      loanAsset: 79,
      depositLiability: 90,
      equity: 2,
    });
    expect(credit.B).toMatchObject({
      reserves: 27,
      loanAsset: 80,
      depositLiability: 97,
      equity: 10,
    });
    expect(restored.labStates.LA07.baseline.events).toEqual([]);
    expect(
      simulateDebt(restored.labStates.LA08.input).periods[1].debtRatio,
    ).toBeCloseTo(0.6335294117647059, 8);
    expect(
      simulateDebt(restored.labStates.LA08.baseline).periods[1].debtRatio,
    ).toBeCloseTo(0.6217647058823529, 8);
    expect(calculateExternal(restored.labStates.LA09.input)).toMatchObject({
      q: 7.7,
      CA: -2,
      NFAChange: 2,
    });
    expect(calculateExternal(restored.labStates.LA09.baseline).q).toBe(7);
    restored.labStates.LA04.input.s = 0.8;
    restored.labStates.LA07.input.initial.A.reserves = 999;
    expect(restored.labStates.LA04.baseline.s).toBe(0.2);
    expect(restored.labStates.LA07.baseline.initial.A.reserves).toBe(20);
    expect(state.labStates.LA04.input.s).toBe(0.4);
    expect(state.labStates.LA07.input.initial.A.reserves).toBe(20);
  });

  const invalidParameters: [AdvancedLabId, string, unknown][] = [
    ["LA04", "s", 1],
    ["LA05", "c", 1],
    ["LA06", "lambda", 1.01],
    ["LA08", "growthRate", -1],
    ["LA09", "exchangeRate", 0],
    ["LA09", "imports", 21],
  ];
  it.each(invalidParameters)(
    "%s的非法参数%s=%s在B和冻结A中都被拒绝",
    (id, key, value) => {
      for (const target of ["input", "baseline"] as const) {
        const state = initialState();
        (state.labStates[id][target] as unknown as Record<string, unknown>)[
          key
        ] = value;
        expect(() => validateState(state)).toThrow();
        expect(() => importState(JSON.stringify(state))).toThrow();
      }
    },
  );

  it.each(["LA04", "LA05", "LA06", "LA08", "LA09"] as const)(
    "%s严格拒绝缺字段、缓存结果和每个数值的非有限值",
    (id) => {
      const source = advancedDefaults()[id];
      expect(() =>
        validateAdvancedInput(id, { ...source, cachedResult: 123 }),
      ).toThrow(/字段|参数/);
      const missing = { ...source } as Record<string, unknown>;
      delete missing[Object.keys(source)[0]];
      expect(() => validateAdvancedInput(id, missing)).toThrow(/字段|参数/);
      for (const key of Object.keys(source))
        for (const value of [NaN, Infinity, -Infinity, "1", null])
          expect(() =>
            validateAdvancedInput(id, { ...source, [key]: value }),
          ).toThrow();
    },
  );

  it("LA07导入不能绕过准备金支付约束或用权益/分户伪造对手方匹配", () => {
    const overspend = advancedDefaults().LA07;
    overspend.events = [
      { id: "loan", sequence: 1, type: "loan", amount: 30 },
      { id: "pay", sequence: 2, type: "payment", amount: 21 },
    ];
    expect(() => validateAdvancedInput("LA07", overspend)).toThrow(/准备金/);
    const mismatch = advancedDefaults().LA07;
    // Each individual bank and customer balance sheet still balances, but the
    // deposit right and the bank's corresponding liability disagree.
    mismatch.initial.A.deposits.historicalDepositorA = 91;
    mismatch.initial.A.depositLiability = 91;
    mismatch.initial.A.equity = 9;
    expect(() => validateAdvancedInput("LA07", mismatch)).toThrow(/双边/);
    const wrongLoan = advancedDefaults().LA07;
    wrongLoan.initial.A.loans.historicalBorrowerA = 79;
    wrongLoan.initial.A.loanAsset = 79;
    wrongLoan.initial.A.equity = 9;
    expect(() => validateAdvancedInput("LA07", wrongLoan)).toThrow(/双边/);
  });

  it.each([
    "未知类型",
    "未知事件字段",
    "重复ID",
    "倒序",
    "非有限金额",
    "过细金额",
    "未知初始客户",
    "初始夹带事件",
  ])("LA07拒绝%s", (kind) => {
    const input = advancedDefaults().LA07;
    input.events = structuredClone(creditEvents);
    if (kind === "未知类型")
      input.events[0].type = "wage" as CreditEvent["type"];
    if (kind === "未知事件字段")
      Object.assign(input.events[0], { cachedDeposit: 10 });
    if (kind === "重复ID") input.events[1].id = input.events[0].id;
    if (kind === "倒序") input.events[1].sequence = 1;
    if (kind === "非有限金额") input.events[0].amount = Infinity;
    if (kind === "过细金额") input.events[0].amount = 0.001;
    if (kind === "未知初始客户")
      Object.assign(input.initial.customers, {
        hidden: { ...input.initial.customers.newBorrower },
      });
    if (kind === "初始夹带事件") input.initial.events = [creditEvents[0]];
    expect(() => validateAdvancedInput("LA07", input)).toThrow();
  });

  it("合法原记录不会因非法的新实验A基准被覆盖", () => {
    const storage = new LocalMemory();
    const state = initialState();
    state.notes["A12-B"] = "有效记录与终课作品都要保留。";
    state.capstone.uncertainty = "银行情景不等于完整金融宏观模型。";
    expect(saveState(storage, state).ok).toBe(true);
    const prior = storage.values.get(STORAGE_KEY);
    state.labStates.LA09.baseline.investment = 99;
    expect(saveState(storage, state).ok).toBe(false);
    expect(storage.values.get(STORAGE_KEY)).toBe(prior);
    expect(loadState(storage).state.capstone.uncertainty).toContain("不等于");
  });
});

describe("全课程文字容量和UTF8文件上限", () => {
  it("24课完整笔记与模型卡共228项可往返，不受首期小字典限额误伤", () => {
    const state = initialState();
    for (const id of LEARNABLE_LESSON_IDS)
      for (const kind of [
        "note",
        "prediction",
        "reason",
        "explain",
        "numeric",
        "transfer",
        "boundary",
        "recap",
        "uncertainty",
      ])
        state.notes[`${kind}:${id}`] = `${id}：对象、单位、机制与边界。`;
    for (let module = 1; module <= 12; module++)
      state.notes[`card:A${String(module).padStart(2, "0")}`] =
        "模型卡：条件、待求变量、反例。";
    expect(Object.keys(state.notes)).toHaveLength(228);
    expect(importState(exportState(state)).notes).toEqual(state.notes);
  });

  it("600项笔记和自评为合法边界，601项明确拒绝", () => {
    const state = initialState();
    state.notes = Object.fromEntries(
      Array.from({ length: 600 }, (_, index) => [`n${index}`, "合成学习笔记"]),
    );
    state.selfChecks = Object.fromEntries(
      Array.from({ length: 600 }, (_, index) => [`c${index}`, false]),
    );
    expect(importState(exportState(state)).notes).toEqual(state.notes);
    state.notes.extra = "第601项";
    expect(() => validateState(state)).toThrow(/600/);
    delete state.notes.extra;
    state.selfChecks.extra = true;
    expect(() => validateState(state)).toThrow(/600/);
  });

  it("约900KB中文笔记合法；超过1MiB的UTF8输入、状态和导出均拒绝", () => {
    const state = initialState();
    state.notes = Object.fromEntries(
      Array.from({ length: 30 }, (_, index) => [
        `n${index}`,
        "学".repeat(10_000),
      ]),
    );
    const exported = exportState(state);
    expect(new TextEncoder().encode(exported).byteLength).toBeLessThan(
      MAX_IMPORT_BYTES,
    );
    expect(importState(exported).notes).toEqual(state.notes);
    state.notes = Object.fromEntries(
      Array.from({ length: 36 }, (_, index) => [
        `n${index}`,
        "学".repeat(10_000),
      ]),
    );
    expect(() => validateState(state)).toThrow(/1 MiB/);
    expect(() => exportState(state)).toThrow(/1 MiB/);
    expect(() => importState(JSON.stringify(state))).toThrow(/1 MiB/);
  });
});

describe("终课作品的可恢复文字、参数、自评与模型选择", () => {
  it("报告与不确定性纯文本原样往返，不把脚本字符串当作代码", () => {
    const capstone = initialCapstone();
    const script =
      "<script>globalThis.__completeCapstoneExecuted=true</script><img src=x onerror=alert(1)>";
    capstone.title = script;
    for (const key of REPORT_SECTIONS) capstone.report[key] = script;
    capstone.uncertainty = script;
    for (const key of CAPSTONE_RUBRIC) capstone.rubric[key] = true;
    const state = initialState();
    state.capstone = capstone;
    expect(importState(exportState(state)).capstone).toEqual(capstone);
    expect("__completeCapstoneExecuted" in globalThis).toBe(false);
  });

  it("文字20000字符与参数上下界可保存；过长、非文本或域外不能绕过导入", () => {
    const capstone = initialCapstone();
    capstone.report[REPORT_SECTIONS[0]] = "文".repeat(20_000);
    expect(validateCapstone(capstone)).toEqual(capstone);
    capstone.report[REPORT_SECTIONS[0]] += "文";
    expect(() => validateCapstone(capstone)).toThrow(/20000/);
    const invalidText = initialCapstone();
    Object.assign(invalidText, { uncertainty: 123 });
    expect(() => validateCapstone(invalidText)).toThrow(/文字/);
  });

  const bounds: [keyof CapstoneParameters, number, number][] = [
    ["priceFactor", 0.1, 5],
    ["technologyFactor", 0.1, 5],
    ["spendingChange", -10, 100],
    ["demandShock", -5, 5],
    ["supplyShock", -5, 5],
    ["creditLoss", 0, 40],
    ["sensitivityFactor", 0.5, 2],
  ];
  it.each(bounds)(
    "参数%s的上下界合法，超界与非有限值拒绝",
    (key, low, high) => {
      for (const value of [low, high]) {
        const capstone = initialCapstone();
        capstone.parameters[key] = value;
        expect(validateCapstone(capstone).parameters[key]).toBe(value);
      }
      for (const value of [low - 0.01, high + 0.01, NaN, Infinity, -Infinity]) {
        const capstone = initialCapstone();
        capstone.parameters[key] = value;
        expect(() => validateCapstone(capstone)).toThrow();
      }
    },
  );

  it("空选或单模型草稿允许保存；重复、不存在的模型和伪造rubric拒绝", () => {
    for (const models of [[], ["demand"]] as const) {
      const capstone = initialCapstone();
      capstone.models = [...models];
      expect(validateCapstone(capstone).models).toEqual(models);
    }
    for (const models of [
      ["growth", "growth"],
      ["prediction"],
      ["growth", "demand", "supply", "finance", "growth"],
    ])
      expect(() => validateCapstone({ ...initialCapstone(), models })).toThrow(
        /模型选择/,
      );
    const rubric = initialCapstone();
    Object.assign(rubric.rubric, { [CAPSTONE_RUBRIC[0]]: "yes" });
    expect(() => validateCapstone(rubric)).toThrow(/布尔/);
    expect(() =>
      validateCapstone({ ...initialCapstone(), rubric: {} }),
    ).toThrow(/字段/);
  });

  it("未知字段、缺失报告章节或缓存结果不能混进终课原始输入", () => {
    const capstone = initialCapstone();
    expect(() =>
      validateCapstone({ ...capstone, results: { demand: 100 } }),
    ).toThrow(/字段/);
    expect(() =>
      validateCapstone({
        ...capstone,
        parameters: { ...capstone.parameters, cachedGDP: 100 },
      }),
    ).toThrow(/字段/);
    const report = { ...capstone.report } as Partial<typeof capstone.report>;
    delete report[REPORT_SECTIONS[0]];
    expect(() => validateCapstone({ ...capstone, report })).toThrow(/字段/);
  });
});

describe("终课情景与敏感性调用计算内核的独立数值oracle", () => {
  it("无冲击基准保留基础p/q、增长与支出，并保留信贷支付而不发生损失", () => {
    const p = {
      ...initialCapstone().parameters,
      priceFactor: 1,
      technologyFactor: 1,
      spendingChange: 0,
      demandShock: 0,
      supplyShock: 0,
      creditLoss: 0,
    };
    const result = computeCapstone(p);
    expect(result.prices.periods[1]).toMatchObject({ N: 61, R: 44 });
    expect(result.results.growth.value).toBeCloseTo(Math.sqrt(1.1), 8);
    expect(result.results.demand.value).toBe(170);
    expect(result.results.supply.value).toBe(2);
    expect(result.results.finance.value).toBe(10);
    expect(result.finance.A).toMatchObject({
      reserves: 13,
      loanAsset: 87,
      depositLiability: 90,
      equity: 10,
    });
  });

  it("默认冲击和1.5倍敏感性对名义、实际、技术、支出、通胀、权益各有明确效果", () => {
    const p = initialCapstone().parameters;
    const result = computeCapstone(p);
    const sensitive = computeCapstone(p, p.sensitivityFactor);
    expect(result.prices.periods[1].N).toBeCloseTo(67.1, 8);
    expect(result.prices.periods[1].R).toBe(44);
    expect(sensitive.prices.periods[1].N).toBeCloseTo(61 * 1.1 ** 1.5, 8);
    expect(sensitive.prices.periods[1].R).toBe(44);
    expect(result.results.growth.value).toBeCloseTo(1.2 * Math.sqrt(1.1), 8);
    expect(sensitive.results.growth.value).toBeCloseTo(
      1.2 ** 1.5 * Math.sqrt(1.1),
      8,
    );
    expect(result.results.demand.value).toBe(145);
    expect(sensitive.results.demand.value).toBe(132.5);
    expect(result.supply.periods[1]).toMatchObject({
      x: -1,
      pi: 2.75,
      expectedPi: 2.375,
      i: 3.625,
    });
    expect(sensitive.supply.periods[1]).toMatchObject({
      x: -1.5,
      pi: 3.125,
      expectedPi: 2.5625,
      i: 3.9375,
    });
    expect(result.results.finance.value).toBe(2);
    expect(sensitive.results.finance.value).toBe(-2);
    expect(result.finance.customers.historicalBorrowerA.loan).toBe(80);
    expect(sensitive.finance.A.lossAllowances.historicalBorrowerA).toBe(12);
    for (const computed of [result, sensitive])
      for (const bank of [computed.finance.A, computed.finance.B])
        expect(bank.reserves + bank.loanAsset).toBe(
          bank.depositLiability + bank.equity,
        );
  });

  it("强度不是概率：金额按分舍入，重复计算与冻结原参数互不污染", () => {
    const p = Object.freeze({
      ...initialCapstone().parameters,
      creditLoss: 0.01,
      sensitivityFactor: 0.5,
    });
    const before = structuredClone(p);
    const result = computeCapstone(p, p.sensitivityFactor);
    expect(result.finance.A.lossAllowances.historicalBorrowerA).toBe(0.01);
    expect(result.results.finance.value).toBe(9.99);
    expect(p).toEqual(before);
    result.finance.A.equity = 999;
    expect(computeCapstone(p, p.sensitivityFactor).finance.A.equity).toBe(9.99);
    expect(computeCapstone(p).results.demand.value).toBe(145);
  });
});
