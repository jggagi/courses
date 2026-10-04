import {
  advancedDefaults,
  advancedLabDefinitions,
  runAdvancedLab,
  ADVANCED_LAB_IDS,
  type AdvancedLabId,
} from "../models/advanced";
import {
  EXTENSION_LAB_IDS,
  extensionDefaults,
  extensionLabDefinitions,
  runExtensionLab,
  type ExtensionLabId,
} from "../models/extensions";

export { ADVANCED_LAB_IDS, EXTENSION_LAB_IDS };
export type { AdvancedLabId, ExtensionLabId };

/** Local-only course records. This module never makes a network request. */
export const STORAGE_KEY = "courses:microeconomics:v1";
export const MAX_IMPORT_BYTES = 1024 * 1024;
const LEGACY_LESSON_IDS = [
  "M01-A",
  "M01-B",
  "M02-A",
  "M02-B",
  "M03-A",
  "M03-B",
] as const;
export const LESSON_IDS = [
  ...LEGACY_LESSON_IDS,
  "M04-A", "M04-B", "M05-A", "M05-B", "M06-A", "M06-B",
  "M07-A", "M07-B", "M08-A", "M08-B", "M09-A", "M09-B",
  "M10-A", "M10-B", "M11-A", "M11-B", "M12-A", "M12-B",
] as const;
// The first three labs keep their historical parameter shape and UI contract.
export const LAB_IDS = ["ML01", "ML02", "ML03"] as const;
export type LessonId = (typeof LESSON_IDS)[number];
export type LabId = (typeof LAB_IDS)[number];
export type LessonStatus =
  "not_started" | "in_progress" | "practiced" | "self_checked";
