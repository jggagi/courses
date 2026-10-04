import { describe, expect, it } from "vitest";
import {
  createInitialState,
  createLearningStore,
  defaultLabParameters,
  LESSON_IDS,
  ADVANCED_LAB_IDS,
  MAX_IMPORT_BYTES,
  STORAGE_KEY,
  validateLearningState,
  type LearningState,
  type StorageLike,
} from "../../src/persistence/store";

const AT = "2026-10-03T08:00:00.000Z";
const LATER = "2026-10-03T08:01:00.000Z";

class FakeStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

function bytes(source: string): number {
  return new TextEncoder().encode(source).byteLength;
}
/** Build a genuine, valid attempt history at a chosen wire-size boundary.
 * ASCII padding does not change escaping, and 1,000 answers stay individually
 * well below the text limit. This fixture distinguishes indentation overhead
 * from record data instead of relying on an arbitrary large string. */
function withSizedAttempts<T extends { objectiveAttempts: unknown }>(
  candidate: T, targetBytes: number, pretty: boolean,
): T {
  const state = structuredClone(candidate);
  const attempts = Array.from({ length: 1000 }, () => ({ answer: "", correct: false, at: AT }));
  state.objectiveAttempts = { "M01-A-number": attempts };
  const size = () => bytes(JSON.stringify(state, null, pretty ? 2 : undefined));
  const perAnswer = Math.floor((targetBytes - size()) / attempts.length);
  for (const attempt of attempts) attempt.answer = "a".repeat(perAnswer);
  attempts[0].answer += "a".repeat(targetBytes - size());
  expect(size()).toBe(targetBytes);
  expect(attempts.every(attempt => attempt.answer.length <= 20_000)).toBe(true);
  return state;
}

function filledState(): LearningState {
  const state = createInitialState(AT);
  state.lastLessonId = "M02-A";
  state.lessonStates["M01-A"] = "self_checked";
  state.objectiveAttempts["M01-A-number"] = [
    { answer: 7, correct: false, at: AT },
    { answer: 6, correct: true, at: LATER },
  ];
  state.selfChecks["M01-A-explain"] = {
    answer: "最好被放弃的选择也是成本。",
    rating: "clear",
  };
  state.notes["M01-A"] = "暂不把时间与金钱相加。";
  state.notes["M02-A"] = "数值标签不同，排序相同。";
  state.conceptConfidence["M01-A"] = 4;
  state.labStates.ML01.scenario.px = 6;
  state.labStates.ML01.prediction = "x 截距减半，y 截距不变。";
  state.labStates.ML01.revealed = true;
  state.labStates.ML02.scenario.representation = "square";
  state.labStates.ML03.scenario.kind = "complements";
  state.lessonStates["M12-B"] = "practiced";
  state.notes["M12-B"] = "交易资源要对账，扩大可行域不代替偏好判断。";
  state.conceptConfidence["M12-B"] = 3;
  state.objectiveAttempts["M12-B-number"] = [{ answer: 30, correct: true, at: AT }];
  state.selfChecks["M12-B-review-tax"] = { answer: "财政收入是转移。", rating: "clear" };
  state.advancedLabStates.ML04.scenario.F = 30;
  state.advancedLabStates.ML04.scenario.p = 9;
  for (const id of ADVANCED_LAB_IDS) {
    state.advancedLabStates[id].prediction = `${id} 保持 A 不变，改变 B。`;
    state.advancedLabStates[id].revealed = true;
    state.advancedLabStates[id].explanation = `${id} 的结果只在所列假设下成立。`;
  }
  state.capstone = {
    object: "虚构共享资源市场中的消费者与厂商。",
    baseline: "资源与参与者信息给定。",
    counterfactuals: "改变外部损害和信息规则，并分别比较。",
    boundaries: "合成模型不能给出真实市场的税率。",
    evidence: "需要观测成本、需求与质量，另行识别因果。",
    reflection: "效率与公平需要分别说明。",
  };
  return state;
}

