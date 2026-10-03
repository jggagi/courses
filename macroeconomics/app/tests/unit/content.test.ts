import { describe, expect, it } from "vitest";
import {
  courseId,
  lessons,
  plannedLessons,
  sources,
  terms,
} from "../../src/content";

const expectedLearnable = Array.from(
  { length: 12 },
  (_, i) => `A${String(i + 1).padStart(2, "0")}`,
).flatMap((module) => [`${module}-A`, `${module}-B`]);
const expectedPlanned: string[] = [];
const termIds = new Set(terms.map((term) => term.id));
const sourceIds = new Set(sources.map((source) => source.id));
const lessonIds = new Set<string>(lessons.map((lesson) => lesson.id));
const labs = new Set(
  Array.from({ length: 9 }, (_, i) => `LA${String(i + 1).padStart(2, "0")}`),
);

function expectReferences(ids: string[]): void {
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(sourceIds.has(id), `悬空来源 ${id}`).toBe(true);
}

describe("完整课程范围", () => {
  it("开放A01–A12二十四节，九个实验均有课程入口", () => {
    expect(courseId).toBe("macroeconomics");
    expect(lessons.map((lesson) => lesson.id)).toEqual(expectedLearnable);
    expect(plannedLessons.map((lesson) => lesson.id)).toEqual(expectedPlanned);
    expect(
      new Set([...lessonIds, ...plannedLessons.map((lesson) => lesson.id)])
        .size,
    ).toBe(24);
    for (const lesson of lessons) {
      expect(lesson.status).toBe("learnable");
      expect(lesson.moduleId).toBe(lesson.id.slice(0, 3));
    }
    for (const lesson of plannedLessons) {
      expect(lesson.status).toBe("planned");
      expect(lesson.moduleId).toBe(lesson.id.slice(0, 3));
      expect(lesson.title.trim()).not.toBe("");
      expect(lesson).not.toHaveProperty("sections");
      expect(lesson).not.toHaveProperty("labId");
    }
  });
});