export type Confidence = 1 | 2 | 3 | 4 | 5 | null;
export const KNOWN_QUESTION_IDS: readonly string[] = [
  ...LESSON_IDS.flatMap((id) => ["explain", "choice", "number", "transfer"].map((suffix) => `${id}-${suffix}`)),
  ...["cost", "tax", "game", "risk"].map((topic) => `M12-B-review-${topic}`),
];
export const SNAPSHOT_LIMIT = 40;
export type ReviewGrade = "again" | "hard" | "good";
export interface ReviewEntry {
  questionId: string;
  lessonId: LessonId;
  dueAt: string;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  lastReviewedAt: string | null;
  reason: "incorrect" | "uncertain";
  grade: ReviewGrade | null;
  variant: number;
}
export type SnapshotLabId = LabId | AdvancedLabId | ExtensionLabId;
export type HistoryLabId = SnapshotLabId;
export interface LabSnapshot {
  id: string;
  labId: SnapshotLabId;
  modelVersion: 1;
  createdAt: string;
  baseline: LabParameters | Record<string, number>;
  scenario: LabParameters | Record<string, number>;
  prediction: string;
  explanation: string;
  label: string;
}

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
export interface AdvancedLabState {
  baseline: Record<string, number>;
  scenario: Record<string, number>;
  prediction: string;
  revealed: boolean;
  explanation: string;
}
export interface CapstoneState {
  object: string;
  baseline: string;
  counterfactuals: string;
  boundaries: string;
  evidence: string;
  reflection: string;
}
export interface LearningState {
  schemaVersion: 3;
  courseId: "microeconomics";
  lastLessonId: LessonId | null;
  lessonStates: Record<LessonId, LessonStatus>;
  objectiveAttempts: Record<string, ObjectiveAttempt[]>;
  selfChecks: Record<string, SelfCheck>;
  notes: Partial<Record<LessonId, string>>;
  labStates: Record<LabId, LabState>;
  advancedLabStates: Record<AdvancedLabId, AdvancedLabState>;
  capstone: CapstoneState;
  reviewQueue: Record<string, ReviewEntry>;
  experimentHistory: LabSnapshot[];
  extensionLabStates: Record<ExtensionLabId, AdvancedLabState>;
  capstoneSnapshots: string[];
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
const LEGACY_STATE_KEYS = [
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
const V2_STATE_KEYS = [...LEGACY_STATE_KEYS, "advancedLabStates", "capstone"];
const STATE_KEYS = [...V2_STATE_KEYS, "reviewQueue", "experimentHistory", "extensionLabStates", "capstoneSnapshots"];
const CAPSTONE_KEYS = [
  "object", "baseline", "counterfactuals", "boundaries", "evidence", "reflection",
] as const;
const MIGRATION_NOTICE =
  "原有学习记录已迁移到版本 3；进度、练习、笔记和实验均已保留。新增复习队列和实验历史为空，后续保存及导出使用版本 3。";
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
    schemaVersion: 3,
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
    advancedLabStates: Object.fromEntries(
      ADVANCED_LAB_IDS.map((id) => [
        id,
        {
          baseline: advancedDefaults(id),
          scenario: advancedDefaults(id),
          prediction: "",
          revealed: false,
          explanation: "",
        },
      ]),
    ) as LearningState["advancedLabStates"],
    capstone: {
      object: "", baseline: "", counterfactuals: "",
      boundaries: "", evidence: "", reflection: "",
    },
    reviewQueue: {},
    experimentHistory: [],
    extensionLabStates: Object.fromEntries(
      EXTENSION_LAB_IDS.map((id) => [id, {
        baseline: extensionDefaults(id), scenario: extensionDefaults(id),
        prediction: "", revealed: false, explanation: "",
      }]),
    ) as LearningState["extensionLabStates"],
    capstoneSnapshots: [],
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
function questionId(id: string, legacy: boolean): boolean {
  const lessons: readonly string[] = legacy ? LEGACY_LESSON_IDS : LESSON_IDS;
  const suffixes = ["explain", "choice", "number", "transfer"];
  if (lessons.some((lesson) => suffixes.some((suffix) => id === `${lesson}-${suffix}`)))
    return true;
  return !legacy && ["cost", "tax", "game", "risk"].some(
    (topic) => id === `M12-B-review-${topic}`,
  );
}
export function isKnownQuestionId(id: string): boolean {
  return KNOWN_QUESTION_IDS.includes(id);
}
function validateAdvancedParameters(
  value: unknown,
  id: AdvancedLabId,
  path: string,
): void {
  record(value, path);
  exactKeys(value, Object.keys(advancedDefaults(id)), path);
  const definition = advancedLabDefinitions.find((entry) => entry.id === id)!;
  for (const field of definition.fields) {
    numberIn(value[field.key], field.min, field.max, `${path}.${field.key}`);
    if (["noBorrow", "legalPayer"].includes(field.key) &&
      value[field.key] !== 0 && value[field.key] !== 1)
      throw new Error(`${path}.${field.key} 必须是 0 或 1。`);
  }
  // Validate input domains with the same kernel as the experiment. A valid
  // boundary case may yield no trade/no pure equilibrium/no log-domain solution.
  // Such outcomes are legitimate saved states, rather than malformed imports.
  runAdvancedLab(id, value as Record<string, number>);
}
function validateExtensionParameters(value: unknown, id: ExtensionLabId, path: string): void {
  record(value, path);
  exactKeys(value, Object.keys(extensionDefaults(id)), path);
  const definition = extensionLabDefinitions.find((entry) => entry.id === id)!;
  for (const field of definition.fields)
    numberIn(value[field.key], field.min, field.max, `${path}.${field.key}`);
  runExtensionLab(id, value as Record<string, number>);
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

function nonnegativeInteger(value: unknown, path: string): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error(`${path} 必须是非负安全整数。`);
}
function validateLearningTools(value: Record<string, unknown>): void {
  record(value.extensionLabStates, "extensionLabStates");
  exactKeys(value.extensionLabStates, EXTENSION_LAB_IDS, "extensionLabStates");
  for (const id of EXTENSION_LAB_IDS) {
    const lab = value.extensionLabStates[id];
    record(lab, id);
    exactKeys(lab, ["baseline", "scenario", "prediction", "revealed", "explanation"], id);
    validateExtensionParameters(lab.baseline, id, `${id}.baseline`);
    validateExtensionParameters(lab.scenario, id, `${id}.scenario`);
    textField(lab.prediction, `${id}.prediction`);
    textField(lab.explanation, `${id}.explanation`);
    if (typeof lab.revealed !== "boolean") throw new Error(`${id}.revealed 必须是布尔值。`);
  }
  record(value.reviewQueue, "reviewQueue");
  if (Object.keys(value.reviewQueue).length > QUESTION_LIMIT)
    throw new Error("复习队列超过题目数量上限。");
  for (const [id, entry] of Object.entries(value.reviewQueue)) {
    if (!isKnownQuestionId(id)) throw new Error(`无效复习题目 ID：${id}。`);
    record(entry, id);
    exactKeys(entry, ["questionId", "lessonId", "dueAt", "intervalDays", "repetitions", "lapses", "lastReviewedAt", "reason", "grade", "variant"], id);
    if (entry.questionId !== id || entry.lessonId !== id.slice(0, 5))
      throw new Error(`${id} 的题目与课节不匹配。`);
    isoTimestamp(entry.dueAt, `${id}.dueAt`);
    for (const field of ["intervalDays", "repetitions", "lapses", "variant"])
      nonnegativeInteger(entry[field], `${id}.${field}`);
    if (![0, 1, 3, 7, 14, 30, 60].includes(entry.intervalDays as number))
      throw new Error(`${id}.intervalDays 无效。`);
    if (!["incorrect", "uncertain"].includes(entry.reason as string))
      throw new Error(`${id}.reason 无效。`);
    if (entry.grade === null) {
      if (entry.lastReviewedAt !== null || entry.intervalDays !== 0 || entry.repetitions !== 0 || entry.lapses !== 0 || entry.variant !== 0)
        throw new Error(`${id} 的未复习状态不一致。`);
    } else {
      if (!["again", "hard", "good"].includes(entry.grade as string))
        throw new Error(`${id}.grade 无效。`);
      isoTimestamp(entry.lastReviewedAt, `${id}.lastReviewedAt`);
      if ((entry.lastReviewedAt as string) > (entry.dueAt as string) || entry.variant === 0)
        throw new Error(`${id} 的复习时间或变式次数无效。`);
      const validInterval = entry.grade === "again" ? entry.intervalDays === 1
        : entry.grade === "hard" ? entry.intervalDays === 3
          : [7, 14, 30, 60].includes(entry.intervalDays as number);
      if (!validInterval || (entry.grade === "again" ? entry.repetitions !== 0 || (entry.lapses as number) < 1 : (entry.repetitions as number) < 1))
        throw new Error(`${id} 的复习评级与间隔不一致。`);
    }
  }
  if (!Array.isArray(value.experimentHistory) || value.experimentHistory.length > SNAPSHOT_LIMIT)
    throw new Error(`实验历史必须是数组且不超过 ${SNAPSHOT_LIMIT} 条；请先显式删除记录。`);
  const snapshotIds = new Set<string>();
  for (const snapshot of value.experimentHistory) {
    record(snapshot, "实验快照");
    exactKeys(snapshot, ["id", "labId", "modelVersion", "createdAt", "baseline", "scenario", "prediction", "explanation", "label"], "实验快照");
    if (typeof snapshot.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.test(snapshot.id) || snapshotIds.has(snapshot.id))
      throw new Error("快照 ID 无效或重复。");
    snapshotIds.add(snapshot.id);
    if (snapshot.modelVersion !== 1) throw new Error("未知快照模型版本；请保留原记录。");
    isoTimestamp(snapshot.createdAt, `${snapshot.id}.createdAt`);
    for (const key of ["prediction", "explanation", "label"])
      textField(snapshot[key], `${snapshot.id}.${key}`);
    if ((snapshot.label as string).length > 120) throw new Error("快照名称不能超过 120 字符。");
    const id = snapshot.labId;
    const validate = (parameters: unknown, path: string) => {
      if (LAB_IDS.includes(id as LabId)) validateParameters(parameters, id as LabId, path);
      else if (ADVANCED_LAB_IDS.includes(id as AdvancedLabId)) validateAdvancedParameters(parameters, id as AdvancedLabId, path);
      else if (EXTENSION_LAB_IDS.includes(id as ExtensionLabId)) validateExtensionParameters(parameters, id as ExtensionLabId, path);
      else throw new Error("快照含未知实验 ID。");
    };
    validate(snapshot.baseline, `${snapshot.id}.baseline`);
    validate(snapshot.scenario, `${snapshot.id}.scenario`);
  }
  if (!Array.isArray(value.capstoneSnapshots) || value.capstoneSnapshots.length > SNAPSHOT_LIMIT ||
      new Set(value.capstoneSnapshots).size !== value.capstoneSnapshots.length ||
      Array.from(value.capstoneSnapshots).some((id) => typeof id !== "string" || !snapshotIds.has(id)))
    throw new Error("终课作品引用必须是现存、不重复的快照 ID。");
}

/** Strict validation deliberately rejects extra fields and other courses. */
export function validateLearningState(
  value: unknown,
): { ok: true; state: LearningState; migrated: boolean } | { ok: false; error: string } {
  try {
    record(value, "学习记录");
    if (value.courseId !== "microeconomics")
      throw new Error("课程不匹配：只接受 microeconomics 的学习记录。");
    if (value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3)
      throw new Error("未知 schemaVersion；原记录不会被覆盖，请保留原文件。");
    const legacy = value.schemaVersion === 1;
    const lessonIds: readonly string[] = legacy ? LEGACY_LESSON_IDS : LESSON_IDS;
    const historical = value.schemaVersion !== 3;
    exactKeys(value, legacy ? LEGACY_STATE_KEYS : historical ? V2_STATE_KEYS : STATE_KEYS, "学习记录");
    if (
      value.lastLessonId !== null &&
      !lessonIds.includes(value.lastLessonId as string)
    )
      throw new Error("lastLessonId 不是已实现课节。");
    record(value.lessonStates, "lessonStates");
    exactKeys(value.lessonStates, lessonIds, "lessonStates");
    for (const id of lessonIds) {
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
      if (!questionId(id, legacy)) throw new Error(`无效题目 ID：${id}。`);
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
      if (!questionId(id, legacy)) throw new Error(`无效自评题目 ID：${id}。`);
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
      if (!lessonIds.includes(id))
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
    if (!legacy) {
      record(value.advancedLabStates, "advancedLabStates");
      exactKeys(value.advancedLabStates, ADVANCED_LAB_IDS, "advancedLabStates");
      for (const id of ADVANCED_LAB_IDS) {
        const lab = value.advancedLabStates[id];
        record(lab, id);
        exactKeys(lab, ["baseline", "scenario", "prediction", "revealed", "explanation"], id);
        validateAdvancedParameters(lab.baseline, id, `${id}.baseline`);
        validateAdvancedParameters(lab.scenario, id, `${id}.scenario`);
        textField(lab.prediction, `${id}.prediction`);
        textField(lab.explanation, `${id}.explanation`);
        if (typeof lab.revealed !== "boolean")
          throw new Error(`${id}.revealed 必须是布尔值。`);
      }
      record(value.capstone, "capstone");
      exactKeys(value.capstone, CAPSTONE_KEYS, "capstone");
      for (const key of CAPSTONE_KEYS) textField(value.capstone[key], `capstone.${key}`);
    }
    if (!historical) validateLearningTools(value);
    record(value.conceptConfidence, "conceptConfidence");
    exactKeys(value.conceptConfidence, lessonIds, "conceptConfidence");
    for (const id of lessonIds) {
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
    // Validate every historical field before adding defaults. Otherwise corrupt
    // v1 records could be made superficially valid by filling missing lessons.
    const detached = JSON.parse(serialized) as LearningState;
    if (historical) {
      const defaults = createInitialState(detached.updatedAt);
      return {
        ok: true,
        migrated: true,
        state: {
          ...defaults,
          ...detached,
          schemaVersion: 3,
          lessonStates: { ...defaults.lessonStates, ...detached.lessonStates },
          conceptConfidence: { ...defaults.conceptConfidence, ...detached.conceptConfidence },
        },
      };
    }
    // JSON cloning gives callers a detached plain-data snapshot.
    return { ok: true, state: detached, migrated: false };
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
      if (parsed.ok) {
        current = parsed.state;
        // Loading never writes. Valid v1/v2 records remain intact until the user
        // next saves, imports or explicitly resets; exports are already v3.
        if (parsed.migrated) notice = MIGRATION_NOTICE;
      } else {
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
        notice = checked.migrated ? MIGRATION_NOTICE : null;
      } catch {
        if (original !== null)
          return snapshot(
            false,
            "有效备份已在内存中打开，但浏览器未能写入；本地原记录仍保留。请导出当前记录。",
          );
        canPersist = false;
        status = "memory";
        notice = checked.migrated ? `${MIGRATION_NOTICE} ${MEMORY_NOTICE}` : MEMORY_NOTICE;
      }
    } else {
      status = "memory";
      notice = checked.migrated ? `${MIGRATION_NOTICE} ${MEMORY_NOTICE}` : MEMORY_NOTICE;
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
    for (const [question, entry] of Object.entries(next.reviewQueue))
      if (entry.lessonId === id) delete next.reviewQueue[question];
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