// Historical Phase 1 export shape, written independently of v2 defaults.
function legacyFixture() {
  const parameters = {
    m: 120, px: 3, py: 2, kind: "cd", alpha: 0.5,
    a: 1, b: 1, x: 20, y: 30, secondX: 20, secondY: 5,
    representation: "u", unitScale: 1,
  };
  return {
    schemaVersion: 1,
    courseId: "microeconomics",
    lastLessonId: "M03-B",
    lessonStates: {
      "M01-A": "self_checked", "M01-B": "practiced",
      "M02-A": "in_progress", "M02-B": "not_started",
      "M03-A": "practiced", "M03-B": "in_progress",
    },
    objectiveAttempts: {
      "M01-A-number": [
        { answer: 7, correct: false, at: AT },
        { answer: 6, correct: true, at: LATER },
      ],
      "M02-A-choice": [{ answer: "ordinal", correct: true, at: AT }],
    },
    selfChecks: {
      "M01-A-explain": { answer: "最好被放弃的选择也是成本。", rating: "clear" },
    },
    notes: { "M03-B": "原来的笔记与隐私文本。" },
    labStates: {
      ML01: {
        baseline: { ...parameters }, scenario: { ...parameters, px: 6 },
        prediction: "x 截距减半。", revealed: true,
      },
      ML02: {
        baseline: { ...parameters, x: 10, y: 10 },
        scenario: { ...parameters, x: 10, y: 10, representation: "square" },
        prediction: "排序相同。", revealed: true,
      },
      ML03: {
        baseline: { ...parameters }, scenario: { ...parameters, kind: "complements" },
        prediction: "在拐角选择。", revealed: false,
      },
    },
    conceptConfidence: {
      "M01-A": 4, "M01-B": null, "M02-A": 3,
      "M02-B": null, "M03-A": null, "M03-B": 2,
    },
    updatedAt: LATER,
  };
}

// An independently written complete-course export, with the historical v2
// field contract. It does not remove fields from today's v3 defaults.
function v2Fixture() {
  const lessonIds = ["M01-A", "M01-B", "M02-A", "M02-B", "M03-A", "M03-B",
    "M04-A", "M04-B", "M05-A", "M05-B", "M06-A", "M06-B", "M07-A", "M07-B",
    "M08-A", "M08-B", "M09-A", "M09-B", "M10-A", "M10-B", "M11-A", "M11-B", "M12-A", "M12-B"];
  const parameters = {
    ML04: { F: 20, c: 2, d: 1, p: 8, n: 10, A: 100, B: 5 },
    ML05: { A: 100, B: 1, C: 20, D: 1, tau: 20, legalPayer: 0 },
    ML06: { a: 100, b: 1, c: 20, F: 20 },
    ML07: { r00: 3, c00: 3, r01: 0, c01: 5, r10: 5, c10: 0, r11: 1, c11: 1 },
    ML08: { A: 100, B: 1, C: 20, D: 1, e: 2, tau: 40 },
    ML09: { sL: 2, sH: 8, vL: 4, vH: 12, theta: .25, certificationFee: 1 },
    ML10: { wLow: 0, wHigh: 100, probHigh: .5, y1: 20, y2: 180, r: 0, beta: 1, noBorrow: 0, T: 24, wage: 10, nonLabor: 40, leisureWeight: .5 },
    ML11: { laborA: 120, laborB: 120, ax: 1, ay: 2, bx: 3, by: 3, price: .75, tradeX: 40 },
  };
  return {
    ...legacyFixture(), schemaVersion: 2, lastLessonId: "M12-B",
    lessonStates: Object.fromEntries(lessonIds.map((id) => [id, id === "M12-B" ? "self_checked" : "practiced"])),
    notes: { "M03-B": "旧笔记", "M12-B": "已有完整报告笔记" },
    objectiveAttempts: { "M12-B-number": [{ answer: 30, correct: true, at: AT }] },
    selfChecks: { "M12-B-review-tax": { answer: "转移不是资源损失。", rating: "clear" } },
    conceptConfidence: Object.fromEntries(lessonIds.map((id) => [id, id === "M12-B" ? 4 : null])),
    advancedLabStates: Object.fromEntries(Object.entries(parameters).map(([id, baseline]) => [id, {
      baseline: { ...baseline }, scenario: { ...baseline }, prediction: `${id} 的原预测`, revealed: true, explanation: `${id} 的原解释`,
    }])),
    capstone: { object: "原研究对象", baseline: "原基准", counterfactuals: "原反事实", boundaries: "原边界", evidence: "原证据", reflection: "原反思" },
  };
}