describe("二十四节可独立阅读的教学内容合同", () => {
  for (const lesson of lessons) {
    it(`${lesson.id}有七步讲解、完整模型说明与可追溯词条/来源/实验`, () => {
      expect(lesson.title.trim()).not.toBe("");
      expect(lesson.centralQuestion.trim()).not.toBe("");
      expect(lesson.prerequisites.length).toBeGreaterThan(0);
      const core = lesson.sections.filter((section) => !section.advanced);
      expect(core.map((section) => section.title[0])).toEqual([
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
      ]);
      for (const section of lesson.sections) {
        expect(section.tag?.trim()).not.toBe("");
        expect(section.paragraphs.length).toBeGreaterThan(0);
        for (const paragraph of section.paragraphs)
          expect(paragraph.trim()).not.toBe("");
      }
      expect(lesson.sections.some((section) => section.advanced)).toBe(true);
      expect(lesson.sections.some((section) => section.formula)).toBe(true);
      expect(lesson.modelTypeTags.length).toBeGreaterThanOrEqual(3);
      expect(
        lesson.modelTypeTags.some((tag) =>
          /定义|核算|行为|动态|均衡|测量|反事实/.test(tag),
        ),
      ).toBe(true);
      expect(lesson.assumptions.length).toBeGreaterThan(0);
      expect(lesson.assumptions.some((text) => text.includes("教学合成"))).toBe(
        true,
      );
      expect(lesson.workedExample.trim()).not.toBe("");
      expect(lesson.counterexample.trim()).not.toBe("");
      for (const value of Object.values(lesson.recap))
        expect(value.trim()).not.toBe("");
      expect(lesson.definitions.length).toBeGreaterThan(0);
      for (const id of lesson.definitions)
        expect(termIds.has(id), `${lesson.id}悬空词条 ${id}`).toBe(true);
      expect(labs.has(lesson.labId), `${lesson.id}悬空实验`).toBe(true);
      if (lesson.moduleId <= "A03")
        expect(lesson.labId).toBe(`LA${lesson.moduleId.slice(1)}`);
      expectReferences(lesson.references);
    });

    it(`${lesson.id}覆盖解释、数值、迁移与逐干扰项反馈`, () => {
      expect(lesson.checks.map((check) => check.kind)).toEqual(
        expect.arrayContaining([
          "explanation",
          "numeric",
          "transfer",
          "choice",
        ]),
      );
      expect(new Set(lesson.checks.map((check) => check.id)).size).toBe(
        lesson.checks.length,
      );
      for (const check of lesson.checks) {
        expect(check.id.startsWith(`${lesson.id}-`)).toBe(true);
        expect(check.prompt.trim()).not.toBe("");
        expect(check.answer.trim()).not.toBe("");
        if (check.kind === "numeric") {
          expect(Number.isFinite(check.value)).toBe(true);
          expect(Number.isFinite(check.tolerance)).toBe(true);
          expect(check.tolerance).toBeGreaterThan(0);
          expect(check.unit?.trim()).not.toBe("");
          expect(check.misconception?.trim()).not.toBe("");
        } else if (check.kind === "choice") {
          expect(check.options?.length).toBeGreaterThanOrEqual(3);
          expect(
            check.options?.filter((option) => option.correct),
          ).toHaveLength(1);
          for (const option of check.options ?? []) {
            expect(option.label.trim()).not.toBe("");
            expect(option.feedback.trim()).not.toBe("");
          }
          expect(
            new Set(check.options?.map((option) => option.feedback)).size,
          ).toBe(check.options?.length);
        } else {
          expect(check.rubric.length).toBeGreaterThanOrEqual(3);
          for (const item of check.rubric) expect(item.trim()).not.toBe("");
          expect(check.misconception?.trim()).not.toBe("");
        }
      }
    });
  }

  it("客观数值题复用内核且与教学oracle一致", () => {
    const expectedValues = [110, 10, 100, 20, 44, 140.25];
    lessons.slice(0, 6).forEach((lesson, index) => {
      expect(
        lesson.checks.find((check) => check.kind === "numeric")?.value,
      ).toBeCloseTo(expectedValues[index], 8);
    });
  });
});

describe("局部概念导航与来源", () => {
  it("覆盖全部首期指定概念且没有悬空概念锚点", () => {
    const required = [
      "agent",
      "stock",
      "flow",
      "income",
      "wealth",
      "asset",
      "liability",
      "net-worth",
      "saving",
      "investment",
      "consumption",
      "transfer",
      "reserves",
      "deposit",
      "gdp",
      "value-added",
      "intermediate-use",
      "final-use",
      "inventory",
      "nominal",
      "real",
      "price-index",
      "inflation",
      "disinflation",
      "deflation",
      "year-over-year",
      "period-over-period",
      "percent",
      "percentage-point",
      "identity",
      "behavioral-mechanism",
    ];
    expect(termIds.size).toBe(terms.length);
    for (const id of required)
      expect(termIds.has(id), `缺少首期概念 ${id}`).toBe(true);
    for (const term of terms) {
      expect(term.name.trim()).not.toBe("");
      expect(term.definition.trim()).not.toBe("");
      expect(lessonIds.has(term.lessonId), `悬空概念锚点 ${term.id}`).toBe(
        true,
      );
      expectReferences(term.references);
      expect(
        lessons.find((lesson) => lesson.id === term.lessonId)?.definitions,
      ).toContain(term.id);
    }
  });

  it("保留设计文件的七个官方来源ID与https入口", () => {
    expect([...sourceIds]).toEqual([
      "MAC-MIT",
      "MAC-CORE",
      "MAC-BEA",
      "MAC-BEA-GLOSS",
      "MAC-BLS-CPI",
      "MAC-BLS-LABOR",
      "MAC-BOE",
    ]);
    expect(sourceIds.size).toBe(sources.length);
    for (const source of sources) {
      expect(source.title.trim()).not.toBe("");
      expect(source.note.trim()).not.toBe("");
      expect(new URL(source.url).protocol).toBe("https:");
    }
  });
});
