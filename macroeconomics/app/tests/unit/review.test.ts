import { describe, expect, it } from "vitest";
import { lessons } from "../../src/content";
import {
  computeReviewExamples,
  transferReviews,
} from "../../src/content/review";
import {
  exportState,
  importState,
  initialState,
  type Attempt,
} from "../../src/persistence";
import {
  assessObjective,
  buildReviewQueue,
  lessonCheckHref,
  modelCardFields,
  modelCardFilledFields,
  recordReviewAttempt,
  writeReviewNote,
} from "../../src/persistence/review";
import type { Check, Lesson } from "../../src/content/types";

const firstLesson = lessons[0];
const numeric = firstLesson.checks.find((check) => check.kind === "numeric")!;
const choice = firstLesson.checks.find((check) => check.kind === "choice")!;
const at = "2026-10-04T08:00:00.000Z";
const attempt = (
  check: Check,
  answer: string,
  correct = false,
  lesson: Lesson = firstLesson,
): Attempt => ({ lessonId: lesson.id, checkId: check.id, answer, correct, at });

describe("当前题目的重新核对", () => {
  for (const lesson of lessons) {
    it(`${lesson.id}数值与所有选择选项按当前题目重新核对`, () => {
      const numeric = lesson.checks.find((check) => check.kind === "numeric")!;
      expect(assessObjective(numeric, String(numeric.value)).status).toBe(
        "correct",
      );
      expect(
        assessObjective(
          numeric,
          String(numeric.value! + numeric.tolerance! * 0.99),
        ).status,
      ).toBe("correct");
      expect(
        assessObjective(
          numeric,
          String(numeric.value! + numeric.tolerance! * 1.1),
        ).status,
      ).toBe("incorrect");
      const choice = lesson.checks.find((check) => check.kind === "choice")!;
      choice.options!.forEach((option, index) => {
        expect(assessObjective(choice, String(index))).toEqual({
          status: option.correct ? "correct" : "incorrect",
          feedback: option.feedback,
        });
      });
    });
  }

  it("有限科学计数法可用，空值、非十进制、非有限数值不作为正确答案", () => {
    expect(assessObjective(numeric, " 1.1e2 ").status).toBe("correct");
    for (const answer of [
      "",
      " ",
      "Infinity",
      "NaN",
      "0x6e",
      "0b1101110",
      "1e500",
      "110 units",
      "<script>110</script>",
    ])
      expect(assessObjective(numeric, answer).status, answer).toBe(
        "unavailable",
      );
  });

  it("选择题只接受当前存在的整型选项，不把空值、分数或旧选项映射到首项", () => {
    for (const answer of [
      "",
      " ",
      "-1",
      "1.0",
      "01",
      "1e0",
      "0.5",
      "99999999999999999999",
    ])
      expect(assessObjective(choice, answer).status, answer).toBe(
        "unavailable",
      );
  });

  it("自由回答永远不会被复习功能自动判分", () => {
    const check = firstLesson.checks.find(
      (check) => check.kind === "explanation",
    )!;
    expect(assessObjective(check, check.answer).status).toBe("unavailable");
  });
});

describe("错题清单与陈旧记录", () => {
  it("不信任导入correct，原始答案决定当前待复习", () => {
    const records = [
      attempt(numeric, "109", true),
      attempt(
        choice,
        String(choice.options!.findIndex((option) => !option.correct)),
        true,
      ),
    ];
    const result = buildReviewQueue(records, lessons);
    expect(result.pending.map((item) => item.check.id)).toEqual([
      choice.id,
      numeric.id,
    ]);
    expect(result.reconciledCount).toBe(2);
    expect(records.every((record) => record.correct)).toBe(true);
  });

  it("正确重做移出清单且保留原错误与尝试历史", () => {
    const original = [attempt(numeric, "109"), attempt(numeric, "110", false)];
    const result = buildReviewQueue(original, lessons);
    expect(result.pending).toHaveLength(0);
    expect(result.resolved).toHaveLength(1);
    expect(
      result.resolved[0].history.map((entry) => entry.assessment.status),
    ).toEqual(["incorrect", "correct"]);
    expect(original).toHaveLength(2);
    expect(result.reconciledCount).toBe(1);
  });

  it("更晚的错误重新进入清单，日期不能重排追加记录", () => {
    const result = buildReviewQueue(
      [
        { ...attempt(numeric, "110", true), at: "2030-01-01T00:00:00.000Z" },
        { ...attempt(numeric, "112"), at: "2000-01-01T00:00:00.000Z" },
      ],
      lessons,
    );
    expect(result.pending[0].attempt.answer).toBe("112");
    expect(result.resolved).toHaveLength(0);
  });

  it("格式不合法的最新答案需要重新核实，不能承袭此前正确", () => {
    const result = buildReviewQueue(
      [attempt(numeric, "110", true), attempt(numeric, "", true)],
      lessons,
    );
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].assessment.status).toBe("unavailable");
    expect(result.pending[0].history).toHaveLength(2);
  });

  it("未知题号、课题不一致与主观题历史保留为无法归入，不污染当前题", () => {
    const explanation = firstLesson.checks.find(
      (check) => check.kind === "explanation",
    )!;
    const records = [
      attempt(numeric, "110", true),
      { ...attempt(numeric, "110"), checkId: "A01-A-retired" },
      attempt(numeric, "109", true, lessons[1]),
      attempt(explanation, "回答", true),
    ];
    const result = buildReviewQueue(records, lessons);
    expect(result.pending).toHaveLength(0);
    expect(result.unmatched).toHaveLength(3);
    expect(result.unmatched.map((entry) => entry.reason)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("较早"),
        expect.stringContaining("不一致"),
        expect.stringContaining("自由回答"),
      ]),
    );
    expect(records).toHaveLength(4);
  });

  it("空清单与一次正确的题目不会生成虚假的纠错或掌握结果", () => {
    expect(buildReviewQueue([], lessons)).toEqual({
      pending: [],
      resolved: [],
      unmatched: [],
      reconciledCount: 0,
    });
    const result = buildReviewQueue([attempt(numeric, "110", true)], lessons);
    expect(result.pending).toHaveLength(0);
    expect(result.resolved).toHaveLength(0);
  });
});

