import type { DesignerTimeSeriesPoint, DesignerTrendSeries, TrendMetric } from "../../types";
import { getMetricLabel, getMetricValue, getSeriesColor } from "../../productivity/productivityTrendAggregator";

export function formatMetricValue(metric: TrendMetric, value: number): string {
  if (
    metric === "productivityLiftPercent" ||
    metric === "lumiAdoptionRate" ||
    metric === "tokenAdoptionRate"
  ) {
    return `${value.toFixed(1)}%`;
  }
  if (
    metric === "observedHoursSaved" ||
    metric === "lumiAttributedHoursSaved" ||
    metric === "actualHours" ||
    metric === "benchmarkHours"
  ) {
    return `${value.toFixed(1)}h`;
  }
  if (metric === "qualityScore" || metric === "lumiLeverageScore") return value.toFixed(0);
  if (metric === "componentsReusedPerHour") return value.toFixed(1);
  return String(Math.round(value));
}

export function isPercentMetric(metric: TrendMetric): boolean {
  return (
    metric === "productivityLiftPercent" ||
    metric === "lumiAdoptionRate" ||
    metric === "tokenAdoptionRate"
  );
}

export function isBarMetric(metric: TrendMetric): boolean {
  return metric === "actualHours" || metric === "benchmarkHours";
}

export function getAllPeriods(series: DesignerTrendSeries[]): string[] {
  const set = new Set<string>();
  for (const s of series) {
    for (const p of s.points) set.add(p.periodKey);
  }
  return [...set].sort();
}

export { getMetricLabel, getMetricValue, getSeriesColor };

export function buildTooltipLines(point: DesignerTimeSeriesPoint): string[] {
  return [
    point.designerName,
    `${point.periodKey}`,
    `Actual time: ${(point.actualMinutes / 60).toFixed(1)}h`,
    `Benchmark time: ${(point.benchmarkMinutes / 60).toFixed(1)}h`,
    `Observed saved: ${point.observedHoursSaved.toFixed(1)}h`,
    `LUMI-attributed saved: ${point.lumiAttributedHoursSaved.toFixed(1)}h`,
    `Productivity lift: ${point.productivityLiftPercent !== null ? `${point.productivityLiftPercent.toFixed(0)}%` : "—"}`,
    `LUMI adoption: ${point.lumiAdoptionRate.toFixed(0)}%`,
    `Token adoption: ${point.tokenAdoptionRate.toFixed(0)}%`,
    `Components reused: ${point.componentReuse}`,
    `Components/hr: ${point.componentsReusedPerHour.toFixed(1)}`,
    `LUMI leverage: ${point.lumiLeverageScore.toFixed(0)}`,
    `Quality score: ${point.qualityScore.toFixed(0)}`,
    `Confidence: ${point.confidenceLabel}`,
    ...(point.isLive ? ["Live session in progress"] : []),
  ];
}
