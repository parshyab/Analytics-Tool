import { useMemo, useState } from "react";
import type { DesignerTimeSeriesPoint, DesignerTrendSeries, TrendMetric } from "../../types";
import {
  formatMetricValue,
  getAllPeriods,
  getMetricValue,
  getSeriesColor,
  isPercentMetric,
} from "./chartUtils";
import { ChartTooltip } from "./Tooltip";
import { Legend } from "./Legend";

export type LineChartProps = {
  series: DesignerTrendSeries[];
  metric: TrendMetric;
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  emptyStateMessage?: string;
};

const PAD = { top: 16, right: 16, bottom: 36, left: 48 };

export function LineChart({
  series,
  metric,
  height = 260,
  showLegend = true,
  showTooltip = true,
  emptyStateMessage = "No designer data available for this filter.",
}: LineChartProps) {
  const [tooltip, setTooltip] = useState<{
    point: DesignerTimeSeriesPoint;
    x: number;
    y: number;
  } | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visibleSeries = series.filter((s) => !hidden.has(s.designerUserId));
  const periods = useMemo(() => getAllPeriods(visibleSeries), [visibleSeries]);
  const width = 640;

  const { minY, maxY, paths, dots } = useMemo(() => {
    let min = 0;
    let max = 0;
    const allValues: number[] = [];

    for (const s of visibleSeries) {
      for (const p of s.points) {
        const v = getMetricValue(p, metric);
        allValues.push(v);
      }
    }

    if (allValues.length === 0) {
      return { minY: 0, maxY: 1, paths: [], dots: [] };
    }

    min = Math.min(...allValues, 0);
    max = Math.max(...allValues, isPercentMetric(metric) ? 100 : 1);
    if (max === min) max = min + 1;

    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;

    const xFor = (period: string) => {
      const i = periods.indexOf(period);
      return PAD.left + (periods.length <= 1 ? innerW / 2 : (i / (periods.length - 1)) * innerW);
    };

    const yFor = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;

    const pathList: { d: string; color: string; id: string; dashed: boolean }[] = [];
    const dotList: {
      cx: number;
      cy: number;
      point: DesignerTimeSeriesPoint;
      color: string;
    }[] = [];

    for (const s of visibleSeries) {
      const coords = s.points
        .filter((p) => periods.includes(p.periodKey))
        .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
        .map((p) => ({
          x: xFor(p.periodKey),
          y: yFor(getMetricValue(p, metric)),
          point: p,
        }));

      if (coords.length === 0) continue;

      const d = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
      pathList.push({
        d,
        color: getSeriesColor(s.colorIndex, s.isTeamAverage),
        id: s.designerUserId,
        dashed: !!s.isTeamAverage,
      });

      for (const c of coords) {
        dotList.push({ cx: c.x, cy: c.y, point: c.point, color: getSeriesColor(s.colorIndex, s.isTeamAverage) });
      }
    }

    return { minY: min, maxY: max, paths: pathList, dots: dotList };
  }, [visibleSeries, periods, metric, height]);

  if (series.length === 0 || periods.length === 0) {
    return <p className="empty chart-empty">{emptyStateMessage}</p>;
  }

  const innerH = height - PAD.top - PAD.bottom;
  const yTicks = [minY, (minY + maxY) / 2, maxY];

  return (
    <div className="chart-wrap">
      {showLegend && (
        <Legend
          series={series}
          hiddenIds={hidden}
          onToggle={(id) => {
            setHidden((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
        />
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart" role="img">
        {yTicks.map((tick, i) => {
          const y = PAD.top + innerH - ((tick - minY) / (maxY - minY || 1)) * innerH;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={width - PAD.right} y2={y} stroke="#e5e7eb" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="9" fill="#6b7280">
                {formatMetricValue(metric, tick)}
              </text>
            </g>
          );
        })}

        {periods.map((p, i) => {
          const innerW = width - PAD.left - PAD.right;
          const x =
            PAD.left + (periods.length <= 1 ? innerW / 2 : (i / (periods.length - 1)) * innerW);
          return (
            <text key={p} x={x} y={height - 8} textAnchor="middle" fontSize="9" fill="#6b7280">
              {p.length > 8 ? p.slice(5) : p}
            </text>
          );
        })}

        {paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={p.dashed ? 1.5 : 2}
            strokeDasharray={p.dashed ? "6 4" : undefined}
          />
        ))}

        {dots.map((d, i) => (
          <circle
            key={`${d.point.periodKey}-${i}`}
            cx={d.cx}
            cy={d.cy}
            r={d.point.isLive ? 5 : 4}
            fill={d.point.isLive ? "#fff" : d.color}
            stroke={d.color}
            strokeWidth={2}
            onMouseEnter={(e) =>
              showTooltip &&
              setTooltip({ point: d.point, x: e.clientX, y: e.clientY })
            }
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </svg>
      {showTooltip && tooltip && (
        <ChartTooltip point={tooltip.point} x={tooltip.x} y={tooltip.y} />
      )}
    </div>
  );
}
