import type { ReactNode } from "react";

export function TableScroll({
  label,
  children,
  testId,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="table-scroll guided-table"
      role="region"
      aria-label={label}
      tabIndex={0}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function TableReadingHelp() {
  return (
    <p className="table-reading-help">
      宽表可左右滚动，长表可上下滚动。键盘用 Tab 聚焦表格区域后，用方向键查看；
      表头和首列保留在视野内。图形的完整数字见相应结果表。
    </p>
  );
}

type Series = {
  label: string;
  values: (number | null)[];
  style: "solid" | "dashed";
};

export function SeriesChart({
  title,
  unit,
  periods,
  series,
}: {
  title: string;
  unit: string;
  periods: string[];
  series: Series[];
}) {
  const finite = series.flatMap((item) =>
    item.values.filter(
      (value): value is number => value !== null && Number.isFinite(value),
    ),
  );
  const low = Math.min(0, ...finite);
  const high = Math.max(1, ...finite);
  const range = high - low || 1;
  const x = (index: number) =>
    54 + index * (350 / Math.max(1, periods.length - 1));
  const y = (value: number) => 192 - ((value - low) / range) * 145;
  const segments = (values: (number | null)[]) => {
    const paths: string[] = [];
    let current = "";
    values.forEach((value, index) => {
      if (value === null || !Number.isFinite(value)) {
        if (current) paths.push(current);
        current = "";
      } else current += `${current ? " L" : "M"}${x(index)},${y(value)}`;
    });
    if (current) paths.push(current);
    return paths;
  };
  const round = (value: number) => Number(value.toFixed(2)).toString();
  return (
    <figure className="chart">
      <figcaption>
        {title}（纵轴：{unit}；横轴：合成时期）
      </figcaption>
      <svg
        viewBox="0 0 450 245"
        role="img"
        aria-label={`${title}。A为虚线，B为实线；完整数字见下方表格。`}
      >
        <title>{title}：A基准与B实验</title>
        <line x1="54" y1="28" x2="54" y2="192" stroke="currentColor" />
        <line
          x1="54"
          y1={y(0)}
          x2="414"
          y2={y(0)}
          stroke="currentColor"
          opacity="0.45"
        />
        {[low, low + range / 2, high].map((value, index) => (
          <g key={index}>
            <text x="47" y={y(value) + 4} textAnchor="end" fontSize="11">
              {round(value)}
            </text>
            <line
              x1="54"
              y1={y(value)}
              x2="414"
              y2={y(value)}
              stroke="currentColor"
              opacity="0.12"
            />
          </g>
        ))}
        {periods.map(
          (period, index) =>
            (periods.length <= 12 ||
              index === periods.length - 1 ||
              index % Math.ceil(periods.length / 8) === 0) && (
              <text
                key={period}
                x={x(index)}
                y="213"
                textAnchor="middle"
                fontSize="12"
              >
                {period}
              </text>
            ),
        )}
        {series.map((item, index) => (
          <g
            key={item.label}
            fill="none"
            stroke={index ? "#14664b" : "#4b526e"}
            strokeWidth="2.5"
            strokeDasharray={item.style === "dashed" ? "6 4" : undefined}
          >
            {segments(item.values).map((path, pathIndex) => (
              <path key={pathIndex} d={path} />
            ))}
            {item.values.map((value, valueIndex) =>
              value !== null && Number.isFinite(value) ? (
                <circle
                  key={valueIndex}
                  cx={x(valueIndex)}
                  cy={y(value)}
                  r="3.5"
                />
              ) : null,
            )}
          </g>
        ))}
        {series.map((item, index) => (
          <g key={item.label}>
            <line
              x1={70 + index * 150}
              y1="234"
              x2={100 + index * 150}
              y2="234"
              stroke={index ? "#14664b" : "#4b526e"}
              strokeWidth="2.5"
              strokeDasharray={item.style === "dashed" ? "6 4" : undefined}
            />
            <text x={108 + index * 150} y="238" fontSize="12">
              {item.label}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

export type FlowRow = {
  id: string;
  label: string;
  source: string;
  destination: string;
  amount: number;
  note: string;
};

export function ActivityFlow({ rows }: { rows: FlowRow[] }) {
  const height = Math.max(150, rows.length * 82 + 48);
  return (
    <figure className="chart">
      <figcaption>
        活动来源 → 流向（货币单位／本期；箭头表示活动价值流向，宽度不代表数量）
      </figcaption>
      <svg
        viewBox={`0 0 620 ${height}`}
        role="img"
        aria-label="生产活动的来源和流向。下方活动表提供相同文字与数字。"
      >
        <title>本期活动的来源和流向</title>
        {rows.map((row, index) => {
          const top = index * 82 + 22;
          return (
            <g key={row.id}>
              <rect
                x="8"
                y={top}
                width="190"
                height="57"
                rx="5"
                fill="none"
                stroke="currentColor"
              />
              <rect
                x="413"
                y={top}
                width="198"
                height="57"
                rx="5"
                fill="none"
                stroke="currentColor"
              />
              <text x="103" y={top + 22} textAnchor="middle" fontSize="14">
                {row.source}
              </text>
              <text x="512" y={top + 22} textAnchor="middle" fontSize="14">
                {row.destination}
              </text>
              <text x="304" y={top + 14} textAnchor="middle" fontSize="12">
                {row.label}
              </text>
              <path
                d={`M205,${top + 29} L403,${top + 29} l-9,-6 m9,6 l-9,6`}
                fill="none"
                stroke="currentColor"
              />
              <text x="304" y={top + 51} textAnchor="middle" fontSize="13">
                {Number(row.amount.toFixed(2))}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
