import { describe, expect, it, vi } from "vitest";
import {
  createInitialState, createLearningStore, KNOWN_QUESTION_IDS, STORAGE_KEY,
  validateLearningState, type LearningState, type StorageLike,
} from "../../src/persistence/store";
import {
  captureSnapshot, deleteSnapshot, dueReviewEntries, gradeReview,
  queueReview, restoreSnapshot,
} from "../../src/persistence/learning-tools";

const AT = "2026-10-04T08:00:00.000Z";
const NEXT = "2026-10-05T08:00:00.000Z";
class FakeStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function revealedState(): LearningState {
  const state = createInitialState(AT);
  state.labStates.ML01.revealed = true;
  state.labStates.ML01.scenario.px = 6;
  state.labStates.ML01.prediction = "预测 B 的 x 截距减半。";
  state.advancedLabStates.ML04.revealed = true;
  state.advancedLabStates.ML04.scenario.F = 60;
  state.advancedLabStates.ML04.prediction = "固定成本不改边际条件。";
  state.advancedLabStates.ML04.explanation = "利润变化，短期供给保持。";
  state.extensionLabStates.MX01.revealed = true;
  state.extensionLabStates.MX01.scenario.px1 = 9;
  state.extensionLabStates.MX01.prediction = "补偿使比较口径明确。";
  state.extensionLabStates.MX01.explanation = "替代与收入作用要分别记账。";
  return state;
}

