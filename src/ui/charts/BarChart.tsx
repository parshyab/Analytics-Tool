import { useMemo } from "react";
import type { DesignerTrendSeries } from "../../types";
import { getAllPeriods } from "./chartUtils";

export type BarChartProps = {
  series: DesignerTrendSeries[];
  height?: number;
  emptyStateMessage?: string;
};

const PAD = { top: 16, right: 16, bottom: 36, left: 48 };

export function BarChart({
  series,
  height = 260,
  emptyStateMessage = "No designer data available for this filter.",
}: BarChartProps) {
  const designerSeries = series.filter((s) => !s.isTeamAverage);
  const periods = useMemo(() => getAllPeriods(designerSeries), [designerSeries]);
  const width = 640;

  const aggregated = useMemo(() => {
    return periods.map((period) => {
      let actual = 0;
      let benchmark = 0;
      for (const s of designerSeries) {
        const p = s.points.find((pt) => pt.periodKey === period);
        if (p) {
          actual += p.actualMinutes / 60;
          benchmark += p.benchmarkMinutes / 60;
        }
      }
      return { period, actual, benchmark };
    });
  }, [designerSeries, periods]);

  if (aggregated.length === 0) {
    return <p className="empty chart-empty">{emptyStateMessage}</p>;
  }

  const maxVal = Math.max(...aggregated.flatMap((a) => [a.actual, a.benchmark]), 1);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const groupW = innerW / aggregated.length;
  const barW = Math.max(4, groupW / 3);

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "#6c5ce7" }} /> Actual hours
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "#9ca3af" }} /> Benchmark hours
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="bar-chart" role="img">
        {[0, maxVal / 2, maxVal].map((tick, i) => {
          const y = PAD.top + innerH - (tick / maxVal) * innerH;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={width - PAD.right} y2={y} stroke="#e5e7eb" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="9" fill="#6b7280">
                {tick.toFixed(0)}h
              </text>
            </g>
          );
        })}

        {aggregated.map((a, i) => {
          const gx = PAD.left + i * groupW + groupW / 2;
          const actualH = (a.actual / maxVal) * innerH;
          const benchH = (a.benchmark / maxVal) * innerH;
          return (
            <g key={a.period}>
              <rect
                x={gx - barW - 2}
                y={PAD.top + innerH - actualH}
                width={barW}
                height={actualH}
                fill="#6c5ce7"
                rx={2}
              />
              <rect
                x={gx + 2}
                y={PAD.top + innerH - benchH}
                width={barW}
                height={benchH}
                fill="#9ca3af"
                rx={2}
              />
              <text x={gx} y={height - 8} textAnchor="middle" fontSize="9" fill="#6b7280">
                {a.period.length > 8 ? a.period.slice(5) : a.period}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
