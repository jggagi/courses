/** Local-only course records. This module never makes a network request. */
export const STORAGE_KEY = "courses:microeconomics:v1";
export const MAX_IMPORT_BYTES = 1024 * 1024;
export const LESSON_IDS = [
  "M01-A",
  "M01-B",
  "M02-A",
  "M02-B",
  "M03-A",
  "M03-B",
] as const;
export const LAB_IDS = ["ML01", "ML02", "ML03"] as const;
export type LessonId = (typeof LESSON_IDS)[number];
export type LabId = (typeof LAB_IDS)[number];
export type LessonStatus =
  "not_started" | "in_progress" | "practiced" | "self_checked";
export type Confidence = 1 | 2 | 3 | 4 | 5 | null;

export interface LabParameters {
  m: number;
  px: number;
  py: number;
  kind: "cd" | "linear" | "complements";
  alpha: number;
  a: number;
  b: number;
  x: number;
  y: number;
  secondX: number;
  secondY: number;
  representation: "u" | "square";
  unitScale: number;
}
export interface LabState {
  baseline: LabParameters;
  scenario: LabParameters;
  prediction: string;
  revealed: boolean;
}
export interface ObjectiveAttempt {
  answer: number | string;
  correct: boolean;
  at: string;
}
export interface SelfCheck {
  answer: string;
  rating: "needs_review" | "partial" | "clear";
}
export interface LearningState {
  schemaVersion: 1;
  courseId: "microeconomics";
  lastLessonId: LessonId | null;
  lessonStates: Record<LessonId, LessonStatus>;
  objectiveAttempts: Record<string, ObjectiveAttempt[]>;
  selfChecks: Record<string, SelfCheck>;
  notes: Partial<Record<LessonId, string>>;
  labStates: Record<LabId, LabState>;
  conceptConfidence: Record<LessonId, Confidence>;
  updatedAt: string;
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface StoreResult {
  state: LearningState;
  status: "saved" | "memory" | "recovery";
  notice: string | null;
  ok: boolean;
  error?: string;
}
export interface LearningStore {
  load(): StoreResult;
  save(state: LearningState): StoreResult;
  importJson(text: string): StoreResult;
  exportJson(): string;
  exportOriginal(): string | null;
  reset(): StoreResult;
  resetLesson(id: LessonId): StoreResult;
}

const MEMORY_NOTICE =
  "浏览器本地存储不可用；记录暂存在本次页面内，关闭或刷新后可能丢失。请显式导出备份。";
const STATE_KEYS = [
  "schemaVersion",
  "courseId",
  "lastLessonId",
  "lessonStates",
  "objectiveAttempts",
  "selfChecks",
  "notes",
  "labStates",
  "conceptConfidence",
  "updatedAt",
];
const PARAMETER_KEYS = [
  "m",
  "px",
  "py",
  "kind",
  "alpha",
  "a",
  "b",
  "x",
  "y",
  "secondX",
  "secondY",
  "representation",
  "unitScale",
];
const TEXT_LIMIT = 20_000;
const QUESTION_LIMIT = 100;
const ATTEMPT_LIMIT = 1000;

export function defaultLabParameters(id: LabId): LabParameters {
  return {
    m: 120,
    px: 3,
    py: 2,
    kind: "cd",
    alpha: 0.5,
    a: 1,
    b: 1,
    x: id === "ML02" ? 10 : 20,
    y: id === "ML02" ? 10 : 30,
    secondX: 20,
    secondY: 5,
    representation: "u",
    unitScale: 1,
  };
}

export function createInitialState(
  at = new Date().toISOString(),
): LearningState {
  return {
    schemaVersion: 1,
    courseId: "microeconomics",
    lastLessonId: null,
    lessonStates: Object.fromEntries(
      LESSON_IDS.map((id) => [id, "not_started"]),
    ) as LearningState["lessonStates"],
    objectiveAttempts: {},
    selfChecks: {},
    notes: {},
    labStates: Object.fromEntries(
      LAB_IDS.map((id) => [
        id,
        {
          baseline: defaultLabParameters(id),
          scenario: defaultLabParameters(id),
          prediction: "",
          revealed: false,
        },
      ]),
    ) as LearningState["labStates"],
    conceptConfidence: Object.fromEntries(
      LESSON_IDS.map((id) => [id, null]),
    ) as LearningState["conceptConfidence"],
    updatedAt: at,
  };
}

function object(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key) => !keys.includes(key))
  ) {
    throw new Error(`${path} 的字段缺失或含未知字段。`);
  }
}
function record(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  if (!object(value)) throw new Error(`${path} 必须是对象。`);
}
function textField(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.length > TEXT_LIMIT)
    throw new Error(`${path} 必须是长度不超过 ${TEXT_LIMIT} 的纯文本。`);
}
function numberIn(
  value: unknown,
  min: number,
  max: number,
  path: string,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(`${path} 必须是 ${min} 至 ${max} 范围内的有限数。`);
  }
}
function isoTimestamp(value: unknown, path: string): void {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error(`${path} 必须是有效的 ISO UTC 时间。`);
  }
}
function questionId(id: string): boolean {
  return (
    LESSON_IDS.some((lesson) => id.startsWith(`${lesson}-`)) &&
    /^M0[1-3]-[AB]-[a-z][a-z0-9-]{0,79}$/.test(id)
  );
}
function validateParameters(value: unknown, id: LabId, path: string): void {
  record(value, path);
  exactKeys(value, PARAMETER_KEYS, path);
  numberIn(value.m, 0, id === "ML03" ? 200 : 300, `${path}.m`);
  numberIn(value.px, 1, 20, `${path}.px`);
  numberIn(value.py, 1, 20, `${path}.py`);
  if (!["cd", "linear", "complements"].includes(value.kind as string))
    throw new Error(`${path}.kind 无效。`);
  numberIn(value.alpha, 0.1, 0.9, `${path}.alpha`);
  // ML03 intentionally fixes linear weights at 1:1; ML02 allows positive weights.
  for (const key of ["a", "b"] as const) {
    numberIn(
      value[key],
      Number.MIN_VALUE,
      Number.MAX_SAFE_INTEGER,
      `${path}.${key}`,
    );
    if (id === "ML03" && value[key] !== 1)
      throw new Error(`${path}.${key} 在 ML03 必须等于 1。`);
  }
  for (const key of ["x", "y", "secondX", "secondY"] as const) {
    numberIn(
      value[key],
      0,
      id === "ML02" ? 60 : Number.MAX_SAFE_INTEGER,
      `${path}.${key}`,
    );
  }
  if (!["u", "square"].includes(value.representation as string))
    throw new Error(`${path}.representation 无效。`);
  numberIn(
    value.unitScale,
    Number.MIN_VALUE,
    Number.MAX_SAFE_INTEGER,
    `${path}.unitScale`,
  );
  if (
    ![value.m, value.px, value.py].every((entry) =>
      Number.isFinite((entry as number) * (value.unitScale as number)),
    )
  ) {
    throw new Error(`${path}.unitScale 会使表示数值溢出。`);
  }
}

