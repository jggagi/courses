import { describe, expect, it } from "vitest";
import catalogData from "../../src/content/catalog-data.json";
import glossaryData from "../../src/content/glossary-data.json";
import { catalog, modules, terms } from "../../src/content/catalog";
import { loadAllLessons, loadGlossary, loadLesson } from "../../src/content/loaders";
import { normalizeQuery, searchCourse } from "../../src/content/search";
import { lessons as firstLessons } from "../../src/content/lessons";
import { glossary as firstGlossary } from "../../src/content/glossary";
import { lessonsM04M06, glossaryM04M06, modulesM04M06 } from "../../src/content/modules04to06";
import { lessonsM07M09, glossaryM07M09, modulesM07M09 } from "../../src/content/modules07to09";
import { lessonsM10M12, glossaryM10M12, modulesM10M12 } from "../../src/content/modules10to12";
import type { CourseModule, Lesson } from "../../src/content/types";

const authoredLessons = [...firstLessons, ...lessonsM04M06, ...lessonsM07M09, ...lessonsM10M12];
const authoredGlossary = [...firstGlossary, ...glossaryM04M06, ...glossaryM07M09, ...glossaryM10M12];
const lessonIds = Array.from({ length: 12 }, (_, n) => `M${String(n + 1).padStart(2, "0")}`).flatMap(id => [`${id}-A`, `${id}-B`]);
// Independent original M01–M03 model-card contract: their authored TypeScript
// source moved to JSON. Later modules still have independent authored sources.
const firstModules: CourseModule[] = [
  {
    id: "M01",
    title: "稀缺与可行世界",
    centralQuestion: "为什么“想要什么”必须先与“能选什么”分开？",
    prerequisites: [],
    modelCard: {
      object: "一个决策者、非负数量组合与满足资源约束的可行集。",
      known: [
        "当前预算m或总时间；价格px、py或每项活动的资源耗用。",
        "变量单位与决策时点；是否可分割、可退款。",
      ],
      unknown: [
        "哪些组合可行、位于边界或超出约束？",
        "沿边界增加一种用途，要放弃多少另一用途？",
      ],
      relations: ["px·x+py·y≤m，x,y≥0。", "截距m/px、m/py；预算线斜率−px/py。"],
      derivation: [
        "先统一单位，再把各项资源使用相加。",
        "令另一数量为零求截距；整理等式求资源交换率。",
        "对单个参数变动比较A/B；同比例计价变换通过两边同除验证。",
      ],
      counterexample: [
        "整数商品、最低采购量与额外时间限制会改变三角形可行集。",
        "可退票不是纯沉没成本；过去付款可能改变当前财富，但不能重复扣款。",
      ],
      uncertainty:
        "我仍不确定：有没有遗漏有价值的休息或其他约束？最佳被放弃方案是什么？把自己的问题留在模块笔记。",
    },
  },
  {
    id: "M02",
    title: "偏好不是效用数字",
    centralQuestion: "公式是在表达排序，还是在创造偏好？",
    prerequisites: ["M01"],
    modelCard: {
      object: "同一决策者对确定性组合的比较关系，及其序数表示。",
      known: [
        "非负组合(x,y)；给定CD、线性或1:1互补偏好。",
        "当前使用u还是在非负域的u²表示。",
      ],
      unknown: [
        "两个组合的排序、无差别集合。",
        "光滑内点处愿意以y交换x的局部比率。",
      ],
      relations: [
        "严格递增g保留u的大小与相等关系。",
        "光滑内点且MUy≠0：MRS=MUx/MUy；曲线斜率=−MRS。",
        "CD：MRS=[α/(1−α)]y/x。",
      ],
      derivation: [
        "先比较组合，再给排序数值标签。",
        "用同一组组合检验u与u²的排序不变。",
        "沿等值集合令du=0，推出局部斜率，并检查可微性与域。",
      ],
      counterexample: [
        "平方跨正负数不保序；负号反转排序；改变α可改变偏好。",
        "互补拐角没有唯一MRS；风险期望效用不能套任意递增变换。",
      ],
      uncertainty:
        "我仍不确定：现实比较是否符合该偏好假设？我的困惑来自排序、标签还是局部变化？",
    },
  },
  {
    id: "M03",
    title: "最优选择如何长成需求",
    centralQuestion: "怎样从约束与偏好推出选择，再推出需求关系？",
    prerequisites: ["M01", "M02"],
    modelCard: {
      object: "给定条件下的最优组合或集合；固定其余条件的自身价格—数量关系。",
      known: [
        "m、px、py与偏好参数；价格严格为正。",
        "哪一个条件被改变，哪些保持不变。",
      ],
      unknown: [
        "最优(x,y)或最优集合，支出与可达到的偏好水平。",
        "各个px对应的最优x；需求关系怎样随条件改变。",
      ],
      relations: [
        "CD正预算：预算用完且MRS=px/py，得到x*=αm/px、y*=(1−α)m/py。",
        "线性比较a/px与b/py；并列时预算边界为最优集合。",
        "互补：x=y=m/(px+py)；需求由同一求解器逐价扫描。",
      ],
      derivation: [
        "先定义优化问题，再判断内点、角点、拐角与退化。",
        "适用时联立预算与边际条件；最后检查可行性和全局性。",
        "每个价格重新优化，保持其余条件固定，区分沿关系移动与整条关系变化。",
      ],
      counterexample: [
        "线性角点、整段并列与互补拐角不依赖唯一光滑相切。",
        "零预算只有原点；总价格效应不能未经补偿直接叫替代效应。",
        "现实价格与销量的共变不自动识别固定条件下的需求。",
      ],
      uncertainty:
        "我仍不确定：哪个前提支持这个解？是否漏了边界或多解？哪些结论来自模型，哪些需要现实证据？",
    },
  },
];