describe("local learning state", () => {
  it("creates separate valid default A/B experiment objects and honest lesson states", () => {
    const state = createInitialState(AT);
    expect(validateLearningState(state).ok).toBe(true);
    expect(Object.values(state.lessonStates)).toEqual(
      Array(24).fill("not_started"),
    );
    expect(state.lastLessonId).toBeNull();
    expect(state.schemaVersion).toBe(3);
    expect(Object.keys(state.advancedLabStates)).toEqual(ADVANCED_LAB_IDS);
    expect(state.capstone).toEqual({
      object: "", baseline: "", counterfactuals: "", boundaries: "", evidence: "", reflection: "",
    });
    expect(state.labStates.ML01.baseline).toMatchObject({
      m: 120,
      px: 3,
      py: 2,
      x: 20,
      y: 30,
    });
    expect(defaultLabParameters("ML02")).toMatchObject({
      x: 10,
      y: 10,
      secondX: 20,
      secondY: 5,
    });
    state.labStates.ML01.scenario.px = 6;
    expect(state.labStates.ML01.baseline.px).toBe(3);
    expect(state.labStates.ML03.scenario.px).toBe(3);
    state.advancedLabStates.ML04.scenario.F = 30;
    expect(state.advancedLabStates.ML04.baseline.F).toBe(20);
  });

  it("restores attempts, notes, confidence, prediction, reveal and A/B after a new store loads", () => {
    const storage = new FakeStorage();
    const first = createLearningStore({ storage, now: () => LATER });
    const result = first.save(filledState());
    expect(result.status).toBe("saved");
    expect(result.state.updatedAt).toBe(LATER);
    const refreshed = createLearningStore({ storage, now: () => LATER });
    expect(refreshed.load().state).toEqual(result.state);
    expect(refreshed.load().state.labStates.ML01).toMatchObject({
      baseline: { px: 3 },
      scenario: { px: 6 },
      prediction: "x 截距减半，y 截距不变。",
      revealed: true,
    });
  });

  it("round trips explicit JSON export and import with every record intact", () => {
    const first = createLearningStore({
      storage: new FakeStorage(),
      now: () => AT,
    });
    first.save(filledState());
    const exported = first.exportJson();
    const second = createLearningStore({
      storage: new FakeStorage(),
      now: () => LATER,
    });
    expect(second.importJson(exported).ok).toBe(true);
    expect(second.load().state).toEqual(first.load().state);
    expect(JSON.parse(exported).schemaVersion).toBe(3);
    expect(second.load().state.capstone.evidence).toContain("另行识别因果");
  });

  it("rejects invalid JSON and cross-course import without modifying the current record", () => {
    const storage = new FakeStorage();
    const store = createLearningStore({ storage, now: () => AT });
    store.save(filledState());
    const before = storage.getItem(STORAGE_KEY);
    expect(store.importJson("{broken").ok).toBe(false);
    const other = { ...filledState(), courseId: "macroeconomics" };
    expect(store.importJson(JSON.stringify(other))).toMatchObject({
      ok: false,
      error: expect.stringContaining("课程不匹配"),
    });
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    expect(store.load().state.notes["M01-A"]).toBe("暂不把时间与金钱相加。");
  });

  it.each([
    "{broken",
    JSON.stringify({ ...createInitialState(AT), schemaVersion: 999 }),
  ])(
    "protects unreadable originals and permits a recovery export (%s)",
    (raw) => {
      const storage = new FakeStorage();
      storage.setItem(STORAGE_KEY, raw);
      const store = createLearningStore({ storage, now: () => AT });
      expect(store.load()).toMatchObject({
        status: "recovery",
        ok: false,
        notice: expect.stringContaining("原记录已保留"),
      });
      expect(store.exportOriginal()).toBe(raw);
      const next = store.load().state;
      next.notes["M01-A"] = "仍可在内存里学习。";
      expect(store.save(next).status).toBe("recovery");
      expect(storage.getItem(STORAGE_KEY)).toBe(raw);
      expect(JSON.parse(store.exportJson()).notes["M01-A"]).toBe(
        "仍可在内存里学习。",
      );
      expect(store.importJson(JSON.stringify(filledState())).status).toBe(
        "saved",
      );
      expect(store.exportOriginal()).toBeNull();
      expect(JSON.parse(storage.getItem(STORAGE_KEY)!).notes["M01-A"]).toBe(
        "暂不把时间与金钱相加。",
      );
    },
  );

  it("recovers from an explicitly cleared corrupt record without touching another course key", () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, "invalid");
    storage.setItem("courses:macroeconomics:v1", "private-other-course");
    storage.setItem("unrelated", "keep");
    const store = createLearningStore({ storage, now: () => AT });
    store.load();
    expect(store.reset()).toMatchObject({ ok: true, status: "saved" });
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem("courses:macroeconomics:v1")).toBe(
      "private-other-course",
    );
    expect(storage.getItem("unrelated")).toBe("keep");
    expect(store.exportOriginal()).toBeNull();
  });

  it("resets a lesson independently of other lessons and shared experiment states", () => {
    const store = createLearningStore({
      storage: new FakeStorage(),
      now: () => AT,
    });
    store.save(filledState());
    const before = store.load().state;
    const result = store.resetLesson("M01-A");
    expect(result.state.lessonStates["M01-A"]).toBe("not_started");
    expect(result.state.notes["M01-A"]).toBeUndefined();
    expect(result.state.objectiveAttempts["M01-A-number"]).toBeUndefined();
    expect(result.state.selfChecks["M01-A-explain"]).toBeUndefined();
    expect(result.state.conceptConfidence["M01-A"]).toBeNull();
    expect(result.state.notes["M02-A"]).toBe(before.notes["M02-A"]);
    expect(result.state.lastLessonId).toBe("M02-A");
    expect(result.state.labStates).toEqual(before.labStates);
    expect(store.resetLesson("M02-A").state.lastLessonId).toBeNull();
  });

  it("falls back to memory when read access is unavailable", () => {
    const denied: StorageLike = {
      getItem() {
        throw new Error("SecurityError");
      },
      setItem() {
        throw new Error("SecurityError");
      },
      removeItem() {
        throw new Error("SecurityError");
      },
    };
    const store = createLearningStore({ storage: denied, now: () => AT });
    expect(store.load()).toMatchObject({
      status: "memory",
      notice: expect.stringContaining("关闭或刷新后可能丢失"),
    });
    const result = store.save(filledState());
    expect(result.ok).toBe(true);
    expect(result.state.notes["M01-A"]).toBe("暂不把时间与金钱相加。");
    expect(store.exportJson()).toContain("暂不把时间与金钱相加");
  });

  it("falls back to memory on quota errors without losing the active state", () => {
    const storage = new FakeStorage();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const store = createLearningStore({ storage, now: () => AT });
    expect(store.save(filledState())).toMatchObject({
      ok: true,
      status: "memory",
    });
    expect(store.load().state.labStates.ML01.revealed).toBe(true);
  });

  it("can explicitly delete a previously saved record after a write quota failure", () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(filledState()));
    storage.setItem("courses:macroeconomics:v1", "keep");
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const store = createLearningStore({ storage, now: () => AT });
    const next = store.load().state;
    next.notes["M01-A"] = "Only held in memory now";
    expect(store.save(next).status).toBe("memory");
    expect(store.reset().ok).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem("courses:macroeconomics:v1")).toBe("keep");
  });

  it("reports a failed deletion and keeps the original record", () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(filledState()));
    storage.removeItem = () => {
      throw new Error("SecurityError");
    };
    const store = createLearningStore({ storage, now: () => AT });
    expect(store.reset()).toMatchObject({
      ok: false,
      error: expect.stringContaining("原记录仍保留"),
    });
    expect(store.load().state.notes["M01-A"]).toBe("暂不把时间与金钱相加。");
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("keeps imported user text verbatim as data; it never evaluates HTML or scripts", () => {
    const malicious =
      '<script>globalThis.executed=true</script><img src=x onerror="globalThis.executed=true">';
    const candidate = filledState();
    candidate.notes["M01-A"] = malicious;
    candidate.selfChecks["M01-A-explain"].answer = malicious;
    candidate.labStates.ML01.prediction = malicious;
    candidate.advancedLabStates.ML04.prediction = malicious;
    candidate.advancedLabStates.ML04.explanation = malicious;
    candidate.capstone.reflection = malicious;
    const store = createLearningStore({
      storage: new FakeStorage(),
      now: () => AT,
    });
    expect(store.importJson(JSON.stringify(candidate)).ok).toBe(true);
    expect(store.load().state.notes["M01-A"]).toBe(malicious);
    expect(store.load().state.advancedLabStates.ML04.explanation).toBe(malicious);
    expect(store.load().state.capstone.reflection).toBe(malicious);
    expect(
      (globalThis as typeof globalThis & { executed?: boolean }).executed,
    ).toBeUndefined();
    // Browser E2E additionally verifies React renders these values as text.
  });

  it.each([
    [
      "unknown top-level field",
      (state: Record<string, unknown>) => {
        state.telemetry = true;
      },
    ],
    [
      "missing field",
      (state: Record<string, unknown>) => {
        delete state.notes;
      },
    ],
    [
      "wrong lesson state",
      (state: Record<string, unknown>) => {
        (state.lessonStates as Record<string, unknown>)["M01-A"] = "mastered";
      },
    ],
    [
      "unknown lesson",
      (state: Record<string, unknown>) => {
        state.lastLessonId = "M13-A";
      },
    ],
    [
      "cross-course question",
      (state: Record<string, unknown>) => {
        state.objectiveAttempts = { "A01-A-numeric": [] };
      },
    ],
    [
      "unknown attempt field",
      (state: Record<string, unknown>) => {
        state.objectiveAttempts = {
          "M01-A-number": [{ answer: 2, correct: true, at: AT, score: 100 }],
        };
      },
    ],
    [
      "invalid answer",
      (state: Record<string, unknown>) => {
        state.objectiveAttempts = {
          "M01-A-number": [{ answer: null, correct: true, at: AT }],
        };
      },
    ],
    [
      "invalid self rating",
      (state: Record<string, unknown>) => {
        state.selfChecks = {
          "M01-A-explain": { answer: "x", rating: "scientifically_mastered" },
        };
      },
    ],
    [
      "unknown note lesson",
      (state: Record<string, unknown>) => {
        state.notes = { "M13-B": "unknown lesson" };
      },
    ],
    [
      "invalid confidence",
      (state: Record<string, unknown>) => {
        (state.conceptConfidence as Record<string, unknown>)["M01-A"] = 5.5;
      },
    ],
    [
      "invalid timestamp",
      (state: Record<string, unknown>) => {
        state.updatedAt = "2026-02-30T00:00:00.000Z";
      },
    ],
    [
      "HTML is not an answer object",
      (state: Record<string, unknown>) => {
        state.notes = { "M01-A": { html: "<b>x</b>" } };
      },
    ],
  ])("strictly rejects %s without writing", (_label, mutate) => {
    const candidate = createInitialState(AT) as unknown as Record<
      string,
      unknown
    >;
    mutate(candidate);
    const store = createLearningStore({
      storage: new FakeStorage(),
      now: () => AT,
    });
    const before = store.exportJson();
    expect(store.importJson(JSON.stringify(candidate)).ok).toBe(false);
    expect(store.exportJson()).toBe(before);
  });

  it.each([
    ["m", -1],
    ["px", 0],
    ["py", 21],
    ["alpha", 1],
    ["a", 0],
    ["x", -1],
    ["representation", "log"],
    ["kind", "imaginary"],
    ["revealed", "yes"],
  ])("rejects an invalid experiment field %s=%s", (field, invalid) => {
    const candidate = createInitialState(AT);
    if (field === "revealed")
      (candidate.labStates.ML01 as unknown as Record<string, unknown>)[field] =
        invalid;
    else
      (candidate.labStates.ML01.scenario as unknown as Record<string, unknown>)[
        field
      ] = invalid;
    expect(validateLearningState(candidate).ok).toBe(false);
  });

  it("rejects cross-lab ranges and disabled ML03 linear coefficients", () => {
    const candidate = createInitialState(AT);
    candidate.labStates.ML03.scenario.m = 240;
    expect(validateLearningState(candidate).ok).toBe(false);
    candidate.labStates.ML03.scenario.m = 120;
    candidate.labStates.ML03.scenario.a = 2;
    expect(validateLearningState(candidate).ok).toBe(false);
    candidate.labStates.ML03.scenario.a = 1;
    candidate.labStates.ML02.scenario.x = 61;
    expect(validateLearningState(candidate).ok).toBe(false);
  });

  it("rejects oversized files, long text and non-finite numeric state", () => {
    const store = createLearningStore({
      storage: new FakeStorage(),
      now: () => AT,
    });
    expect(store.importJson(" ".repeat(MAX_IMPORT_BYTES + 1))).toMatchObject({
      ok: false,
      error: expect.stringContaining("1 MiB"),
    });
    const candidate = createInitialState(AT);
    candidate.notes["M01-A"] = "字".repeat(20_001);
    expect(validateLearningState(candidate).ok).toBe(false);
    delete candidate.notes["M01-A"];
    candidate.labStates.ML01.scenario.x = Number.POSITIVE_INFINITY;
    expect(validateLearningState(candidate).ok).toBe(false);
  });

  it("enforces the total UTF-8 byte limit even when individual texts fit", () => {
    const candidate = createInitialState(AT);
    const largeAnswer = "字".repeat(20_000);
    candidate.objectiveAttempts["M01-A-number"] = Array.from(
      { length: 20 },
      () => ({ answer: largeAnswer, correct: false, at: AT }),
    );
    expect(validateLearningState(candidate)).toMatchObject({
      ok: false,
      error: expect.stringContaining("1 MiB"),
    });
  });

  it("rejects records whose compact JSON fits but actual pretty export exceeds the import budget, without overwriting saved data", () => {
    const storage = new FakeStorage();
    const store = createLearningStore({ storage, now: () => AT });
    store.save(filledState());
    const before = storage.getItem(STORAGE_KEY);
    const candidate = withSizedAttempts(filledState(), MAX_IMPORT_BYTES - 1, false);
    const compact = JSON.stringify(candidate);
    expect(bytes(compact)).toBeLessThan(MAX_IMPORT_BYTES);
    expect(bytes(JSON.stringify(candidate, null, 2))).toBeGreaterThan(MAX_IMPORT_BYTES);
    expect(store.save(candidate)).toMatchObject({ ok: false, error: expect.stringContaining("1 MiB") });
    expect(store.importJson(compact)).toMatchObject({ ok: false, error: expect.stringContaining("1 MiB") });
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    expect(store.load().state.objectiveAttempts["M01-A-number"]).toHaveLength(2);
  });

  it("round trips an accepted record whose actual exported UTF-8 file is exactly 1 MiB", () => {
    const candidate = withSizedAttempts(filledState(), MAX_IMPORT_BYTES, true);
    expect(validateLearningState(candidate).ok).toBe(true);
    const store = createLearningStore({ storage: new FakeStorage(), now: () => AT });
    const saved = store.save(candidate);
    expect(saved.ok).toBe(true);
    const exported = store.exportJson();
    expect(bytes(exported)).toBe(MAX_IMPORT_BYTES);
    const imported = createLearningStore({ storage: new FakeStorage(), now: () => LATER });
    expect(imported.importJson(exported).ok).toBe(true);
    expect(imported.load().state).toEqual(saved.state);
    expect(imported.exportJson()).toBe(exported);
  });

  it.each([1, 2] as const)("counts all new schema 3 defaults before accepting a near-limit v%s migration, preserving the oversized original", version => {
    const historical = withSizedAttempts(version === 1 ? legacyFixture() : v2Fixture(), MAX_IMPORT_BYTES - 1, true);
    const raw = JSON.stringify(historical);
    expect(bytes(raw)).toBeLessThan(MAX_IMPORT_BYTES);
    expect(bytes(JSON.stringify(historical, null, 2))).toBeLessThan(MAX_IMPORT_BYTES);
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, raw);
    const store = createLearningStore({ storage, now: () => AT });
    expect(store.load()).toMatchObject({ ok: false, status: "recovery", error: expect.stringContaining("1 MiB") });
    expect(store.exportOriginal()).toBe(raw);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(store.save(store.load().state).status).toBe("recovery");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });


  it("loads a real v1 export without overwriting it and preserves all historical records", () => {
    const storage = new FakeStorage();
    const legacy = legacyFixture();
    const raw = JSON.stringify(legacy);
    storage.setItem(STORAGE_KEY, raw);
    storage.setItem("courses:macroeconomics:v1", "other private records");
    const store = createLearningStore({ storage, now: () => AT });
    const loaded = store.load();
    expect(loaded).toMatchObject({ ok: true, status: "saved", notice: expect.stringContaining("已迁移") });
    expect(loaded.state.schemaVersion).toBe(3);
    expect(loaded.state.lastLessonId).toBe("M03-B");
    expect(loaded.state.objectiveAttempts).toEqual(legacy.objectiveAttempts);
    expect(loaded.state.selfChecks).toEqual(legacy.selfChecks);
    expect(loaded.state.notes).toEqual(legacy.notes);
    expect(loaded.state.labStates).toEqual(legacy.labStates);
    for (const [id, status] of Object.entries(legacy.lessonStates))
      expect(loaded.state.lessonStates[id as keyof LearningState["lessonStates"]]).toBe(status);
    expect(loaded.state.lessonStates["M12-B"]).toBe("not_started");
    expect(loaded.state.conceptConfidence["M01-A"]).toBe(4);
    expect(loaded.state.conceptConfidence["M12-B"]).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(JSON.parse(store.exportJson()).schemaVersion).toBe(3);
    expect(store.exportOriginal()).toBeNull();
    expect(store.save(loaded.state).ok).toBe(true);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).schemaVersion).toBe(3);
    expect(storage.getItem("courses:macroeconomics:v1")).toBe("other private records");
    expect(createLearningStore({ storage, now: () => AT }).load().state.labStates).toEqual(legacy.labStates);
  });

  it("imports historical JSON explicitly and exports a valid complete v3 record", () => {
    const store = createLearningStore({ storage: new FakeStorage(), now: () => AT });
    expect(store.importJson(JSON.stringify(legacyFixture()))).toMatchObject({
      ok: true, status: "saved", notice: expect.stringContaining("已迁移"),
    });
    const exported = JSON.parse(store.exportJson());
    expect(exported.schemaVersion).toBe(3);
    expect(Object.keys(exported.lessonStates)).toHaveLength(24);
    expect(Object.keys(exported.advancedLabStates)).toHaveLength(8);
    expect(validateLearningState(exported).ok).toBe(true);
  });

  it("strictly migrates real v2 exports without writing on load or losing complete-course records", () => {
    const fixture = v2Fixture();
    const raw = JSON.stringify(fixture);
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, raw);
    const store = createLearningStore({ storage, now: () => AT });
    const loaded = store.load();
    expect(loaded.ok).toBe(true);
    expect(loaded.notice).toContain("版本 3");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    for (const key of ["lessonStates", "objectiveAttempts", "selfChecks", "notes", "labStates", "advancedLabStates", "capstone", "conceptConfidence"] as const)
      expect(loaded.state[key]).toEqual(fixture[key]);
    expect(loaded.state).toMatchObject({ schemaVersion: 3, reviewQueue: {}, experimentHistory: [], capstoneSnapshots: [] });
    expect(Object.keys(loaded.state.extensionLabStates)).toEqual(["MX01", "MX02", "MX03"]);
    expect(validateLearningState(JSON.parse(store.exportJson())).ok).toBe(true);
    expect(store.save(loaded.state).ok).toBe(true);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).schemaVersion).toBe(3);
  });

  it.each([
    ["unknown top-level key", (value: Record<string, unknown>) => { value.reviewQueue = {}; }],
    ["missing advanced lab", (value: Record<string, unknown>) => { delete (value.advancedLabStates as Record<string, unknown>).ML11; }],
    ["unknown fabricated question", (value: Record<string, unknown>) => { value.selfChecks = { "M01-A-q1": { answer: "x", rating: "clear" } }; }],
    ["missing capstone", (value: Record<string, unknown>) => { delete value.capstone; }],
  ])("preserves corrupt v2 originals rather than migrating them: %s", (_label, mutate) => {
    const value = v2Fixture() as unknown as Record<string, unknown>;
    mutate(value);
    const raw = JSON.stringify(value);
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, raw);
    const store = createLearningStore({ storage, now: () => AT });
    expect(store.load()).toMatchObject({ ok: false, status: "recovery" });
    expect(store.exportOriginal()).toBe(raw);
    expect(store.save(store.load().state).status).toBe("recovery");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("shows migration and backup notices when a legacy import can only live in memory", () => {
    const store = createLearningStore({ storage: null, now: () => AT });
    const result = store.importJson(JSON.stringify(legacyFixture()));
    expect(result).toMatchObject({ ok: true, status: "memory" });
    expect(result.notice).toContain("已迁移");
    expect(result.notice).toContain("关闭或刷新后可能丢失");
    expect(JSON.parse(store.exportJson()).schemaVersion).toBe(3);
  });

  it.each([
    ["missing legacy lesson", (state: Record<string, unknown>) => { delete (state.lessonStates as Record<string, unknown>)["M03-B"]; }],
    ["future lesson disguised as v1", (state: Record<string, unknown>) => { (state.lessonStates as Record<string, unknown>)["M04-A"] = "not_started"; }],
    ["missing legacy confidence", (state: Record<string, unknown>) => { delete (state.conceptConfidence as Record<string, unknown>)["M02-B"]; }],
    ["new lab disguised as v1", (state: Record<string, unknown>) => { state.advancedLabStates = {}; }],
    ["invalid legacy attempt", (state: Record<string, unknown>) => { state.objectiveAttempts = { "M01-A-unknown": [] }; }],
    ["future question disguised as v1", (state: Record<string, unknown>) => { state.objectiveAttempts = { "M04-A-number": [] }; }],
    ["future note disguised as v1", (state: Record<string, unknown>) => { state.notes = { "M04-A": "x" }; }],
    ["missing legacy lab", (state: Record<string, unknown>) => { delete (state.labStates as Record<string, unknown>).ML03; }],
  ])("does not migrate corrupt v1 records: %s", (_label, mutate) => {
    const candidate = legacyFixture() as unknown as Record<string, unknown>;
    mutate(candidate);
    const raw = JSON.stringify(candidate);
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, raw);
    const store = createLearningStore({ storage, now: () => AT });
    expect(store.load()).toMatchObject({ ok: false, status: "recovery" });
    expect(store.exportOriginal()).toBe(raw);
    expect(store.save(store.load().state).status).toBe("recovery");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("accepts all 96 lesson checks and the four explicit cross-module reviews", () => {
    const state = createInitialState(AT);
    for (const lesson of LESSON_IDS)
      for (const suffix of ["explain", "choice", "number", "transfer"])
        state.selfChecks[`${lesson}-${suffix}`] = { answer: "自评文本", rating: "partial" };
    for (const topic of ["cost", "tax", "game", "risk"])
      state.selfChecks[`M12-B-review-${topic}`] = { answer: "迁移解释", rating: "clear" };
    expect(Object.keys(state.selfChecks)).toHaveLength(100);
    expect(validateLearningState(state).ok).toBe(true);
    state.selfChecks["M12-B-review-invented"] = { answer: "x", rating: "clear" };
    expect(validateLearningState(state).ok).toBe(false);
  });

  it("persists meaningful no-result boundaries such as zero-income log utility", () => {
    const state = createInitialState(AT);
    state.advancedLabStates.ML10.scenario.y1 = 0;
    state.advancedLabStates.ML10.scenario.y2 = 0;
    state.advancedLabStates.ML10.scenario.noBorrow = 1;
    state.advancedLabStates.ML10.prediction = "零收入没有正消费可行点。";
    state.advancedLabStates.ML10.revealed = true;
    expect(validateLearningState(state).ok).toBe(true);
    const store = createLearningStore({ storage: new FakeStorage(), now: () => AT });
    expect(store.importJson(JSON.stringify(state)).ok).toBe(true);
    expect(store.load().state.advancedLabStates.ML10.scenario.y1).toBe(0);
    expect(store.load().state.advancedLabStates.ML10.scenario.noBorrow).toBe(1);
  });

  it("resets later lesson checks including reviews while preserving capstone and lab records", () => {
    const store = createLearningStore({ storage: new FakeStorage(), now: () => AT });
    store.save(filledState());
    const before = store.load().state;
    const reset = store.resetLesson("M12-B").state;
    expect(reset.notes["M12-B"]).toBeUndefined();
    expect(reset.objectiveAttempts["M12-B-number"]).toBeUndefined();
    expect(reset.selfChecks["M12-B-review-tax"]).toBeUndefined();
    expect(reset.conceptConfidence["M12-B"]).toBeNull();
    expect(reset.advancedLabStates).toEqual(before.advancedLabStates);
    expect(reset.capstone).toEqual(before.capstone);
    expect(store.reset().state.capstone.object).toBe("");
    expect(store.load().state.advancedLabStates.ML04.scenario.F).toBe(20);
  });

  it.each([
    ["missing advanced lab", (state: LearningState) => { delete (state.advancedLabStates as Partial<LearningState["advancedLabStates"]>).ML11; }],
    ["unknown advanced field", (state: LearningState) => { state.advancedLabStates.ML04.scenario.imaginary = 1; }],
    ["missing advanced parameter", (state: LearningState) => { delete state.advancedLabStates.ML04.scenario.F; }],
    ["invalid advanced domain", (state: LearningState) => { state.advancedLabStates.ML04.scenario.d = 0; }],
    ["nonfinite advanced parameter", (state: LearningState) => { state.advancedLabStates.ML04.scenario.F = Infinity; }],
    ["invalid borrowing switch", (state: LearningState) => { state.advancedLabStates.ML10.scenario.noBorrow = 0.5; }],
    ["invalid statutory payer switch", (state: LearningState) => { state.advancedLabStates.ML05.scenario.legalPayer = 0.5; }],
    ["wrong advanced reveal", (state: LearningState) => { (state.advancedLabStates.ML04 as unknown as Record<string, unknown>).revealed = "yes"; }],
    ["HTML capstone object", (state: LearningState) => { (state.capstone as unknown as Record<string, unknown>).object = { html: "<b>x</b>" }; }],
    ["missing capstone field", (state: LearningState) => { delete (state.capstone as Partial<LearningState["capstone"]>).boundaries; }],
    ["unknown capstone field", (state: LearningState) => { (state.capstone as unknown as Record<string, unknown>).grade = 100; }],
  ])("strictly rejects complete-course corruption: %s", (_label, mutate) => {
    const state = createInitialState(AT);
    mutate(state);
    expect(validateLearningState(state).ok).toBe(false);
  });

  it("returns detached snapshots so outside mutation cannot alter unsaved state", () => {
    const store = createLearningStore({ storage: null, now: () => AT });
    const state = store.load().state;
    state.notes["M01-A"] = "not saved";
    state.labStates.ML01.scenario.px = 6;
    expect(store.load().state.notes["M01-A"]).toBeUndefined();
    expect(store.load().state.labStates.ML01.scenario.px).toBe(3);
    expect(store.load().status).toBe("memory");
  });
});