describe("复习记录沿用本地合同", () => {
  it("重做写原题答案与真实判定、保留历史和其他记录、不可变更新", () => {
    const state = initialState();
    state.objectiveAttempts = [attempt(numeric, "109")];
    state.notes["note:A01-B"] = "保留";
    state.selfChecks[`review:mistake:${numeric.id}`] = true;
    const result = recordReviewAttempt(state, firstLesson, numeric, "110", at);
    expect(result.assessment.status).toBe("correct");
    expect(result.state.objectiveAttempts).toHaveLength(2);
    expect(result.state.objectiveAttempts.at(-1)).toEqual(
      attempt(numeric, "110", true),
    );
    expect(result.state.notes[`response:${numeric.id}`]).toBe("110");
    expect(result.state.notes[`review:retry:${numeric.id}`]).toBe("110");
    expect(result.state.selfChecks[`review:mistake:${numeric.id}`]).toBe(false);
    expect(result.state.notes["note:A01-B"]).toBe("保留");
    expect(result.state.labStates).toBe(state.labStates);
    expect(state.objectiveAttempts).toHaveLength(1);
    expect(state.notes[`response:${numeric.id}`]).toBeUndefined();
    expect(result.state.lessonStates[firstLesson.id].status).toBe("practiced");
  });

  it("已完成本课两项主观自评的状态不会被客观重做降级", () => {
    const state = initialState();
    for (const check of firstLesson.checks.filter((check) =>
      ["explanation", "transfer"].includes(check.kind),
    ))
      state.selfChecks[check.id] = true;
    expect(
      recordReviewAttempt(state, firstLesson, numeric, "109", at).state
        .lessonStates[firstLesson.id].status,
    ).toBe("self_checked");
  });

  it("格式无效或课题归属错误不写尝试", () => {
    const state = initialState();
    expect(() =>
      recordReviewAttempt(state, firstLesson, numeric, "", at),
    ).toThrow("有限数值");
    expect(() =>
      recordReviewAttempt(state, lessons[1], numeric, "110", at),
    ).toThrow("不一致");
    expect(state.objectiveAttempts).toHaveLength(0);
  });

  it("历史上限与原课程一致，保留最新1000条而非删除全部错题", () => {
    const state = initialState();
    state.objectiveAttempts = Array.from({ length: 1000 }, (_, index) =>
      attempt(numeric, String(index)),
    );
    const result = recordReviewAttempt(
      state,
      firstLesson,
      numeric,
      "110",
      at,
    ).state;
    expect(result.objectiveAttempts).toHaveLength(1000);
    expect(result.objectiveAttempts[0].answer).toBe("1");
    expect(result.objectiveAttempts.at(-1)!.answer).toBe("110");
    expect(state.objectiveAttempts[0].answer).toBe("0");
  });

  it("改写解释取消对应自评，不清除其他课与其他复习自评", () => {
    const state = initialState();
    state.selfChecks["review:transfer:stocks-and-production"] = true;
    state.selfChecks["A01-A-explain"] = true;
    const next = writeReviewNote(
      state,
      "review:transfer:stocks-and-production",
      "新的解释",
    );
    expect(next.selfChecks["review:transfer:stocks-and-production"]).toBe(
      false,
    );
    expect(next.selfChecks["A01-A-explain"]).toBe(true);
    expect(state.selfChecks["review:transfer:stocks-and-production"]).toBe(
      true,
    );
    state.selfChecks["review:card:A01"] = true;
    const card = writeReviewNote(
      state,
      "card:A01:研究对象",
      "家庭",
      "review:card:A01",
    );
    expect(card.selfChecks["review:card:A01"]).toBe(false);
  });

  it("错题、迁移、模型卡笔记与明确自评经现有JSON导入导出往返", () => {
    const state = initialState();
    state.notes[`review:mistake:${numeric.id}`] = "先统一时点和期间";
    state.notes["review:transfer:stocks-and-production"] =
      "<img src=x onerror=alert(1)>纯文本";
    state.notes["review:next-question"] = "检验替代机制";
    state.notes["card:A01:研究对象"] = "家庭、企业、银行";
    state.selfChecks["review:transfer:stocks-and-production"] = true;
    state.selfChecks["review:card:A01"] = true;
    state.objectiveAttempts = [attempt(numeric, "109", true)];
    const restored = importState(exportState(state));
    expect(restored).toEqual(state);
    expect(restored.schemaVersion).toBe(1);
    expect(
      buildReviewQueue(restored.objectiveAttempts, lessons).pending,
    ).toHaveLength(1);
    expect(restored.objectiveAttempts[0].correct).toBe(true);
  });

  it("十二模块使用原有七字段模型卡键，空白不计已填、链接指向具体题", () => {
    expect(modelCardFields).toHaveLength(7);
    const state = initialState();
    state.notes["card:A01:研究对象"] = "家庭";
    state.notes["card:A01:已知条件"] = "  ";
    state.notes["card:A02:已知条件"] = "生产边界";
    expect(modelCardFilledFields(state.notes, "A01")).toEqual(["研究对象"]);
    expect(modelCardFilledFields(state.notes, "A02")).toEqual(["已知条件"]);
    expect(lessonCheckHref(firstLesson, numeric)).toBe(
      `#/lesson/A01-A/check/${numeric.id}`,
    );
  });
});

