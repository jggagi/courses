import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { createInitialState, type LabParameters, type LabSnapshot } from "../../src/persistence/store";
import { captureSnapshot } from "../../src/persistence/learning-tools";
import { advancedDefaults, runAdvancedLab } from "../../src/models/advanced";
import { extensionDefaults, EXTENSION_LAB_IDS, runExtensionLab } from "../../src/models/extensions";
import { snapshotReport, snapshotResults, SnapshotDetails } from "../../src/components/ExperimentHistory";
import { capstoneReportText } from "../../src/components/CourseCompletion";

const at = "2026-10-04T02:00:00.000Z";
function basicSnapshot(id: "ML01" | "ML02" | "ML03"): LabSnapshot & { baseline: LabParameters; scenario: LabParameters } {
  const state = createInitialState(at);
  state.labStates[id].revealed = true;
  return captureSnapshot(state, id, "测试快照", at).experimentHistory[0] as LabSnapshot & { baseline: LabParameters; scenario: LabParameters };
}

describe("saved snapshot displays and capstone exports", () => {
  it("retains base money results while displaying ML01's chosen currency scale", () => {
    const snapshot = basicSnapshot("ML01");
    snapshot.scenario = { ...snapshot.scenario, px: 6, x: 10, unitScale: 10 };
    const a = snapshotResults(snapshot, "baseline"), b = snapshotResults(snapshot, "scenario");
    expect(a.metrics.xIntercept).toBe(40);
    expect(b.metrics.xIntercept).toBe(20);
    expect(b.metrics.spending).toBe(120);
    expect(b.metrics.representedSpending).toBe(1200);
    expect(b.rows.find((row) => row.key === "feasible")?.value).toBe("可行");
  });

  it("reports changed ordinal labels, unchanged rankings and undefined kink MRS", () => {
    const snapshot = basicSnapshot("ML02");
    snapshot.scenario = { ...snapshot.scenario, representation: "square" };
    const a = snapshotResults(snapshot, "baseline"), b = snapshotResults(snapshot, "scenario");
    expect(a.status).toBe(b.status);
    expect(b.metrics.firstRepresentedUtility).toBeCloseTo(100);
    expect(a.metrics.firstRepresentedUtility).toBeCloseTo(10);
    snapshot.scenario = { ...snapshot.scenario, kind: "complements" };
    const kink = snapshotResults(snapshot, "scenario");
    expect(kink.metrics.firstMRS).toBeNull();
    expect(kink.rows.find((row) => row.key === "firstMRS")?.value).toContain("未定义");
  });

  it("preserves the complete linear optimal set instead of inventing one choice", () => {
    const snapshot = basicSnapshot("ML03");
    snapshot.scenario = { ...snapshot.scenario, kind: "linear", px: 2, py: 2 };
    const result = snapshotResults(snapshot, "scenario");
    expect(result.metrics.optimalX).toBeNull();
    expect(result.metrics.optimalY).toBeNull();
    expect(result.rows.find((row) => row.key === "optimalSet")?.value).toContain("(0, 60) 与 (60, 0)");
    expect(result.metrics.optimalSpending).toBe(120);
  });

  it("recomputes advanced and all extension results with their authoritative kernels", () => {
    const state = createInitialState(at);
    state.advancedLabStates.ML05.revealed = true;
    state.advancedLabStates.ML05.scenario.tau = 30;
    const advanced = captureSnapshot(state, "ML05", "税负", at).experimentHistory[0];
    expect(snapshotResults(advanced, "scenario")).toEqual(runAdvancedLab("ML05", { ...advancedDefaults("ML05"), tau: 30 }));
    for (const id of EXTENSION_LAB_IDS) {
      state.extensionLabStates[id].revealed = true;
      const snapshot = captureSnapshot(state, id, id, at).experimentHistory[0];
      expect(snapshotResults(snapshot, "scenario")).toEqual(runExtensionLab(id, extensionDefaults(id)));
      expect(JSON.stringify(snapshotReport(snapshot))).not.toContain("NaN");
    }
  });

  it("keeps exact inputs and explanation separate from formatted display values", () => {
    const snapshot = basicSnapshot("ML03");
    snapshot.scenario = { ...snapshot.scenario, alpha: .37, px: 7 };
    snapshot.explanation = "只改变价格；对照模型条件。";
    const before = JSON.stringify(snapshot);
    const report = snapshotReport(snapshot);
    expect(report.scenario).toEqual(snapshot.scenario);
    expect(report.scenarioResults.metrics.optimalX).toBe(0.37 * 120 / 7);
    expect(report.explanation).toBe(snapshot.explanation);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("exports exactly selected historical counterfactuals after current experiment changes", () => {
    let state = createInitialState(at);
    state.labStates.ML03.revealed = true;
    state.labStates.ML03.scenario.px = 6;
    state = captureSnapshot(state, "ML03", "价格翻倍", at);
    state.labStates.ML03.scenario.px = 9;
    state = captureSnapshot(state, "ML03", "价格三倍", at);
    state.labStates.ML03.scenario.px = 12;
    state = captureSnapshot(state, "ML03", "未选定的第四倍", at);
    state.capstoneSnapshots = state.experimentHistory.slice(0, 2).map((snapshot) => snapshot.id);
    state.capstone.object = "研究价格变化，不做现实预测。";
    state.labStates.ML03.scenario.px = 15;
    const text = capstoneReportText(state);
    expect(text).toContain("价格翻倍");
    expect(text).toContain("价格三倍");
    expect(text).not.toContain("未选定的第四倍");
    expect(text).toContain('"optimalX": 10');
    expect(text).toContain('"optimalX": 6.666666666666667');
    expect(text).toContain("研究价格变化，不做现实预测。");
    expect(text).not.toContain('"px": 15');
    expect(text).toContain("引用数量不代表分析正确或作品完成");
  });

  it("allows exporting a six-section draft with fewer than two selected snapshots", () => {
    const state = createInitialState(at);
    state.capstone.boundaries = "尚待实验检验。";
    const text = capstoneReportText(state);
    expect(text).toContain("草稿提示");
    expect(text).toContain("尚待实验检验。");
    expect(text).toContain("6 · 独立自评与仍不知道的事");
    expect(text).toContain("尚未选定快照");
  });

  it("renders imported user predictions and explanations strictly as text", () => {
    const snapshot = basicSnapshot("ML01");
    snapshot.prediction = '<script>alert("prediction")</script>';
    snapshot.explanation = '<img src=x onerror="alert(1)">';
    const html = renderToStaticMarkup(createElement(SnapshotDetails, { snapshot }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x");
  });
});