describe("directory metadata remains consistent with complete authored content", () => {
  it("keeps every catalog title, question summary, module and status synchronized with all 24 lessons", () => {
    const expected = authoredLessons.map(lesson => ({
      id: lesson.id, moduleId: lesson.moduleId, title: lesson.title,
      summary: lesson.centralQuestion, status: lesson.status,
    }));
    expect(expected.map(lesson => lesson.id)).toEqual(lessonIds);
    expect(catalogData.catalog).toEqual(expected);
    expect(catalog).toEqual(expected);
    expect(new Set(catalog.map(lesson => lesson.id)).size).toBe(24);
  });

  it("preserves the entire 78-entry glossary and the lightweight search directory without omitted or invented terms", () => {
    expect(authoredGlossary).toHaveLength(78);
    expect(glossaryData).toEqual(authoredGlossary);
    expect(terms).toEqual(authoredGlossary.map(({ id, term, lessonIds }) => ({ id, term, lessonIds })));
    expect(new Set(terms.map(entry => entry.id)).size).toBe(78);
    for (const term of terms) {
      expect(term.lessonIds.length).toBeGreaterThan(0);
      for (const id of term.lessonIds) expect(lessonIds).toContain(id);
    }
  });

  it("preserves all 12 full model cards and module prerequisites after metadata extraction", () => {
    const expected = [...firstModules, ...modulesM04M06, ...modulesM07M09, ...modulesM10M12];
    expect(expected.map(module => module.id)).toEqual(Array.from({ length: 12 }, (_, n) => `M${String(n + 1).padStart(2, "0")}`));
    expect(catalogData.modules).toEqual(expected);
    expect(modules).toEqual(expected);
    expect(new Set(modules.map(module => module.id)).size).toBe(12);
  });
});

describe("asynchronous course loading", () => {
  it("loads each real lesson from all four content groups, including concurrent requests", async () => {
    const loaded = await Promise.all(lessonIds.map(loadLesson));
    expect(loaded).toEqual(authoredLessons);
    expect(loaded.every(lesson => lesson?.status === "available")).toBe(true);
    // A deep-link load works before loading all bodies, and repeat calls never
    // substitute a placeholder or mix an adjacent module into the same ID.
    const [first, repeated, final] = await Promise.all([
      loadLesson("M01-A"), loadLesson("M01-A"), loadLesson("M12-B"),
    ]);
    expect(first).toBe(repeated);
    expect(first?.id).toBe("M01-A");
    expect(final).toEqual(authoredLessons[23]);
  });

  it("loads the complete content and glossary for explicit whole-course operations", async () => {
    expect(await loadAllLessons()).toEqual(authoredLessons);
    expect(await loadGlossary()).toEqual(authoredGlossary);
  });

  it.each(["", "M1-A", "M00-A", "M13-A", "M01-C", "A01-A", "__proto__", "M01-A/../M12-B"])("returns no lesson for unknown or malformed ID %j", async id => {
    expect(await loadLesson(id)).toBeUndefined();
  });
});

