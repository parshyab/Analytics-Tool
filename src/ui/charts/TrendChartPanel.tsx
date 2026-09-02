import type { DesignerTrendSeries, TrendMetric } from "../../types";
import { PRIMARY_TREND_CHARTS } from "../../types";
import { getMetricLabel, isBarMetric } from "./chartUtils";
import { LineChart } from "./LineChart";
import { BarChart } from "./BarChart";

type Props = {
  series: DesignerTrendSeries[];
  activeMetric: TrendMetric;
  onMetricChange: (metric: TrendMetric) => void;
  emptyMessage?: string | null;
  showComparison?: boolean;
};

export function TrendChartPanel({
  series,
  activeMetric,
  onMetricChange,
  emptyMessage,
  showComparison,
}: Props) {
  const activeChart = PRIMARY_TREND_CHARTS.find((c) => c.metric === activeMetric);
  const chartLabel = activeChart?.description ?? getMetricLabel(activeMetric);

  return (
    <div className="trend-chart-panel">
      <div className="chart-tab-bar" role="tablist">
        {PRIMARY_TREND_CHARTS.map((chart) => (
          <button
            key={chart.metric}
            type="button"
            role="tab"
            aria-selected={activeMetric === chart.metric}
            className={`chart-tab ${activeMetric === chart.metric ? "chart-tab-active" : ""}`}
            onClick={() => onMetricChange(chart.metric)}
          >
            {chart.label}
          </button>
        ))}
        {showComparison && (
          <button
            type="button"
            role="tab"
            aria-selected={activeMetric === "actualHours"}
            className={`chart-tab chart-tab-secondary ${activeMetric === "actualHours" || activeMetric === "benchmarkHours" ? "chart-tab-active" : ""}`}
            onClick={() => onMetricChange("actualHours")}
          >
            Actual vs benchmark
          </button>
        )}
      </div>

      <div className="chart-panel-body">
        <p className="chart-panel-desc">{chartLabel}</p>
        {emptyMessage ? (
          <div className="trend-empty-state">
            <div className="trend-empty-icon">📈</div>
            <p>{emptyMessage}</p>
          </div>
        ) : isBarMetric(activeMetric) ? (
          <BarChart series={series} />
        ) : (
          <LineChart series={series} metric={activeMetric} height={280} />
        )}
      </div>
    </div>
  );
}

export function TrendChartMiniGrid({
  series,
  emptyMessage,
}: {
  series: DesignerTrendSeries[];
  emptyMessage?: string | null;
}) {
  if (emptyMessage) {
    return (
      <div className="trend-empty-state compact">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="chart-mini-grid">
      {PRIMARY_TREND_CHARTS.map((chart) => (
        <div key={chart.metric} className="chart-mini-card">
          <div className="chart-mini-header">
            <span>{chart.label}</span>
            <span className="chart-mini-sub">{chart.description.split("—").pop()?.trim()}</span>
          </div>
          <LineChart
            series={series}
            metric={chart.metric}
            height={140}
            showLegend={false}
            showTooltip={false}
          />
        </div>
      ))}
    </div>
  );
}
