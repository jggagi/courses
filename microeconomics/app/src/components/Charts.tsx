import type { Point, Budget, Preference } from "../models/economics";
import {
  budgetGeometry,
  indifferenceCurve,
  solveChoice,
  demandSeries,
} from "../models/economics";

export const fmt = (n: number) =>
  Number.isFinite(n) ? Number(n.toFixed(3)).toString() : "不适用";
const W = 560,
  H = 340,
  left = 54,
  top = 24,
  width = 468,
  height = 268;
type Curve = {
  points: Point[];
  label: string;
  color: string;
  dashed?: boolean;
  fill?: boolean;
  thick?: boolean;
};
export function Plot({
  curves,
  xMax,
  yMax,
  xLabel = "x（商品单位）",
  yLabel = "y（商品单位）",
  title,
  legend = "scenario",
}: {
  curves: Curve[];
  xMax: number;
  yMax: number;
  xLabel?: string;
  yLabel?: string;
  title: string;
  legend?: "scenario" | "bundles" | "none";
}) {
  const sx = (x: number) => left + (x / xMax) * width;
  const sy = (y: number) => top + height - (y / yMax) * height;
  return (
    <figure className="plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <title>{title}；精确数字见下方表格</title>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1={sx((i * xMax) / 4)}
              x2={sx((i * xMax) / 4)}
              y1={top}
              y2={sy(0)}
              className="grid"
            />
            <line
              x1={left}
              x2={sx(xMax)}
              y1={sy((i * yMax) / 4)}
              y2={sy((i * yMax) / 4)}
              className="grid"
            />
            <text x={sx((i * xMax) / 4)} y={sy(0) + 20} textAnchor="middle">
              {fmt((i * xMax) / 4)}
            </text>
            <text x={left - 8} y={sy((i * yMax) / 4) + 4} textAnchor="end">
              {fmt((i * yMax) / 4)}
            </text>
          </g>
        ))}
        <path
          d={`M${left},${top} V${sy(0)} H${sx(xMax)}`}
          fill="none"
          stroke="#52615b"
        />
        {curves.map((c, i) => (
          <g key={i}>
            {c.points.length === 1 ? (
              <circle
                cx={sx(c.points[0].x)}
                cy={sy(c.points[0].y)}
                r="5"
                fill={c.dashed ? "#fff" : c.color}
                stroke={c.color}
                strokeWidth="2"
              />
            ) : (
              <polyline
                points={c.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
                fill={c.fill ? c.color : "none"}
                fillOpacity={c.fill ? ".07" : undefined}
                stroke={c.color}
                strokeWidth={c.thick ? 5 : 2.5}
                strokeDasharray={c.dashed ? "7 5" : undefined}
              />
            )}
          </g>
        ))}
        <text x={sx(xMax)} y={H - 6} textAnchor="end">
          {xLabel}
        </text>
        <text x={left} y="14">
          {yLabel}
        </text>
      </svg>
      <figcaption>
        {title}。
        {legend !== "none" && (
          <>
            <span className="legend-a">
              {legend === "bundles" ? "组合 A" : "A 基准"}：虚线 / ○
            </span>
            ；
            <span className="legend-b">
              {legend === "bundles" ? "组合 B" : "B 实验"}：实线 / ●
            </span>
            。
            {legend === "scenario"
              ? "A/B 使用相同坐标尺度；相同情景的曲线会重叠。"
              : "两组合使用相同偏好与坐标尺度。"}
          </>
        )}
      </figcaption>
    </figure>
  );
}
export function BudgetPlot({
  baseline,
  scenario,
  point,
  preference,
  baselinePreference,
  choices = false,
}: {
  baseline: Budget;
  scenario: Budget;
  point?: Point;
  preference?: Preference;
  baselinePreference?: Preference;
  choices?: boolean;
}) {
  const a = budgetGeometry(baseline),
    b = budgetGeometry(scenario);
  const xMax = Math.max(a.xIntercept, b.xIntercept, point?.x || 0, 1) * 1.15;
  const yMax = Math.max(a.yIntercept, b.yIntercept, point?.y || 0, 1) * 1.15;
  const curves: Curve[] = [
    {
      points: a.vertices,
      label: "A",
      color: "#6c7c80",
      dashed: true,
      fill: true,
    },
    { points: b.vertices, label: "B", color: "#1a7965", fill: true },
  ];
  if (point) curves.push({ points: [point], label: "手选", color: "#bc7144" });
  if (choices && preference) {
    for (const [budget, choicePreference, color, dashed] of [
      [baseline, baselinePreference || preference, "#6c7c80", true],
      [scenario, preference, "#1a7965", false],
    ] as const) {
      const choice = solveChoice(budget, choicePreference);
      if (choice.kind === "optimal_set")
        curves.push({
          points: choice.endpoints,
          label: "最优集合",
          color,
          dashed,
          thick: true,
        });
      else {
        for (const points of indifferenceCurve(choicePreference, choice.point, {
          xMax,
          yMax,
        }))
          curves.push({ points, label: "等值线", color, dashed });
        curves.push({ points: [choice.point], label: "最优点", color, dashed });
      }
    }
  }
  return (
    <Plot
      curves={curves}
      xMax={xMax}
      yMax={yMax}
      title="预算集与组合：阴影为可行区域，边界连接两轴截距"
    />
  );
}
export function PreferencePlot({
  preference,
  first,
  second,
}: {
  preference: Preference;
  first: Point;
  second: Point;
}) {
  const curves: Curve[] = [];
  for (const [point, color, dashed] of [
    [first, "#6c7c80", true],
    [second, "#1a7965", false],
  ] as const) {
    for (const points of indifferenceCurve(preference, point, {
      xMax: 60,
      yMax: 60,
    }))
      curves.push({ points, label: "无差异集合", color, dashed });
    curves.push({ points: [point], label: "组合", color, dashed });
  }
  return (
    <Plot
      curves={curves}
      xMax={60}
      yMax={60}
      legend="bundles"
      title="实验情景中经过组合 A、B 的无差异集合；变换表示不改变这些集合"
    />
  );
}
export function DemandPlot({
  baseline,
  scenario,
  baselinePreference,
  preference,
}: {
  baseline: Budget;
  scenario: Budget;
  baselinePreference: Preference;
  preference: Preference;
}) {
  const prices = Array.from({ length: 77 }, (_, i) => 1 + i / 4);
  // Include exact tie prices; never join opposite sides of a set-valued discontinuity.
  for (const p of [baseline, scenario])
    if (p.py >= 1 && p.py <= 20 && !prices.includes(p.py)) prices.push(p.py);
  prices.sort((a, b) => a - b);
  const curves: Curve[] = [];
  let max = 1;
  for (const [budget, pref, color, dashed] of [
    [baseline, baselinePreference, "#6c7c80", true],
    [scenario, preference, "#1a7965", false],
  ] as const) {
    let segment: Point[] = [];
    for (const sample of demandSeries(budget, pref, prices)) {
      max = Math.max(max, sample.xRange[1]);
      if (sample.choice.kind === "optimal_set") {
        if (segment.length)
          curves.push({ points: segment, label: "需求", color, dashed });
        segment = [];
        curves.push({
          points: [
            { x: sample.xRange[0], y: sample.price },
            { x: sample.xRange[1], y: sample.price },
          ],
          label: "最优数量区间",
          color,
          dashed,
          thick: true,
        });
      } else segment.push({ x: sample.xRange[0], y: sample.price });
    }
    if (segment.length)
      curves.push({ points: segment, label: "需求", color, dashed });
  }
  return (
    <Plot
      curves={curves}
      xMax={max * 1.1}
      yMax={20}
      xLabel="最优 x（商品单位）"
      yLabel="px（货币单位 / x）"
      title="从同一求解器扫描 px ∈ [1,20] 生成的需求关系"
    />
  );
}
