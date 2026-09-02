import type { DesignerTrendSeries } from "../../types";
import { getSeriesColor } from "./chartUtils";

type LegendProps = {
  series: DesignerTrendSeries[];
  hiddenIds?: Set<string>;
  onToggle?: (designerUserId: string) => void;
};

export function Legend({ series, hiddenIds, onToggle }: LegendProps) {
  const visible = series.filter((s) => !s.isTeamAverage || series.length <= 3);

  return (
    <div className="chart-legend">
      {visible.map((s) => {
        const hidden = hiddenIds?.has(s.designerUserId);
        return (
          <button
            key={s.designerUserId}
            type="button"
            className={`legend-item ${hidden ? "legend-hidden" : ""} ${s.isTeamAverage ? "legend-team" : ""}`}
            onClick={() => onToggle?.(s.designerUserId)}
            title={s.isTeamAverage ? "Team average (dotted line)" : s.designerName}
          >
            <span
              className="legend-swatch"
              style={{
                background: getSeriesColor(s.colorIndex, s.isTeamAverage),
                borderStyle: s.isTeamAverage ? "dashed" : "solid",
              }}
            />
            {s.designerName}
            {s.isLive && <span className="live-badge">live</span>}
          </button>
        );
      })}
    </div>
  );
}