describe("reading and directory search", () => {
  it.each(["", " ", "\n\t\r", "　"])("returns an empty result for blank input %j", query => {
    expect(searchCourse(query, authoredLessons)).toEqual([]);
  });

  it("normalizes case, outer whitespace and fullwidth identifiers before directory lookup", () => {
    expect(normalizeQuery("　Ｍ０５－Ａ　")).toBe("m05-a");
    expect(searchCourse("　ｍ０５－ａ　")).toEqual(searchCourse("M05-A"));
    expect(searchCourse("M05-A")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "M05-A", href: "#/lesson/M05-A", title: "M05-A · 个体计划怎样形成市场均衡" }),
    ]));
  });

  it("finds glossary concepts without requiring lesson bodies and ranks titled lessons above related concepts", () => {
    const term = authoredGlossary.find(entry => entry.term === "边际替代率")!;
    const results = searchCourse("边际替代率");
    expect(results[0].id).toBe("M02-B");
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: term.id, title: term.term, href: `#/glossary/${term.id}` }),
    ]));
    expect(new Set(results.map(entry => entry.id)).size).toBe(results.length);
  });

  it("searches lesson prose only when bodies are supplied, including an authored boundary explanation", async () => {
    const query = "若十单位门票已经支付且不能退款、转卖";
    expect(searchCourse(query)).toEqual([]);
    const results = searchCourse(query, await loadAllLessons());
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: "M01-A", href: "#/lesson/M01-A" });
    expect(results[0].excerpt).toContain(query);
  });

  it("includes assumptions, formulas, numerical examples, recaps and exercise prompts in body search", () => {
    const fields = [
      "唯一本次测试假设", "唯一本次测试公式", "唯一本次测试例子",
      "唯一本次测试迁移", "唯一本次测试检查", "唯一本次测试问题",
    ];
    const lesson: Lesson = {
      ...authoredLessons[0], centralQuestion: fields[5], assumptions: [fields[0]],
      workedExample: [fields[2]], recap: [fields[3]], counterexample: [],
      sections: [{ id: "derivation", title: "推导", paragraphs: [], formula: fields[1] }],
      checks: [{ ...authoredLessons[0].checks[0], prompt: fields[4] }],
    };
    for (const query of fields) {
      expect(searchCourse(query)).toEqual([]);
      expect(searchCourse(query, [lesson])).toEqual([
        expect.objectContaining({ id: "M01-A", href: "#/lesson/M01-A", excerpt: query }),
      ]);
    }
  });

  it("keeps a catalog hit once even if the lesson body matches the same query", () => {
    const directory = searchCourse("M01-A").find(result => result.id === "M01-A")!;
    const lesson: Lesson = { ...authoredLessons[0], centralQuestion: "M01-A 也出现在正文" };
    const results = searchCourse("M01-A", [lesson]);
    expect(results.filter(result => result.id === "M01-A")).toEqual([directory]);
  });

  it("caps oversized search input and returns a short contextual excerpt around a distant prose match", () => {
    const query = "x".repeat(100);
    expect(normalizeQuery("X".repeat(10_000))).toBe(query);
    const lesson: Lesson = { ...authoredLessons[0], centralQuestion: "前".repeat(200) + query + "后".repeat(200) };
    const results = searchCourse("X".repeat(10_000), [lesson]);
    expect(results).toHaveLength(1);
    expect(results[0].excerpt).toContain(query);
    expect(results[0].excerpt.startsWith("…")).toBe(true);
    expect(results[0].excerpt.endsWith("…")).toBe(true);
    expect(results[0].excerpt.length).toBeLessThanOrEqual(162);
  });

  it("treats HTML-like input and lesson text as ordinary strings without evaluating it", () => {
    const html = '<script>globalThis.navigationExecuted=true</script><img src=x onerror="globalThis.navigationExecuted=true">';
    const lesson: Lesson = { ...authoredLessons[0], centralQuestion: html };
    expect(searchCourse("<script>")).toEqual([]);
    const results = searchCourse("<script>", [lesson]);
    expect(results).toHaveLength(1);
    expect(results[0].excerpt).toBe(html);
    expect((globalThis as typeof globalThis & { navigationExecuted?: boolean }).navigationExecuted).toBeUndefined();
  });

  it("returns deterministic ordering for repeated whole-course searches and no fabricated match", () => {
    const first = searchCourse("预算", authoredLessons);
    expect(first.length).toBeGreaterThan(1);
    expect(searchCourse("预算", authoredLessons)).toEqual(first);
    expect(searchCourse("不存在的课程对象20261004", authoredLessons)).toEqual([]);
  });
});

// printCurrentPage/downloadText need a real DOM, browser download events and
// afterprint lifecycle. Node-only unit fakes cannot validate those behaviors;
// the browser E2E suite verifies them, including long notes and HTML-like text.