describe("transparent spaced review", () => {
  it("uses exactly the 96 known lesson checks and four cross-module IDs", () => {
    expect(KNOWN_QUESTION_IDS).toHaveLength(100);
    expect(new Set(KNOWN_QUESTION_IDS).size).toBe(100);
    let state = createInitialState(AT);
    for (const id of KNOWN_QUESTION_IDS) state = queueReview(state, id, "uncertain", AT);
    expect(Object.keys(state.reviewQueue)).toHaveLength(100);
    expect(dueReviewEntries(state, AT)).toHaveLength(100);
    expect(() => queueReview(state, "M01-A-q1", "incorrect", AT)).toThrow("题目 ID");
    expect(() => queueReview(state, "M12-B-review-invented", "uncertain", AT)).toThrow("题目 ID");
  });

  it("queues once, prioritizes incorrect answers and preserves a scheduled review", () => {
    const initial = createInitialState(AT);
    let state = queueReview(initial, "M01-A-number", "uncertain", AT);
    expect(initial.reviewQueue).toEqual({});
    expect(state.reviewQueue["M01-A-number"]).toEqual({
      questionId: "M01-A-number", lessonId: "M01-A", dueAt: AT,
      intervalDays: 0, repetitions: 0, lapses: 0, lastReviewedAt: null,
      reason: "uncertain", grade: null, variant: 0,
    });
    state = gradeReview(state, "M01-A-number", "good", AT);
    const scheduled = state.reviewQueue["M01-A-number"];
    state = queueReview(state, "M01-A-number", "incorrect", NEXT);
    state = queueReview(state, "M01-A-number", "uncertain", NEXT);
    expect(Object.keys(state.reviewQueue)).toEqual(["M01-A-number"]);
    expect(state.reviewQueue["M01-A-number"]).toEqual({ ...scheduled, reason: "incorrect" });
  });

  it("advances good reviews through 7,14,30,60 days and caps the interval", () => {
    let state = queueReview(createInitialState(AT), "M03-B-number", "incorrect", AT);
    const checks = [
      [AT, 7, "2026-10-11T08:00:00.000Z"],
      ["2026-10-11T08:00:00.000Z", 14, "2026-10-25T08:00:00.000Z"],
      ["2026-10-25T08:00:00.000Z", 30, "2026-11-24T08:00:00.000Z"],
      ["2026-11-24T08:00:00.000Z", 60, "2027-01-23T08:00:00.000Z"],
      ["2027-01-23T08:00:00.000Z", 60, "2027-03-24T08:00:00.000Z"],
    ] as const;
    for (const [index, [at, intervalDays, dueAt]] of checks.entries()) {
      state = gradeReview(state, "M03-B-number", "good", at);
      expect(state.reviewQueue["M03-B-number"]).toMatchObject({
        intervalDays, dueAt, repetitions: index + 1, lapses: 0,
        variant: index + 1, lastReviewedAt: at, grade: "good",
      });
    }
  });

  it("sets hard to three days and again to one, records a lapse and starts good at seven", () => {
    let state = queueReview(createInitialState(AT), "M02-A-explain", "uncertain", AT);
    state = gradeReview(state, "M02-A-explain", "hard", AT);
    expect(state.reviewQueue["M02-A-explain"]).toMatchObject({ intervalDays: 3, dueAt: "2026-10-07T08:00:00.000Z", repetitions: 1, variant: 1 });
    state = gradeReview(state, "M02-A-explain", "again", NEXT);
    expect(state.reviewQueue["M02-A-explain"]).toMatchObject({ intervalDays: 1, dueAt: "2026-10-06T08:00:00.000Z", repetitions: 0, lapses: 1, variant: 2 });
    state = gradeReview(state, "M02-A-explain", "good", "2026-10-06T08:00:00.000Z");
    expect(state.reviewQueue["M02-A-explain"]).toMatchObject({ intervalDays: 7, dueAt: "2026-10-13T08:00:00.000Z", repetitions: 1, lapses: 1, variant: 3 });
  });

  it("returns only due entries, including exact due time, in deterministic order", () => {
    let state = queueReview(createInitialState(AT), "M12-B-review-risk", "uncertain", AT);
    state = queueReview(state, "M01-A-choice", "incorrect", AT);
    state = queueReview(state, "M01-B-transfer", "uncertain", NEXT);
    expect(dueReviewEntries(state, AT).map((entry) => entry.questionId)).toEqual(["M01-A-choice", "M12-B-review-risk"]);
    expect(dueReviewEntries(state, "2026-10-04T07:59:59.999Z")).toEqual([]);
    const entries = dueReviewEntries(state, AT);
    entries[0].reason = "uncertain";
    expect(state.reviewQueue["M01-A-choice"].reason).toBe("incorrect");
  });

  it("uses UTC calendar arithmetic through leap day and refuses backwards or invalid times", () => {
    let state = queueReview(createInitialState(AT), "M01-A-number", "incorrect", "2028-02-28T23:30:00.000Z");
    state = gradeReview(state, "M01-A-number", "again", "2028-02-28T23:30:00.000Z");
    expect(state.reviewQueue["M01-A-number"].dueAt).toBe("2028-02-29T23:30:00.000Z");
    expect(() => gradeReview(state, "M01-A-number", "good", AT)).toThrow("早于");
    expect(() => queueReview(state, "M01-A-choice", "incorrect", "2026-02-30T00:00:00.000Z")).toThrow("ISO");
    expect(() => dueReviewEntries(state, "today")).toThrow("ISO");
    expect(() => gradeReview(createInitialState(AT), "M01-A-number", "good", AT)).toThrow("先把题目");
  });

  it.each([
    ["mismatched question", (state: LearningState) => { state.reviewQueue["M01-A-number"].questionId = "M01-B-number"; }],
    ["mismatched lesson", (state: LearningState) => { state.reviewQueue["M01-A-number"].lessonId = "M01-B"; }],
    ["fabricated grade", (state: LearningState) => { (state.reviewQueue["M01-A-number"] as unknown as Record<string, unknown>).grade = "mastered"; }],
    ["negative variant", (state: LearningState) => { state.reviewQueue["M01-A-number"].variant = -1; }],
    ["fractional interval", (state: LearningState) => { state.reviewQueue["M01-A-number"].intervalDays = .5; }],
    ["invalid due date", (state: LearningState) => { state.reviewQueue["M01-A-number"].dueAt = "2026-02-30T00:00:00.000Z"; }],
    ["unknown entry field", (state: LearningState) => { (state.reviewQueue["M01-A-number"] as unknown as Record<string, unknown>).scientificMastery = 1; }],
  ])("strictly rejects corrupted review entries: %s", (_label, mutate) => {
    const state = queueReview(createInitialState(AT), "M01-A-number", "incorrect", AT);
    mutate(state);
    expect(validateLearningState(state).ok).toBe(false);
  });
});