/** Strict validation deliberately rejects extra fields and other courses. */
export function validateLearningState(
  value: unknown,
): { ok: true; state: LearningState } | { ok: false; error: string } {
  try {
    record(value, "学习记录");
    if (value.courseId !== "microeconomics")
      throw new Error("课程不匹配：只接受 microeconomics 的学习记录。");
    if (value.schemaVersion !== 1)
      throw new Error("未知 schemaVersion；原记录不会被覆盖，请保留原文件。");
    exactKeys(value, STATE_KEYS, "学习记录");
    if (
      value.lastLessonId !== null &&
      !LESSON_IDS.includes(value.lastLessonId as LessonId)
    )
      throw new Error("lastLessonId 不是已实现课节。");
    record(value.lessonStates, "lessonStates");
    exactKeys(value.lessonStates, LESSON_IDS, "lessonStates");
    for (const id of LESSON_IDS) {
      if (
        !["not_started", "in_progress", "practiced", "self_checked"].includes(
          value.lessonStates[id] as string,
        )
      )
        throw new Error(`lessonStates.${id} 无效。`);
    }
    record(value.objectiveAttempts, "objectiveAttempts");
    if (Object.keys(value.objectiveAttempts).length > QUESTION_LIMIT)
      throw new Error("客观题记录数量超过上限。");
    for (const [id, attempts] of Object.entries(value.objectiveAttempts)) {
      if (!questionId(id)) throw new Error(`无效题目 ID：${id}。`);
      if (!Array.isArray(attempts) || attempts.length > ATTEMPT_LIMIT)
        throw new Error(`${id} 的尝试必须是数组且不超过 ${ATTEMPT_LIMIT} 条。`);
      for (const attempt of attempts) {
        record(attempt, id);
        exactKeys(attempt, ["answer", "correct", "at"], id);
        if (typeof attempt.answer === "string")
          textField(attempt.answer, `${id}.answer`);
        else if (
          typeof attempt.answer !== "number" ||
          !Number.isFinite(attempt.answer)
        )
          throw new Error(`${id}.answer 必须是有限数或文本。`);
        if (typeof attempt.correct !== "boolean")
          throw new Error(`${id}.correct 必须是布尔值。`);
        isoTimestamp(attempt.at, `${id}.at`);
      }
    }
    record(value.selfChecks, "selfChecks");
    if (Object.keys(value.selfChecks).length > QUESTION_LIMIT)
      throw new Error("自评记录数量超过上限。");
    for (const [id, selfCheck] of Object.entries(value.selfChecks)) {
      if (!questionId(id)) throw new Error(`无效自评题目 ID：${id}。`);
      record(selfCheck, id);
      exactKeys(selfCheck, ["answer", "rating"], id);
      textField(selfCheck.answer, `${id}.answer`);
      if (
        !["needs_review", "partial", "clear"].includes(
          selfCheck.rating as string,
        )
      )
        throw new Error(`${id}.rating 无效。`);
    }
    record(value.notes, "notes");
    for (const [id, note] of Object.entries(value.notes)) {
      if (!LESSON_IDS.includes(id as LessonId))
        throw new Error(`无效笔记课节 ID：${id}。`);
      textField(note, `notes.${id}`);
    }
    record(value.labStates, "labStates");
    exactKeys(value.labStates, LAB_IDS, "labStates");
    for (const id of LAB_IDS) {
      const lab = value.labStates[id];
      record(lab, id);
      exactKeys(lab, ["baseline", "scenario", "prediction", "revealed"], id);
      validateParameters(lab.baseline, id, `${id}.baseline`);
      validateParameters(lab.scenario, id, `${id}.scenario`);
      textField(lab.prediction, `${id}.prediction`);
      if (typeof lab.revealed !== "boolean")
        throw new Error(`${id}.revealed 必须是布尔值。`);
    }
    record(value.conceptConfidence, "conceptConfidence");
    exactKeys(value.conceptConfidence, LESSON_IDS, "conceptConfidence");
    for (const id of LESSON_IDS) {
      const confidence = value.conceptConfidence[id];
      if (
        confidence !== null &&
        (!Number.isInteger(confidence) ||
          (confidence as number) < 1 ||
          (confidence as number) > 5)
      )
        throw new Error(`${id} 的概念信心必须是 1–5 或 null。`);
    }
    isoTimestamp(value.updatedAt, "updatedAt");
    const serialized = JSON.stringify(value);
    if (new TextEncoder().encode(serialized).byteLength > MAX_IMPORT_BYTES)
      throw new Error("学习记录超过 1 MiB 大小限制。");
    // JSON cloning gives callers a detached plain-data snapshot.
    return { ok: true, state: JSON.parse(serialized) as LearningState };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "学习记录无效。",
    };
  }
}

