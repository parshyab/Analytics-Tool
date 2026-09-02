import type { TrendMetric } from "../../types";
import { getMetricLabel } from "./chartUtils";

const METRICS: TrendMetric[] = [
  "observedHoursSaved",
  "lumiAttributedHoursSaved",
  "productivityLiftPercent",
  "actualHours",
  "benchmarkHours",
  "lumiAdoptionRate",
  "componentReuse",
  "qualityScore",
];

type MetricToggleProps = {
  value: TrendMetric;
  onChange: (metric: TrendMetric) => void;
};

export function MetricToggle({ value, onChange }: MetricToggleProps) {
  return (
    <select
      className="filter-select"
      value={value}
      onChange={(e) => onChange(e.target.value as TrendMetric)}
      aria-label="Metric"
    >
      {METRICS.map((m) => (
        <option key={m} value={m}>
          {getMetricLabel(m)}
        </option>
      ))}
    </select>
  );
}
