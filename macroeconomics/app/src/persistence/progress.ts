import type { Lesson } from "../content/types";
import type { LearningState, LessonStatus } from ".";

/** Operations preserve earlier evidence; these states do not measure mastery. */
export function deriveLessonStatus(
  lesson: Lesson,
  state: LearningState,
): LessonStatus {
  const subjective = lesson.checks.filter(
    (check) => check.kind === "explanation" || check.kind === "transfer",
  );
  if (
    subjective.length > 0 &&
    subjective.every((check) => state.selfChecks[check.id])
  )
    return "self_checked";
  if (
    state.objectiveAttempts.some(
      (attempt) =>
        attempt.lessonId === lesson.id &&
        lesson.checks.some(
          (check) =>
            check.id === attempt.checkId &&
            (check.kind === "numeric" || check.kind === "choice"),
        ),
    )
  )
    return "practiced";
  if (
    state.lessonStates[lesson.id].status !== "not_started" ||
    state.notes[`prediction:${lesson.id}`]?.trim() ||
    state.notes[`note:${lesson.id}`]?.trim() ||
    lesson.checks.some(
      (check) =>
        state.notes[`response:${check.id}`]?.trim() ||
        state.selfChecks[check.id],
    )
  )
    return "in_progress";
  return "not_started";
}
