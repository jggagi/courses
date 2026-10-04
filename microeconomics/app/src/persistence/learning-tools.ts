import {
  ADVANCED_LAB_IDS, EXTENSION_LAB_IDS, LAB_IDS, SNAPSHOT_LIMIT,
  isKnownQuestionId, validateLearningState,
  type AdvancedLabId, type AdvancedLabState, type ExtensionLabId,
  type LabId, type LabParameters, type LabSnapshot, type LearningState,
  type LessonId, type ReviewEntry, type ReviewGrade, type SnapshotLabId,
} from "./store";

export type { LabSnapshot, ReviewEntry, ReviewGrade, SnapshotLabId, HistoryLabId } from "./store";

function checkedState(state: LearningState): LearningState {
  const checked = validateLearningState(state);
  if (!checked.ok) throw new Error(checked.error);
  return checked.state;
}
function time(value: string): number {
  const parsed = Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(parsed) || new Date(parsed).toISOString() !== value)
    throw new Error("请使用有效的 ISO UTC 时间。");
  return parsed;
}
function lessonOf(questionId: string): LessonId {
  if (!isKnownQuestionId(questionId)) throw new Error("题目 ID 无效，不能加入复习队列。");
  return questionId.slice(0, 5) as LessonId;
}

/** Initial queue entries are due immediately. Requeueing preserves the current
 * schedule and variant; an incorrect answer takes priority over uncertainty. */
export function queueReview(
  state: LearningState, questionId: string,
  reason: ReviewEntry["reason"], nowISO: string,
): LearningState {
  const lessonId = lessonOf(questionId);
  time(nowISO);
  if (reason !== "incorrect" && reason !== "uncertain") throw new Error("复习原因无效。");
  const next = checkedState(state);
  const existing = next.reviewQueue[questionId];
  next.reviewQueue[questionId] = existing
    ? { ...existing, reason: existing.reason === "incorrect" ? "incorrect" : reason }
    : { questionId, lessonId, dueAt: nowISO, intervalDays: 0,
        repetitions: 0, lapses: 0, lastReviewedAt: null, reason, grade: null, variant: 0 };
  next.updatedAt = nowISO;
  return checkedState(next);
}

/** This transparent schedule is a study aid, not a measured mastery score.
 * Again: 1 day, resets repetitions and adds one lapse. Hard: 3 days.
 * Good: 7, 14, 30, then 60 days, capped at 60. Every review advances the
 * variant once; hard/good add one successful repetition. No random clocks. */
export function gradeReview(
  state: LearningState, questionId: string, grade: ReviewGrade, nowISO: string,
): LearningState {
  lessonOf(questionId);
  const now = time(nowISO);
  if (!["again", "hard", "good"].includes(grade)) throw new Error("复习评级无效。");
  const next = checkedState(state);
  const entry = next.reviewQueue[questionId];
  if (!entry) throw new Error("请先把题目加入复习队列。");
  if (entry.lastReviewedAt !== null && now < time(entry.lastReviewedAt))
    throw new Error("复习时间不能早于上一次复习时间。");
  const intervalDays = grade === "again" ? 1 : grade === "hard" ? 3
    : entry.intervalDays < 7 ? 7 : entry.intervalDays < 14 ? 14
      : entry.intervalDays < 30 ? 30 : 60;
  const dueAt = new Date(now + intervalDays * 86_400_000).toISOString();
  next.reviewQueue[questionId] = {
    ...entry, grade, intervalDays, dueAt, lastReviewedAt: nowISO,
    repetitions: grade === "again" ? 0 : entry.repetitions + 1,
    lapses: entry.lapses + (grade === "again" ? 1 : 0),
    variant: entry.variant + 1,
  };
  next.updatedAt = nowISO;
  return checkedState(next);
}

export function dueReviewEntries(state: LearningState, nowISO: string): ReviewEntry[] {
  const now = time(nowISO);
  return Object.values(checkedState(state).reviewQueue)
    .filter((entry) => time(entry.dueAt) <= now)
    .sort((a, b) => a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1
      : a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0);
}

/** A snapshot captures exact inputs and the learner's text, never rounded graph
 * values. At capacity we refuse; deleting an earlier experiment is explicit. */
export function captureSnapshot(
  state: LearningState, labId: SnapshotLabId, label: string, nowISO: string,
): LearningState {
  time(nowISO);
  const next = checkedState(state);
  if (next.experimentHistory.length >= SNAPSHOT_LIMIT)
    throw new Error(`已保存 ${SNAPSHOT_LIMIT} 条实验；请先显式删除一条记录再保存。`);
  const basic = LAB_IDS.includes(labId as LabId);
  const lab = basic ? next.labStates[labId as LabId]
    : ADVANCED_LAB_IDS.includes(labId as AdvancedLabId) ? next.advancedLabStates[labId as AdvancedLabId]
      : EXTENSION_LAB_IDS.includes(labId as ExtensionLabId) ? next.extensionLabStates[labId as ExtensionLabId] : null;
  if (!lab) throw new Error("实验 ID 无效。");
  if (!lab.revealed) throw new Error("请先运行实验，再保存本次 A/B 快照。");
  let counter = 1;
  const prefix = `snapshot:${labId}:${nowISO}:`;
  while (next.experimentHistory.some((snapshot) => snapshot.id === `${prefix}${counter}`)) counter++;
  const snapshot: LabSnapshot = {
    id: `${prefix}${counter}`, labId, modelVersion: 1, createdAt: nowISO,
    baseline: lab.baseline, scenario: lab.scenario, prediction: lab.prediction,
    explanation: basic ? "" : (lab as AdvancedLabState).explanation, label,
  };
  next.experimentHistory.push(snapshot);
  next.updatedAt = nowISO;
  return checkedState(next);
}

export function restoreSnapshot(state: LearningState, id: string): LearningState {
  const next = checkedState(state);
  const snapshot = next.experimentHistory.find((entry) => entry.id === id);
  if (!snapshot) throw new Error("找不到这条实验快照。");
  const { labId, baseline, scenario, prediction, explanation } = snapshot;
  if (LAB_IDS.includes(labId as LabId))
    next.labStates[labId as LabId] = { baseline: baseline as LabParameters,
      scenario: scenario as LabParameters, prediction, revealed: true };
  else {
    const restored: AdvancedLabState = { baseline: baseline as Record<string, number>,
      scenario: scenario as Record<string, number>, prediction, explanation, revealed: true };
    if (ADVANCED_LAB_IDS.includes(labId as AdvancedLabId)) next.advancedLabStates[labId as AdvancedLabId] = restored;
    else next.extensionLabStates[labId as ExtensionLabId] = restored;
  }
  return checkedState(next);
}

export function deleteSnapshot(state: LearningState, id: string): LearningState {
  const next = checkedState(state);
  if (!next.experimentHistory.some((entry) => entry.id === id)) throw new Error("找不到这条实验快照。");
  next.experimentHistory = next.experimentHistory.filter((entry) => entry.id !== id);
  next.capstoneSnapshots = next.capstoneSnapshots.filter((reference) => reference !== id);
  return checkedState(next);
}
