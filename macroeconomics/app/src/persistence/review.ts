import type { Check, Lesson } from "../content/types";
import type { Attempt, LearningState } from ".";

export interface ObjectiveAssessment {
  status: "correct" | "incorrect" | "unavailable";
  feedback: string;
}

/** Recompute from the current question; an imported `correct` flag is only history. */
export function assessObjective(
  check: Check,
  answer: string,
): ObjectiveAssessment {
  if (check.kind === "numeric") {
    const trimmed = answer.trim();
    const number = Number(trimmed);
    if (
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed) ||
      !Number.isFinite(number) ||
      !Number.isFinite(check.value) ||
      !Number.isFinite(check.tolerance) ||
      check.tolerance! < 0
    ) {
      return {
        status: "unavailable",
        feedback: "这份数值答案不能按当前题目核对，请重新输入有限数值。",
      };
    }
    const correct = Math.abs(number - check.value!) <= check.tolerance!;
    return {
      status: correct ? "correct" : "incorrect",
      feedback: correct
        ? `数值核对正确。${check.answer}`
        : `${check.misconception || "先统一对象、时期和单位。"} 参考：${check.answer}`,
    };
  }
  if (check.kind === "choice") {
    const index = /^(0|[1-9]\d*)$/.test(answer) ? Number(answer) : -1;
    const option = Number.isSafeInteger(index) ? check.options?.[index] : null;
    if (!option) {
      return {
        status: "unavailable",
        feedback: "这份选择答案不能对应当前选项，请重新选择一个解释。",
      };
    }
    return {
      status: option.correct ? "correct" : "incorrect",
      feedback: option.feedback,
    };
  }
  return {
    status: "unavailable",
    feedback: "自由回答需要对照参考解释自行检查，不能自动判为客观正确。",
  };
}

export interface ReviewItem {
  lesson: Lesson;
  check: Check;
  attempt: Attempt;
  assessment: ObjectiveAssessment;
  /** Array order is the append order; imported dates do not rearrange attempts. */
  order: number;
  history: { attempt: Attempt; assessment: ObjectiveAssessment }[];
}

export interface UnmatchedAttempt {
  attempt: Attempt;
  reason: string;
}

export function buildReviewQueue(
  attempts: readonly Attempt[],
  catalogue: readonly Lesson[],
): {
  pending: ReviewItem[];
  resolved: ReviewItem[];
  unmatched: UnmatchedAttempt[];
  reconciledCount: number;
} {
  const questions = new Map(
    catalogue.flatMap((lesson) =>
      lesson.checks.map((check) => [check.id, { lesson, check }] as const),
    ),
  );
  const latest = new Map<string, ReviewItem>();
  const unmatched: UnmatchedAttempt[] = [];
  let reconciledCount = 0;
  attempts.forEach((attempt, order) => {
    const found = questions.get(attempt.checkId);
    if (
      !found ||
      found.lesson.id !== attempt.lessonId ||
      !["numeric", "choice"].includes(found.check.kind)
    ) {
      unmatched.push({
        attempt,
        reason: !found
          ? "当前课程中没有这道题，可能来自较早的题目版本。"
          : found.lesson.id !== attempt.lessonId
            ? "题目与所记课号不一致，无法归入这节课。"
            : "这是自由回答题，原记录中的客观判定无法核实。",
      });
      return;
    }
    const assessment = assessObjective(found.check, attempt.answer);
    if (
      assessment.status !== "unavailable" &&
      (assessment.status === "correct") !== attempt.correct
    )
      reconciledCount++;
    const previous = latest.get(found.check.id);
    latest.set(found.check.id, {
      ...found,
      attempt,
      assessment,
      order,
      history: [...(previous?.history || []), { attempt, assessment }],
    });
  });
  const items = [...latest.values()].sort((a, b) => b.order - a.order);
  return {
    pending: items.filter((item) => item.assessment.status !== "correct"),
    resolved: items.filter(
      (item) =>
        item.assessment.status === "correct" &&
        item.history
          .slice(0, -1)
          .some((entry) => entry.assessment.status !== "correct"),
    ),
    unmatched,
    reconciledCount,
  };
}

export function recordReviewAttempt(
  state: LearningState,
  lesson: Lesson,
  check: Check,
  answer: string,
  at: string,
): { state: LearningState; assessment: ObjectiveAssessment } {
  if (!lesson.checks.some((candidate) => candidate === check))
    throw new Error("复习题与课号不一致。");
  const assessment = assessObjective(check, answer);
  if (assessment.status === "unavailable") throw new Error(assessment.feedback);
  const selfChecked = lesson.checks
    .filter((candidate) => ["explanation", "transfer"].includes(candidate.kind))
    .every((candidate) => state.selfChecks[candidate.id] === true);
  return {
    assessment,
    state: {
      ...state,
      updatedAt: at,
      notes: {
        ...state.notes,
        [`response:${check.id}`]: answer,
        [`review:retry:${check.id}`]: answer,
      },
      selfChecks: {
        ...state.selfChecks,
        [`review:mistake:${check.id}`]: false,
      },
      objectiveAttempts: [
        ...state.objectiveAttempts,
        {
          lessonId: lesson.id,
          checkId: check.id,
          answer,
          correct: assessment.status === "correct",
          at,
        },
      ].slice(-1000),
      lessonStates: {
        ...state.lessonStates,
        [lesson.id]: {
          ...state.lessonStates[lesson.id],
          status: selfChecked ? "self_checked" : "practiced",
        },
      },
    },
  };
}

export const modelCardFields = [
  "研究对象",
  "已知条件",
  "待求变量",
  "核心关系",
  "推导",
  "反例",
  "我仍不确定的地方",
] as const;

/** These are filled fields, not a grade or a measure of understanding. */
export function modelCardFilledFields(
  notes: Record<string, string>,
  moduleId: string,
): string[] {
  return modelCardFields.filter((field) =>
    notes[`card:${moduleId}:${field}`]?.trim(),
  );
}

export function lessonCheckHref(lesson: Lesson, check: Check): string {
  return `#/lesson/${lesson.id}/check/${check.id}`;
}

/** A self-check describes this text, so editing invalidates that explicit check. */
export function writeReviewNote(
  state: LearningState,
  key: string,
  value: string,
  selfCheckKey = key,
): LearningState {
  return {
    ...state,
    notes: { ...state.notes, [key]: value },
    selfChecks: { ...state.selfChecks, [selfCheckKey]: false },
  };
}