function parseLearningJson(
  source: string,
): ReturnType<typeof validateLearningState> {
  if (
    typeof source !== "string" ||
    new TextEncoder().encode(source).byteLength > MAX_IMPORT_BYTES
  )
    return { ok: false, error: "文件超过 1 MiB 大小限制。" };
  try {
    return validateLearningState(JSON.parse(source));
  } catch {
    return { ok: false, error: "JSON 无法解析；请保留原文件并检查格式。" };
  }
}
function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Pass storage:null for memory-only use; omit storage to use browser localStorage. */
export function createLearningStore(
  options: { storage?: StorageLike | null; now?: () => string } = {},
): LearningStore {
  const now = options.now ?? (() => new Date().toISOString());
  const storage =
    options.storage === undefined ? browserStorage() : options.storage;
  // Keep the handle for an explicit reset even if quota prevents ordinary saves.
  let canPersist = storage !== null;
  let current = createInitialState(now());
  let loaded = false;
  let status: StoreResult["status"] = storage === null ? "memory" : "saved";
  let notice: string | null = storage === null ? MEMORY_NOTICE : null;
  let original: string | null = null;

  function snapshot(ok = true, error?: string): StoreResult {
    return {
      state: JSON.parse(JSON.stringify(current)) as LearningState,
      status,
      notice,
      ok,
      ...(error ? { error } : {}),
    };
  }
  function load(): StoreResult {
    if (loaded) return snapshot();
    loaded = true;
    if (storage === null) return snapshot();
    try {
      const source = storage.getItem(STORAGE_KEY);
      if (source === null) return snapshot();
      const parsed = parseLearningJson(source);
      if (parsed.ok) current = parsed.state;
      else {
        original = source;
        status = "recovery";
        notice = `本地记录无法读取：${parsed.error} 原记录已保留；可下载原记录、导入有效备份，或确认后清空本课记录。当前修改暂存在内存中。`;
        return snapshot(false, parsed.error);
      }
    } catch {
      canPersist = false;
      status = "memory";
      notice = MEMORY_NOTICE;
    }
    return snapshot();
  }
  function persist(): StoreResult {
    // Never silently overwrite corrupt or newer-format records during normal learning.
    if (original !== null) return snapshot();
    if (storage !== null && canPersist) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(current));
        status = "saved";
        notice = null;
      } catch {
        canPersist = false;
        status = "memory";
        notice = MEMORY_NOTICE;
      }
    }
    return snapshot();
  }
  function save(candidate: LearningState): StoreResult {
    load();
    const checked = validateLearningState(candidate);
    if (!checked.ok) return snapshot(false, checked.error);
    current = { ...checked.state, updatedAt: now() };
    return persist();
  }
  function importJson(source: string): StoreResult {
    load();
    const checked = parseLearningJson(source);
    if (!checked.ok) return snapshot(false, checked.error);
    current = checked.state;
    // Import is an explicit replacement. Preserve the original if replacement cannot be written.
    if (storage !== null) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(current));
        original = null;
        canPersist = true;
        status = "saved";
        notice = null;
      } catch {
        if (original !== null)
          return snapshot(
            false,
            "有效备份已在内存中打开，但浏览器未能写入；本地原记录仍保留。请导出当前记录。",
          );
        canPersist = false;
        status = "memory";
        notice = MEMORY_NOTICE;
      }
    } else {
      status = "memory";
      notice = MEMORY_NOTICE;
    }
    return snapshot();
  }
  function reset(): StoreResult {
    load();
    if (storage !== null) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        return snapshot(false, "浏览器未能删除本课记录；原记录仍保留。");
      }
    }
    original = null;
    current = createInitialState(now());
    // Deletion can succeed despite a previous read/write error. Future writes may
    // now succeed after quota has been freed, so retry on the next ordinary save.
    canPersist = storage !== null;
    status = canPersist ? "saved" : "memory";
    notice = canPersist ? null : MEMORY_NOTICE;
    return snapshot();
  }
  function resetLesson(id: LessonId): StoreResult {
    load();
    if (!LESSON_IDS.includes(id)) return snapshot(false, "课节 ID 无效。");
    const next = snapshot().state;
    next.lessonStates[id] = "not_started";
    next.conceptConfidence[id] = null;
    delete next.notes[id];
    for (const question of Object.keys(next.objectiveAttempts))
      if (question.startsWith(`${id}-`))
        delete next.objectiveAttempts[question];
    for (const question of Object.keys(next.selfChecks))
      if (question.startsWith(`${id}-`)) delete next.selfChecks[question];
    if (next.lastLessonId === id) next.lastLessonId = null;
    return save(next);
  }
  return {
    load,
    save,
    importJson,
    reset,
    resetLesson,
    exportJson: () => {
      load();
      return JSON.stringify(current, null, 2);
    },
    exportOriginal: () => {
      load();
      return original;
    },
  };
}
