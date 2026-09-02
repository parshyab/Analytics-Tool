import type { DesignerTimeSeriesPoint, DesignerTrendSeries } from "../types";
import { flattenSeriesToRows } from "./productivityTrendAggregator";

function escapeCsv(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportTrendCsv(series: DesignerTrendSeries[]): {
  filename: string;
  content: string;
  mimeType: string;
} {
  const rows = flattenSeriesToRows(series);
  const header = [
    "date",
    "period",
    "designer_name",
    "team",
    "sessions",
    "tickets",
    "actual_hours",
    "benchmark_hours",
    "observed_hours_saved",
    "lumi_attributed_hours_saved",
    "productivity_lift_percent",
    "lumi_adoption_rate",
    "component_reuse",
    "token_adoption_rate",
    "style_adoption_rate",
    "quality_score",
    "confidence",
  ].join(",");

  const lines = rows.map((p: DesignerTimeSeriesPoint) =>
    [
      p.date,
      p.periodKey,
      escapeCsv(p.designerName),
      escapeCsv(p.teamName ?? ""),
      p.sessions,
      p.tickets,
      (p.actualMinutes / 60).toFixed(2),
      (p.benchmarkMinutes / 60).toFixed(2),
      p.observedHoursSaved.toFixed(2),
      p.lumiAttributedHoursSaved.toFixed(2),
      p.productivityLiftPercent !== null ? p.productivityLiftPercent.toFixed(1) : "",
      p.lumiAdoptionRate.toFixed(1),
      p.componentReuse,
      p.tokenAdoptionRate.toFixed(1),
      p.styleAdoptionRate.toFixed(1),
      p.qualityScore.toFixed(1),
      p.confidenceLabel,
    ].join(",")
  );

  const month = new Date().toISOString().slice(0, 7);
  return {
    filename: `lumi-trend-export-${month}.csv`,
    content: [header, ...lines].join("\n"),
    mimeType: "text/csv",
  };
}