describe("跨模块迁移的教学与数值", () => {
  it("六个原创新情景覆盖全部十二模块，参考和rubric不悬空", () => {
    expect(transferReviews).toHaveLength(6);
    expect(new Set(transferReviews.map((exercise) => exercise.id)).size).toBe(
      6,
    );
    expect([
      ...new Set(transferReviews.flatMap((exercise) => exercise.modules)),
    ]).toEqual(
      Array.from(
        { length: 12 },
        (_, index) => `A${String(index + 1).padStart(2, "0")}`,
      ),
    );
    for (const exercise of transferReviews) {
      expect(exercise.modules.length).toBeGreaterThanOrEqual(2);
      expect(exercise.prompt.some((text) => text.includes("教学合成"))).toBe(
        true,
      );
      expect(exercise.reference).toHaveLength(3);
      expect(exercise.rubric).toHaveLength(3);
      for (const id of exercise.lessons)
        expect(lessons.some((lesson) => lesson.id === id)).toBe(true);
      for (const module of exercise.modules)
        expect(exercise.lessons.some((id) => id.startsWith(module))).toBe(true);
    }
  });

  it("不同数字的参考结果复用计算内核，账本、价格、增长、需求和政策一致", () => {
    const example = computeReviewExamples();
    expect(example.ledger.H.deposit).toBe(111);
    expect(example.ledger.F.deposit).toBe(29);
    expect(example.ledger.B.depositH + example.ledger.B.depositF).toBe(140);
    expect(example.prices.periods[1].gN).toBeCloseTo(0.25);
    expect(example.prices.periods[1].gR).toBe(0);
    expect(example.saving.periods[0].c).toBeCloseTo(0.7);
    expect(example.saving.steadyState!.y).toBeCloseTo(3);
    expect(example.technology.periods[1].A).toBeCloseTo(1.3);
    expect(example.demand.equilibrium.Y).toBe(150);
    expect(example.demand.equilibrium.nationalSaving).toBe(30);
    expect(example.policy.periods[1].x).toBe(0);
    expect(example.policy.periods[1].pi).toBeCloseTo(2.8);
    expect(example.policy.periods[1].i).toBeCloseTo(4.2);
    expect(example.policy.periods[2].x).toBeCloseTo(-0.4);
  });

  it("新债务、外部与危机场景保持金额/比率、CA/估值与流动性/权益区别", () => {
    const example = computeReviewExamples();
    expect(example.debt.periods[1].GDP).toBe(105);
    expect(example.debt.periods[1].debt).toBeCloseTo(52.025);
    expect(example.debt.periods[1].debtRatio).toBeCloseTo(52.025 / 105);
    expect(example.external.production).toBe(105);
    expect(example.external.CA).toBe(-3);
    expect(example.external.CAFromSaving).toBe(-3);
    expect(example.external.NFAChange).toBe(2);
    expect(example.external.closingNFA).toBe(12);
    expect(example.credit.A.loanAsset).toBe(68);
    expect(example.credit.A.equity).toBe(-2);
    expect(example.credit.A.reserves).toBe(20);
    expect(
      example.credit.A.depositLiability + example.credit.B.depositLiability,
    ).toBe(180);
    expect(example.credit.customers.historicalBorrowerA.loan).toBe(80);
  });
});
