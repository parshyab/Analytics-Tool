import type {
  DesignerTrendSeries,
  LumiScanSnapshot,
  ProductivityResult,
  TrendCardSummary,
  TrendMetric,
} from "../../../types";
import { getMetricValue } from "../../charts/chartUtils";
import { sparkTrend } from "../../charts/Sparkline";

export function seriesValues(series: DesignerTrendSeries[], metric: TrendMetric): number[] {
  const byPeriod = new Map<string, number>();
  for (const s of series) {
    for (const p of s.points) {
      byPeriod.set(p.periodKey, (byPeriod.get(p.periodKey) ?? 0) + getMetricValue(p, metric));
    }
  }
  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

export function calcLiftPercent(cards: TrendCardSummary): number {
  if (!cards.hasBenchmark || cards.benchmarkHours <= 0) return 0;
  return Math.max(0, ((cards.benchmarkHours - cards.actualHours) / cards.benchmarkHours) * 100);
}

export function getBenchmarkCoverage(results: ProductivityResult[]): {
  percent: number;
  withBenchmark: number;
  total: number;
} {
  const total = results.length;
  const withBenchmark = results.filter((r) => (r.benchmarkMinutes ?? 0) > 0).length;
  return {
    total,
    withBenchmark,
    percent: total > 0 ? (withBenchmark / total) * 100 : 0,
  };
}

export type DataConfidence = "high" | "medium" | "directional" | "needs-review";

export function getDashboardConfidence(
  cards: TrendCardSummary,
  results: ProductivityResult[]
): DataConfidence {
  if (cards.actualHours < 1 && cards.benchmarkHours > 8) return "needs-review";
  if (cards.sessions < 3) return "directional";
  const labels = results.map((r) => r.confidence.label);
  if (labels.includes("high")) return "high";
  if (labels.includes("medium")) return "medium";
  if (labels.includes("directional")) return "directional";
  return "needs-review";
}

export function getDataQualityWarnings(cards: TrendCardSummary): string[] {
  const warnings: string[] = [];

  if (cards.actualHours < 1 && cards.benchmarkHours > 8) {
    warnings.push(
      "Data check: session duration is very short compared with the benchmark. Confirm actual work minutes for accurate productivity reporting."
    );
  }

  if (cards.actualHours < 1 && cards.averageComponentsPerHour > 200) {
    warnings.push(
      "Data check: component reuse per hour looks unusually high for the recorded session time. Verify session duration."
    );
  }

  if (cards.hasBenchmark && cards.observedHoursSaved > 0 && cards.actualHours < 0.5) {
    warnings.push(
      "Hours saved is high relative to actual work time. Validate benchmark selection and session metadata."
    );
  }

  return warnings;
}

export function getExecutiveInsights(
  cards: TrendCardSummary,
  results: ProductivityResult[]
): string[] {
  const insights: string[] = [];
  const coverage = getBenchmarkCoverage(results);

  if (cards.averageLumiAdoption >= 80 && cards.qualityScore < 40) {
    insights.push(
      "LUMI adoption is strong, but quality score is low. Review detachments, custom styles, or override issues."
    );
  }

  if (cards.observedHoursSaved > 0 && coverage.percent < 70) {
    insights.push(
      "Hours saved is visible, but benchmark coverage should be validated before sharing broadly."
    );
  }

  if (cards.averageComponentsPerHour > 150 && cards.actualHours < 1) {
    insights.push(
      "Component reuse per hour is elevated. Confirm session duration to ensure productivity metrics reflect real work."
    );
  }

  if (cards.sessions < 3) {
    insights.push("Early data — trends will stabilize after more finished sessions.");
  }

  if (cards.hasBenchmark && calcLiftPercent(cards) >= 50) {
    insights.push(
      "Productivity lift is material this period. Use designer enablement insights for coaching, not ranking."
    );
  }

  if (insights.length === 0 && cards.sessions > 0) {
    insights.push(
      "Continue finishing sessions with LUMI scans to strengthen adoption, quality, and trend confidence."
    );
  }

  return insights.slice(0, 4);
}

export function trendFromValues(values: number[]) {
  const t = sparkTrend(values);
  if (!t) return undefined;
  return {
    value: `${t.delta.toFixed(0)}%`,
    direction: t.positive ? ("up" as const) : ("down" as const),
    tone: t.positive ? ("positive" as const) : ("negative" as const),
  };
}

export function chartEmptyMessage(
  series: DesignerTrendSeries[],
  minPoints = 2
): string | null {
  const periods = new Set<string>();
  for (const s of series) {
    for (const p of s.points) periods.add(p.periodKey);
  }
  if (periods.size === 0) {
    return "Not enough trend data yet. Finish more sessions to see productivity over time.";
  }
  if (periods.size === 1) {
    return "Only one data point available. Trend will appear after more sessions.";
  }
  const totalPoints = series.reduce((n, s) => n + s.points.length, 0);
  if (totalPoints < minPoints) {
    return "Not enough trend data yet. Finish more sessions to see productivity over time.";
  }
  return null;
}

export function aggregateTopComponents(scans: LumiScanSnapshot[]): { name: string; instances: number }[] {
  const map = new Map<string, number>();
  for (const scan of scans) {
    for (const c of scan.lumiComponentUsage) {
      map.set(c.componentName, (map.get(c.componentName) ?? 0) + c.instances);
    }
  }
  return [...map.entries()]
    .map(([name, instances]) => ({ name, instances }))
    .sort((a, b) => b.instances - a.instances)
    .slice(0, 8);
}

export function aggregateQualityIssues(
  scans: LumiScanSnapshot[]
): { type: string; count: number; severity: string; message: string }[] {
  const map = new Map<string, { count: number; severity: string; message: string }>();
  for (const scan of scans) {
    for (const q of scan.qualitySignals) {
      const existing = map.get(q.type);
      if (existing) {
        existing.count += q.count;
      } else {
        map.set(q.type, { count: q.count, severity: q.severity, message: q.message });
      }
    }
  }
  return [...map.entries()]
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}