describe("reproducible experiment history", () => {
  it("captures immutable exact A/B inputs with deterministic unique IDs at the same time", () => {
    const initial = revealedState();
    const first = captureSnapshot(initial, "ML01", "价格变化", AT);
    const state = captureSnapshot(first, "ML01", "第二次比较", AT);
    expect(initial.experimentHistory).toEqual([]);
    expect(state.experimentHistory.map((entry) => entry.id)).toEqual([
      `snapshot:ML01:${AT}:1`, `snapshot:ML01:${AT}:2`,
    ]);
    expect(state.experimentHistory[0]).toMatchObject({
      modelVersion: 1, labId: "ML01", createdAt: AT, label: "价格变化",
      baseline: { px: 3 }, scenario: { px: 6 }, prediction: "预测 B 的 x 截距减半。", explanation: "",
    });
    state.labStates.ML01.scenario.px = 9;
    expect(state.experimentHistory[0].scenario.px).toBe(6);
    state.experimentHistory[0].scenario.px = 12;
    expect(state.experimentHistory[1].scenario.px).toBe(6);
  });

  it.each(["ML01", "ML04", "MX01"] as const)("restores %s into the matching lab without changing other labs", (id) => {
    let state = captureSnapshot(revealedState(), id, "可复现实验", AT);
    const snapshot = state.experimentHistory[0];
    const before = structuredClone(state);
    if (id === "ML01") { state.labStates.ML01.scenario.px = 12; state.labStates.ML01.revealed = false; }
    if (id === "ML04") { state.advancedLabStates.ML04.scenario.F = 90; state.advancedLabStates.ML04.explanation = "改动"; }
    if (id === "MX01") { state.extensionLabStates.MX01.scenario.px1 = 12; state.extensionLabStates.MX01.prediction = "改动"; }
    state = restoreSnapshot(state, snapshot.id);
    expect(state.labStates).toEqual(before.labStates);
    expect(state.advancedLabStates).toEqual(before.advancedLabStates);
    expect(state.extensionLabStates).toEqual(before.extensionLabStates);
    expect(state.experimentHistory).toEqual(before.experimentHistory);
  });

  it("refuses unrevealed labs and capacity overflow, keeping all forty existing records", () => {
    expect(() => captureSnapshot(createInitialState(AT), "ML01", "未运行", AT)).toThrow("先运行");
    expect(() => captureSnapshot(createInitialState(AT), "MX03", "未运行", AT)).toThrow("先运行");
    let state = revealedState();
    for (let i = 0; i < 40; i++) state = captureSnapshot(state, "ML01", `实验 ${i + 1}`, AT);
    const before = JSON.stringify(state);
    expect(() => captureSnapshot(state, "ML01", "溢出", NEXT)).toThrow("显式删除");
    expect(JSON.stringify(state)).toBe(before);
    const freed = deleteSnapshot(state, state.experimentHistory[0].id);
    expect(captureSnapshot(freed, "ML01", "显式腾出空间", NEXT).experimentHistory).toHaveLength(40);
  });

  it("deletes only the selected snapshot and its capstone reference", () => {
    let state = captureSnapshot(revealedState(), "ML01", "第一反事实", AT);
    state = captureSnapshot(state, "ML04", "第二反事实", NEXT);
    const [first, second] = state.experimentHistory;
    state.capstoneSnapshots = [first.id, second.id];
    const next = deleteSnapshot(state, first.id);
    expect(next.experimentHistory).toEqual([second]);
    expect(next.capstoneSnapshots).toEqual([second.id]);
    expect(next.labStates).toEqual(state.labStates);
    expect(state.experimentHistory).toHaveLength(2);
    expect(() => restoreSnapshot(next, "missing")).toThrow("找不到");
    expect(() => deleteSnapshot(next, "missing")).toThrow("找不到");
  });

  it.each([
    ["duplicate ID", (state: LearningState) => { state.experimentHistory.push(structuredClone(state.experimentHistory[0])); }],
    ["unknown lab", (state: LearningState) => { (state.experimentHistory[0] as unknown as Record<string, unknown>).labId = "ML12"; }],
    ["unknown model version", (state: LearningState) => { (state.experimentHistory[0] as unknown as Record<string, unknown>).modelVersion = 2; }],
    ["invalid exact parameter domain", (state: LearningState) => { state.experimentHistory[0].scenario.px = 0; }],
    ["foreign lab parameter", (state: LearningState) => { (state.experimentHistory[0].scenario as unknown as Record<string, unknown>).F = 20; }],
    ["long label", (state: LearningState) => { state.experimentHistory[0].label = "字".repeat(121); }],
    ["long explanation", (state: LearningState) => { state.experimentHistory[0].explanation = "字".repeat(20001); }],
    ["missing reference", (state: LearningState) => { state.capstoneSnapshots = ["missing"]; }],
    ["duplicate reference", (state: LearningState) => { state.capstoneSnapshots = [state.experimentHistory[0].id, state.experimentHistory[0].id]; }],
  ])("rejects invalid history and capstone references: %s", (_label, mutate) => {
    const state = captureSnapshot(revealedState(), "ML01", "测试", AT);
    mutate(state);
    expect(validateLearningState(state).ok).toBe(false);
  });

  it("validates extension snapshot shapes, active states and economic relational domains", () => {
    const state = captureSnapshot(revealedState(), "MX01", "补偿", AT);
    delete (state.experimentHistory[0].scenario as Record<string, number>).px1;
    expect(validateLearningState(state).ok).toBe(false);
    const valid = createInitialState(AT);
    valid.extensionLabStates.MX03.scenario.delta = 1;
    expect(validateLearningState(valid).ok).toBe(false);
    valid.extensionLabStates.MX03.scenario.delta = .75;
    valid.extensionLabStates.MX03.scenario.T = 1;
    expect(validateLearningState(valid).ok).toBe(false);
  });
});

