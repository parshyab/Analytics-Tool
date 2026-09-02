import type { TrendMetric } from "../../../types";
import { getMetricLabel } from "../../../productivity/productivityTrendAggregator";

type Option = { value: string; label: string };

type Props = {
  filterCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  glossaryOpen: boolean;
  onToggleGlossary: () => void;
  designers: Option[];
  designerValue: string;
  onDesignerChange: (value: string) => void;
  teams: Option[];
  teamValue: string;
  onTeamChange: (value: string) => void;
  metric: TrendMetric;
  onMetricChange: (metric: TrendMetric) => void;
  metrics: TrendMetric[];
  onReset: () => void;
  onRefresh: () => void;
  onExport: () => void;
};

export function ControlBar({
  filterCount,
  filtersOpen,
  onToggleFilters,
  glossaryOpen,
  onToggleGlossary,
  designers,
  designerValue,
  onDesignerChange,
  teams,
  teamValue,
  onTeamChange,
  metric,
  onMetricChange,
  metrics,
  onReset,
  onRefresh,
  onExport,
}: Props) {
  return (
    <div className="dashboard-control-bar">
      <div className="dashboard-control-bar__left">
        <button
          type="button"
          className={`dashboard-btn ${filtersOpen ? "dashboard-btn--active" : ""}`}
          onClick={onToggleFilters}
        >
          Filters
          {filterCount > 0 && <span className="dashboard-btn-count">{filterCount}</span>}
        </button>

        <div className="dashboard-select-wrap">
          <label htmlFor="dash-designer">Designer</label>
          <select
            id="dash-designer"
            value={designerValue}
            onChange={(e) => onDesignerChange(e.target.value)}
          >
            <option value="">All</option>
            {designers.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div className="dashboard-select-wrap">
          <label htmlFor="dash-team">Team</label>
          <select
            id="dash-team"
            value={teamValue}
            onChange={(e) => onTeamChange(e.target.value)}
          >
            <option value="">All</option>
            {teams.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="dashboard-select-wrap">
          <label htmlFor="dash-metric">Metric</label>
          <select
            id="dash-metric"
            value={metric}
            onChange={(e) => onMetricChange(e.target.value as TrendMetric)}
          >
            {metrics.map((m) => (
              <option key={m} value={m}>{getMetricLabel(m)}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className={`dashboard-btn ${glossaryOpen ? "dashboard-btn--active" : ""}`}
          onClick={onToggleGlossary}
        >
          Metric guide
        </button>
      </div>

      <div className="dashboard-control-bar__right">
        <button type="button" className="dashboard-btn dashboard-btn--ghost" onClick={onReset}>
          Reset
        </button>
        <button type="button" className="dashboard-btn" onClick={onRefresh}>
          Refresh
        </button>
        <button type="button" className="dashboard-btn dashboard-btn--primary" onClick={onExport}>
          Export CSV
        </button>
      </div>
    </div>
  );
}
