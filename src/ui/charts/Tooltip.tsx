import type { DesignerTimeSeriesPoint } from "../../types";
import { buildTooltipLines } from "./chartUtils";

type TooltipProps = {
  point: DesignerTimeSeriesPoint | null;
  x: number;
  y: number;
};

export function ChartTooltip({ point, x, y }: TooltipProps) {
  if (!point) return null;
  const lines = buildTooltipLines(point);

  return (
    <div
      className="chart-tooltip"
      style={{
        left: Math.min(x + 12, window.innerWidth - 240),
        top: Math.max(y - 8, 8),
      }}
    >
      <strong>{lines[0]}</strong>
      <div className="chart-tooltip-sub">{lines[1]}</div>
      {lines.slice(2).map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}