describe("v3 records remain local and recoverable", () => {
  it("restores history, scheduling, extension labs and capstone IDs after refresh and JSON import", () => {
    let state = queueReview(revealedState(), "M12-B-review-risk", "uncertain", AT);
    state = gradeReview(state, "M12-B-review-risk", "good", AT);
    for (const id of ["ML01", "ML04", "MX01"] as const) state = captureSnapshot(state, id, id, AT);
    state.capstoneSnapshots = state.experimentHistory.slice(0, 2).map((snapshot) => snapshot.id);
    const storage = new FakeStorage();
    const store = createLearningStore({ storage, now: () => AT });
    expect(store.save(state).ok).toBe(true);
    expect(createLearningStore({ storage, now: () => AT }).load().state).toEqual(state);
    const second = createLearningStore({ storage: new FakeStorage(), now: () => NEXT });
    expect(second.importJson(store.exportJson()).ok).toBe(true);
    expect(second.load().state).toEqual(state);
  });

  it("resetting a lesson removes its review entries while preserving shared histories, and course reset clears all new records", () => {
    let state = queueReview(revealedState(), "M01-A-number", "incorrect", AT);
    state = queueReview(state, "M12-B-review-risk", "uncertain", AT);
    state = captureSnapshot(state, "ML01", "跨课使用的实验", AT);
    state.capstoneSnapshots = [state.experimentHistory[0].id];
    const storage = new FakeStorage();
    storage.setItem("courses:macroeconomics:v1", "other private course");
    const store = createLearningStore({ storage, now: () => AT });
    store.save(state);
    const reset = store.resetLesson("M01-A").state;
    expect(reset.reviewQueue["M01-A-number"]).toBeUndefined();
    expect(reset.reviewQueue["M12-B-review-risk"]).toBeDefined();
    expect(reset.experimentHistory).toEqual(state.experimentHistory);
    expect(reset.extensionLabStates).toEqual(state.extensionLabStates);
    expect(reset.capstoneSnapshots).toEqual(state.capstoneSnapshots);
    expect(store.reset().state).toEqual(createInitialState(AT));
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem("courses:macroeconomics:v1")).toBe("other private course");
  });

  it("keeps corrupt v3 histories untouched on load and ordinary save", () => {
    const state = captureSnapshot(revealedState(), "ML01", "原实验", AT);
    state.capstoneSnapshots = ["nonexistent"];
    const raw = JSON.stringify(state);
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, raw);
    const store = createLearningStore({ storage, now: () => AT });
    expect(store.load()).toMatchObject({ ok: false, status: "recovery" });
    expect(store.exportOriginal()).toBe(raw);
    expect(store.save(createInitialState(AT)).status).toBe("recovery");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("preserves user text as data and makes no network call on capture, save, import or export", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    try {
      const script = '<script>globalThis.historyExecuted=true</script>';
      let state = revealedState();
      state.extensionLabStates.MX01.prediction = script;
      state.extensionLabStates.MX01.explanation = script;
      state = captureSnapshot(state, "MX01", script, AT);
      const store = createLearningStore({ storage: new FakeStorage(), now: () => AT });
      store.save(state);
      const exported = store.exportJson();
      store.importJson(exported);
      expect(store.load().state.experimentHistory[0]).toMatchObject({ label: script, prediction: script, explanation: script });
      expect((globalThis as typeof globalThis & { historyExecuted?: boolean }).historyExecuted).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
