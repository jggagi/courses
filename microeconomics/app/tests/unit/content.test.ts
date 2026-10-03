import { describe, expect, it } from "vitest";
import {
  catalog,
  getLesson,
  getNumericAnswer,
  glossary,
  labIds,
  lessons,
  modules,
  references,
} from "../../src/content";

describe("Phase 1 content contract", () => {
  it("provides exactly six learnable lessons and eighteen honest planned entries", () => {
    const expected = ["M01-A", "M01-B", "M02-A", "M02-B", "M03-A", "M03-B"];
    expect(lessons.map((lesson) => lesson.id)).toEqual(expected);
    expect(catalog).toHaveLength(24);
    expect(new Set(catalog.map((lesson) => lesson.id)).size).toBe(24);
    expect(
      catalog
        .filter((lesson) => lesson.status === "available")
        .map((lesson) => lesson.id),
    ).toEqual(expected);
    const planned = catalog.filter((lesson) => lesson.status === "planned");
    expect(planned).toHaveLength(18);
    for (const item of planned) {
      expect(item.summary).toContain("规划中");
      expect(getLesson(item.id)).toBeUndefined();
      expect(item).not.toHaveProperty("sections");
      expect(item).not.toHaveProperty("checks");
    }
    for (let module = 1; module <= 12; module += 1) {
      for (const suffix of ["A", "B"]) {
        expect(
          catalog.some(
            (lesson) =>
              lesson.id === `M${String(module).padStart(2, "0")}-${suffix}`,
          ),
        ).toBe(true);
      }
    }
  });

  it.each(lessons.map((lesson) => [lesson.id, lesson] as const))(
    "%s has a readable argument, examples, boundaries and three depth labels",
    (id, lesson) => {
      expect(lesson.status).toBe("available");
      expect(lesson.moduleId).toBe(id.slice(0, 3));
      expect(lesson.centralQuestion.length).toBeGreaterThan(15);
      expect(lesson.prerequisites.length).toBeGreaterThan(0);
      expect(lesson.sections.length).toBeGreaterThanOrEqual(7);
      for (const phase of [
        "opening",
        "objects",
        "intuition",
        "derivation",
        "experiment",
        "boundary",
        "reconstruct",
      ]) {
        expect(
          lesson.sections.find((section) => section.id === phase),
          `${id} lacks ${phase}`,
        ).toBeDefined();
      }
      expect(lesson.sections.some((section) => section.formula)).toBe(true);
      expect(
        lesson.sections.reduce(
          (sum, section) => sum + section.paragraphs.join("").length,
          0,
        ),
      ).toBeGreaterThan(650);
      expect(new Set(lesson.sections.map((section) => section.id)).size).toBe(
        lesson.sections.length,
      );
      for (const section of lesson.sections) {
        expect(section.title.length).toBeGreaterThan(3);
        expect(section.paragraphs.length).toBeGreaterThan(0);
        expect(
          section.paragraphs.every((paragraph) => paragraph.length > 25),
        ).toBe(true);
        expect(section.paragraphs.join("")).not.toMatch(
          /TODO|占位正文|待补充|敬请期待/,
        );
      }
      expect(lesson.definitions.length).toBeGreaterThanOrEqual(3);
      expect(lesson.assumptions.length).toBeGreaterThanOrEqual(3);
      expect(lesson.workedExample.length).toBeGreaterThanOrEqual(3);
      expect(lesson.counterexample.length).toBeGreaterThanOrEqual(2);
      expect(lesson.recap.length).toBeGreaterThanOrEqual(3);
      for (const list of Object.values(lesson.knowledge))
        expect(list.length).toBeGreaterThan(0);
      expect(lesson.references.length).toBeGreaterThan(0);
      const listing = catalog.find((item) => item.id === id)!;
      expect(listing.title).toBe(lesson.title);
      expect(listing.status).toBe("available");
    },
  );

  it("has no dangling glossary, lab, module or reference IDs", () => {
    const terms = new Set(glossary.map((entry) => entry.id));
    const sources = new Set(references.map((entry) => entry.id));
    const moduleIds = new Set(modules.map((entry) => entry.id));
    const lessonIds = new Set(lessons.map((entry) => entry.id));
    const labs = new Set<string>(labIds);
    for (const lesson of lessons) {
      expect(moduleIds.has(lesson.moduleId)).toBe(true);
      expect(labs.has(lesson.labId)).toBe(true);
      for (const id of lesson.definitions)
        expect(terms.has(id), `dangling definition ${id}`).toBe(true);
      for (const reference of lesson.references) {
        expect(sources.has(reference.id)).toBe(true);
        expect(reference.topic.length).toBeGreaterThan(3);
      }
    }
    for (const lesson of catalog)
      expect(moduleIds.has(lesson.moduleId)).toBe(true);
    for (const entry of glossary) {
      for (const id of entry.lessonIds) expect(lessonIds.has(id)).toBe(true);
      for (const id of entry.relatedIds) expect(terms.has(id)).toBe(true);
    }
  });

  it("explains the minimum concepts with objects, examples, misconceptions and locations", () => {
    const required = [
      "稀缺",
      "机会成本",
      "沉没成本",
      "可行集",
      "预算线",
      "相对价格",
      "偏好",
      "序数效用",
      "无差异曲线",
      "边际替代率",
      "内点 / 角点 / 拐角",
      "需求",
      "比较静态",
      "收入效应与替代效应",
    ];
    expect(glossary.length).toBeGreaterThanOrEqual(15);
    expect(new Set(glossary.map((entry) => entry.id)).size).toBe(
      glossary.length,
    );
    for (const term of required)
      expect(
        glossary.some((entry) => entry.term === term),
        `missing term ${term}`,
      ).toBe(true);
    for (const entry of glossary) {
      for (const field of [
        "object",
        "definition",
        "example",
        "confusion",
      ] as const)
        expect(entry[field].length).toBeGreaterThan(8);
      expect(entry.lessonIds.length).toBeGreaterThan(0);
      expect(entry.english.length).toBeGreaterThan(2);
    }
  });

  it.each(lessons.map((lesson) => [lesson.id, lesson] as const))(
    "%s distinguishes objective feedback from explanation self-assessment",
    (id, lesson) => {
      expect(lesson.checks.length).toBeGreaterThanOrEqual(3);
      const explanations = lesson.checks.filter(
        (question) => question.kind === "self-explanation",
      );
      expect(explanations.length).toBeGreaterThanOrEqual(2);
      expect(
        lesson.checks.some((question) => question.kind === "numeric"),
      ).toBe(true);
      expect(lesson.checks.some((question) => question.kind === "choice")).toBe(
        true,
      );
      expect(new Set(lesson.checks.map((question) => question.id)).size).toBe(
        lesson.checks.length,
      );
      for (const question of lesson.checks) {
        expect(question.id.startsWith(`${id}-`)).toBe(true);
        expect(question.prompt.length).toBeGreaterThan(10);
        expect(question.answerBasis.length).toBeGreaterThan(10);
        expect(question.feedback.length).toBeGreaterThan(10);
        if (question.kind === "self-explanation") {
          expect(question.referenceAnswer.length).toBeGreaterThan(40);
          expect(question.rubric.length).toBeGreaterThanOrEqual(3);
          expect(question).not.toHaveProperty("keywords");
          expect(question).not.toHaveProperty("answer");
        } else if (question.kind === "choice") {
          expect(question.options.length).toBeGreaterThanOrEqual(3);
          expect(
            question.options.filter((option) => option.id === question.answer),
          ).toHaveLength(1);
          expect(
            new Set(question.options.map((option) => option.feedback)).size,
          ).toBe(question.options.length);
          for (const option of question.options) {
            expect(option.text.length).toBeGreaterThan(5);
            expect(option.feedback.length).toBeGreaterThan(15);
            expect(option.feedback).not.toMatch(/^(正确|错误|答错了)[。！]?$/);
          }
        } else {
          expect(question.unit.length).toBeGreaterThan(0);
          expect(question.tolerance).toBeGreaterThan(0);
          expect(Number.isFinite(getNumericAnswer(question))).toBe(true);
        }
      }
    },
  );

  it("computes the six numerical exercise answers using the lab kernel", () => {
    const expected = [1, 50, 144, 0.25, 20, 10];
    const numerical = lessons.flatMap((lesson) =>
      lesson.checks.filter((question) => question.kind === "numeric"),
    );
    expect(numerical).toHaveLength(expected.length);
    numerical.forEach((question, index) => {
      expect(
        Math.abs(getNumericAnswer(question) - expected[index]),
      ).toBeLessThanOrEqual(question.tolerance);
    });
  });

  it("provides distinct model cards for all three implemented modules", () => {
    for (const module of modules.slice(0, 3)) {
      expect(module.modelCard.object.length).toBeGreaterThan(10);
      for (const field of [
        "known",
        "unknown",
        "relations",
        "derivation",
        "counterexample",
      ] as const) {
        expect(module.modelCard[field].length).toBeGreaterThan(0);
      }
      expect(module.modelCard.uncertainty).toContain("仍不确定");
    }
    expect(
      new Set(
        modules
          .slice(0, 3)
          .map((module) => module.modelCard.relations.join("")),
      ).size,
    ).toBe(3);
  });

  it("keeps original content and explicit reference reading routes", () => {
    expect(new Set(references.map((reference) => reference.id)).size).toBe(
      references.length,
    );
    for (const reference of references) {
      expect(new URL(reference.url).protocol).toBe("https:");
      expect(reference.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(reference.supports.length).toBeGreaterThan(30);
      expect(reference.readingRoute.length).toBeGreaterThan(50);
      expect(reference.licenseNote.length).toBeGreaterThan(30);
    }
  });
});
