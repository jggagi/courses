import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import receipt from "../../src/content/data/oi-source-receipt.json";
import { caseStudies, caseEvidenceText, compareCaseDates, getCaseFigure, getCaseRawSnapshot, getCaseTable, parseCaseExcerpt, transformCaseValue } from "../../src/content/cases";

describe("Fixed historical evidence cases", () => {
  it("uses two identified cases and two documented sources with six historical observations each", () => {
    expect(caseStudies).toHaveLength(2);
    expect(new Set(caseStudies.map((study) => study.id)).size).toBe(2);
    for (const study of caseStudies) {
      expect(study.referenceId).toMatch(/^MIC-OI-/);
      expect(study.observations.map((row) => row.date)).toEqual(["2020-02-29", "2020-03-14", "2020-03-28", "2020-04-11", "2020-05-09", "2020-06-06"]);
      expect(study.questions).toHaveLength(3);
      expect(study.questions.every((question) => question.prompt.length > 25 && question.explanation.length > 50 && question.rubric.length === 3)).toBe(true);
      expect(study.identificationBoundary).toContain("不能识别");
      expect(study.syntheticPractice.explanation).toMatch(/合成|玩具/);
    }
  });

  it.each(caseStudies.map((study) => [study.id, study] as const))("%s preserves the exact bytes and SHA-256 of its raw excerpt", (_, study) => {
    const raw = getCaseRawSnapshot(study);
    expect(createHash("sha256").update(raw, "utf8").digest("hex")).toBe(study.provenance.snapshotSha256);
    const source = receipt.files.find((file) => file.file === study.provenance.rawSnapshotFile)!;
    expect(source.excerptSha256).toBe(study.provenance.snapshotSha256);
    expect(source.upstreamSha256).toBe(study.provenance.upstreamSha256);
    expect(source.sourceUrl).toBe(study.provenance.sourceUrl);
    expect(source.bytes).toBe(Buffer.byteLength(raw, "utf8"));
    expect(raw.trim().split("\n")).toHaveLength(7);
    expect(source.upstreamBlobSha).toMatch(/^[a-f0-9]{40}$/);
  });

  it("records provenance, fixed vintage, units, transformation and reusable-data attribution", () => {
    for (const study of caseStudies) {
      for (const key of ["provider", "seriesId", "sourceUrl", "observationPeriod", "frequency", "units", "nominalReal", "seasonalAdjustment", "retrievedAtUTC", "vintageRevision", "transformation", "licenseNote"] as const) expect(study.provenance[key].length, key).toBeGreaterThan(8);
      expect(study.provenance.sourceUrl).toContain(receipt.upstreamCommit);
      expect(study.provenance.retrievedAtUTC).toMatch(/^2026-10-04T\d\d:\d\d:\d\dZ$/);
      expect(study.provenance.vintageRevision).toContain("后来修订");
      expect(study.provenance.licenseNote).toContain("引用 OI Economic Tracker");
      expect(study.provenance.seriesId.split("；")).toEqual(study.series.map((series) => series.id));
    }
    expect(receipt.evidence[0].excerpt).toContain("Anyone is welcome to use this data");
    expect(receipt.evidence[1].excerpt).toContain("without seasonal");
    expect(receipt.evidence[2].excerpt).toContain("U.S. Department of Labor");
    expect(caseStudies[1].provenance.seasonalAdjustment).toContain("未明确");
  });

  it("converts card spending fractions to percent and differences to percentage points", () => {
    const study = caseStudies[0];
    const row = getCaseTable(study)[2];
    expect(row.values.spend_all).toBeCloseTo(-32.1, 12);
    expect(row.values.spend_all_q1).toBeCloseTo(-27.9, 12);
    expect(row.values.spend_all_q4).toBeCloseTo(-35.5, 12);
    const compare = compareCaseDates(study, "2020-03-28", "2020-05-09");
    expect(compare[0].difference).toBeCloseTo(15.6, 12);
    expect(compare[0].differenceUnit).toBe("百分点");
    // Independent raw source check: the three ZIP/all series are not equal-weight averages.
    expect(study.observations[2].values.spend_all).not.toBe((-.279 + -.355) / 2);
    expect(study.provenance.seasonalAdjustment).toContain("spend_s_");
  });

  it("preserves regular UI counts and computes a descriptive change without merging claims", () => {
    const study = caseStudies[1];
    expect(study.observations[2].values).toEqual({ initclaims_count_regular: 5931944, contclaims_count_regular: 3387289 });
    const compare = compareCaseDates(study, "2020-03-28", "2020-05-09");
    expect(compare[0].difference).toBeCloseTo(-3.633063, 12);
    expect(compare[1].difference).toBeCloseTo(17.244637, 12);
    expect(compare[0].differenceUnit).toBe("百万件");
    expect(study.provenance.transformation).toContain("不把初请与续请相加");
    expect(study.identificationBoundary).toContain("就业、求职、工资、资格");
  });

  it("plot and table share values while the time axis preserves the elapsed days", () => {
    const study = caseStudies[0];
    const figure = getCaseFigure(study);
    expect(figure.table).toEqual(getCaseTable(study));
    expect((figure.lastDay - figure.firstDay) / 86400000).toBe(98);
    expect(figure.yMin).toBeLessThan(-35.5);
    expect(figure.yMax).toBeGreaterThan(0);
    for (const row of figure.table) for (const value of Object.values(row.values)) if (value !== null) {
      expect(value).toBeGreaterThanOrEqual(figure.yMin);
      expect(value).toBeLessThanOrEqual(figure.yMax);
    }
  });

  it("preserves missing values and rejects invalid cells, dates and duplicate observations", () => {
    const valid = "year,month,day,spend\n2020,2,29,.\n2020,3,14,-.321\n";
    expect(parseCaseExcerpt(valid, ["spend"], "day")).toEqual([{ date: "2020-02-29", values: { spend: null } }, { date: "2020-03-14", values: { spend: -.321 } }]);
    expect(transformCaseValue(null, "fraction_to_percent")).toBeNull();
    expect(transformCaseValue(null, "count_to_million")).toBeNull();
    expect(() => parseCaseExcerpt(valid.replace("-.321", "NaN"), ["spend"], "day")).toThrow("数值无效");
    expect(() => parseCaseExcerpt(valid.replace("2020,2,29", "2020,2,30"), ["spend"], "day")).toThrow("日历");
    expect(() => parseCaseExcerpt(valid.replace("2020,3,14", "2020,2,29"), ["spend"], "day")).toThrow("重复");
    expect(() => parseCaseExcerpt(valid.replace(",-.321", ""), ["spend"], "day")).toThrow("行宽");
    expect(() => parseCaseExcerpt(valid, ["unknown"], "day")).toThrow("缺少");
    expect(() => transformCaseValue(Infinity, "count_to_million")).toThrow("有限");
  });

  it("does not interpolate an unobserved comparison date and supports equal or reversed comparisons", () => {
    const study = caseStudies[1];
    expect(() => compareCaseDates(study, "2020-03-29", "2020-05-09")).toThrow("已保存");
    expect(compareCaseDates(study, "2020-05-09", "2020-05-09").every((row) => row.difference === 0)).toBe(true);
    expect(compareCaseDates(study, "2020-05-09", "2020-03-28")[0].difference).toBeCloseTo(3.633063, 12);
  });

  it("missing comparisons stay missing and can be reviewed without a fabricated number", () => {
    const study = structuredClone(caseStudies[0]);
    study.observations[0].values.spend_all = null;
    expect(getCaseTable(study)[0].values.spend_all).toBeNull();
    expect(compareCaseDates(study, "2020-02-29", "2020-06-06")[0].difference).toBeNull();
    expect(caseEvidenceText(study, "2020-02-29", "2020-06-06")).toContain("差 缺失");
  });

  it("capstone evidence carries provenance and identification limits with computed comparisons", () => {
    const study = caseStudies[0];
    const text = caseEvidenceText(study, "2020-03-28", "2020-05-09");
    expect(text).toContain("observed，非 synthetic");
    expect(text).toContain(study.provenance.sourceUrl);
    expect(text).toContain(study.provenance.snapshotSha256);
    expect(text).toContain("2020-03-28 → 2020-05-09");
    expect(text).toContain("不能识别需求弹性");
    expect(text).toContain("至少一个替代机制");
  });
});
