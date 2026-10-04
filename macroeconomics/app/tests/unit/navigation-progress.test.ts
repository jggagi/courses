import { describe, expect, it } from "vitest";
import { lessons } from "../../src/content";
import { lessonCatalog, loadLesson } from "../../src/content/catalog";
import { initialState } from "../../src/persistence";
import { deriveLessonStatus } from "../../src/persistence/progress";
import { readRoute } from "../../src/routing";
import { formulaTokens } from "../../src/components/Formula";

describe("navigation and progress evidence", () => {
  it("nested exponents and lagged subscripts retain the complete expression", () => {
    expect(formulaTokens("k*=[sA/(n+δ)]^(1/(1−α))")).toEqual([
      { kind: "text", text: "k*=[sA/(n+δ)]" },
      { kind: "sup", text: "1/(1−α)" },
    ]);
    expect(formulaTokens("x_(t−1)+k^α")).toEqual([
      { kind: "text", text: "x" },
      { kind: "sub", text: "t−1" },
      { kind: "text", text: "+k" },
      { kind: "sup", text: "α" },
    ]);
    expect(formulaTokens("k^(未闭合")).toEqual([
      { kind: "text", text: "k^(未闭合" },
    ]);
  });
  it("all 24 lesson numeric answers agree with independent design oracles", () => {
    const values = [
      110, 10, 100, 20, 44, 140.25, 1.1, 16, 2.4, 2, 170, 182.5, 70, 2.25, 2,
      2.941176470588235, 25, 62.1764705882353, -2, 7.7, 19, 25, -1, 100,
    ];
    lessons.forEach((lesson, index) =>
      expect(
        lesson.checks.find((check) => check.kind === "numeric")!.value,
      ).toBeCloseTo(values[index], 8),
    );
  });
  it("malformed percent encodings cannot throw at startup or during navigation", () => {
    for (const hash of ["#/lesson/%", "#/%E0%A4%A", "#/%FF"])
      expect(readRoute(hash)).toBe("invalid-route");
    expect(readRoute("#/lesson/A01-A/check/A01-A-num")).toBe(
      "lesson/A01-A/check/A01-A-num",
    );
    expect(readRoute("")).toBe("home");
  });
  it("repeated prediction and objective checks preserve self-evaluation evidence", () => {
    const lesson = lessons[0];
    const state = initialState();
    expect(deriveLessonStatus(lesson, state)).toBe("not_started");
    state.objectiveAttempts.push({
      lessonId: lesson.id,
      checkId: lesson.checks.find((c) => c.kind === "numeric")!.id,
      answer: "0",
      correct: false,
      at: state.updatedAt,
    });
    expect(deriveLessonStatus(lesson, state)).toBe("practiced");
    const subjective = lesson.checks.filter(
      (c) => c.kind === "transfer" || c.kind === "explanation",
    );
    for (const check of subjective) state.selfChecks[check.id] = true;
    expect(deriveLessonStatus(lesson, state)).toBe("self_checked");
    state.lessonStates[lesson.id].status = "in_progress";
    expect(deriveLessonStatus(lesson, state)).toBe("self_checked");
    state.selfChecks[subjective[0].id] = false;
    expect(deriveLessonStatus(lesson, state)).toBe("practiced");
  });
  it("the lightweight catalog and each asynchronously loaded module match the authored lessons", async () => {
    expect(lessonCatalog.map((l) => l.id)).toEqual(lessons.map((l) => l.id));
    for (const summary of lessonCatalog) {
      const lesson = await loadLesson(summary.id);
      expect(lesson).toEqual(lessons.find((l) => l.id === summary.id));
      expect(summary.title).toBe(lesson!.title);
      expect(summary.labId).toBe(lesson!.labId);
      expect(summary.checkIds).toEqual(lesson!.checks.map((c) => c.id));
      expect(summary.subjectiveCheckIds).toEqual(
        lesson!.checks
          .filter((c) => c.kind === "transfer" || c.kind === "explanation")
          .map((c) => c.id),
      );
    }
    expect(await loadLesson("A99-A")).toBeUndefined();
  });
});
