import type { ProductivityResult } from "../../types";
import type { LumiAnalyticsScanPayload } from "../types/designSystemRegistry";
import { aggregateByDesigner, aggregateByTeam } from "../../productivity/dashboardAggregates";
import { computeLumiAdoptionAdminMetricsFromPayloads } from "./lumiAdoptionAdminMetrics";

export type ReportPeriod = "weekly" | "monthly" | "quarterly";

export type ReportDateRange = {
  period: ReportPeriod;
  label: string;
  dateFrom: string;
  dateTo: string;
  /** Inclusive calendar bounds for display */
  displayFrom: string;
  displayTo: string;
};

export type DesignerReportRow = {
  designerName: string;
  teamName: string;
  sessions: number;
  tickets: number;
  actualHours: number;
  observedHoursSaved: number;
  lumiAttributedHoursSaved: number;
  productivityLiftPercent: number;
  lumiAdoptionRate: number;
  tokenAdoptionRate: number;
  styleAdoptionRate: number;
  qualityScore: number;
  componentsReused: number;
  scanCount: number;
  avgLegacyUsageRate: number;
  avgDetachmentRate: number;
  avgDesignDebtRate: number;
  insights: string[];
};

export type LumiReportBundle = {
  range: ReportDateRange;
  generatedAt: string;
  summary: {
    designers: number;
    sessions: number;
    scans: number;
    avgLumiAdoption: number;
    avgQuality: number;
    totalObservedHoursSaved: number;
    totalLumiAttributedHoursSaved: number;
    teamsActive: number;
  };
  designers: DesignerReportRow[];
  teams: Array<{
    teamName: string;
    designers: number;
    sessions: number;
    lumiAdoptionRate: number;
    qualityScore: number;
    observedHoursSaved: number;
  }>;
  adoptionNarrative: string[];
  adminEfficiency?: {
    lumiReuseRate: number;
    legacyUsageRate: number;
    designDebtRate: number;
    lumiEfficiencyScore: number;
    customUsageRate: number;
    detachmentRate: number;
  };
  html: string;
  text: string;
  designerCsv: string;
  adoptionCsv: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDayIso(d: Date): string {
  const e = startOfUtcDay(d);
  e.setUTCHours(23, 59, 59, 999);
  return e.toISOString();
}

function startOfUtcDayIso(d: Date): string {
  return startOfUtcDay(d).toISOString();
}

/** Previous complete ISO week (Mon–Sun UTC), previous month, or previous quarter. */
export function resolveReportRange(period: ReportPeriod, now = new Date()): ReportDateRange {
  const today = startOfUtcDay(now);

  if (period === "weekly") {
    // Monday = 1 … Sunday = 0 → days since Monday
    const dow = today.getUTCDay();
    const daysSinceMonday = dow === 0 ? 6 : dow - 1;
    const thisMonday = new Date(today);
    thisMonday.setUTCDate(today.getUTCDate() - daysSinceMonday);
    const prevMonday = new Date(thisMonday);
    prevMonday.setUTCDate(thisMonday.getUTCDate() - 7);
    const prevSunday = new Date(prevMonday);
    prevSunday.setUTCDate(prevMonday.getUTCDate() + 6);
    return {
      period,
      label: `Week of ${toIsoDate(prevMonday)}`,
      dateFrom: startOfUtcDayIso(prevMonday),
      dateTo: endOfUtcDayIso(prevSunday),
      displayFrom: toIsoDate(prevMonday),
      displayTo: toIsoDate(prevSunday),
    };
  }

  if (period === "monthly") {
    const firstThisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const lastPrev = new Date(firstThisMonth);
    lastPrev.setUTCDate(0);
    const firstPrev = new Date(Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1));
    const monthLabel = `${firstPrev.getUTCFullYear()}-${pad(firstPrev.getUTCMonth() + 1)}`;
    return {
      period,
      label: `Month ${monthLabel}`,
      dateFrom: startOfUtcDayIso(firstPrev),
      dateTo: endOfUtcDayIso(lastPrev),
      displayFrom: toIsoDate(firstPrev),
      displayTo: toIsoDate(lastPrev),
    };
  }

  const q = Math.floor(today.getUTCMonth() / 3);
  const prevQ = q === 0 ? 3 : q - 1;
  const year = q === 0 ? today.getUTCFullYear() - 1 : today.getUTCFullYear();
  const firstMonth = prevQ * 3;
  const first = new Date(Date.UTC(year, firstMonth, 1));
  const last = new Date(Date.UTC(year, firstMonth + 3, 0));
  return {
    period,
    label: `Q${prevQ + 1} ${year}`,
    dateFrom: startOfUtcDayIso(first),
    dateTo: endOfUtcDayIso(last),
    displayFrom: toIsoDate(first),
    displayTo: toIsoDate(last),
  };
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeCsv(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildDesignerInsights(
  row: Omit<DesignerReportRow, "insights">,
  period: ReportPeriod
): string[] {
  const tips: string[] = [];
  if (row.sessions === 0 && row.scanCount === 0) {
    tips.push("No finished LUMI sessions in this period — encourage plugin use on live tickets.");
    return tips;
  }
  if (row.lumiAdoptionRate >= 70) {
    tips.push(`Strong LUMI reuse (${row.lumiAdoptionRate.toFixed(0)}%) — good enablement signal.`);
  } else if (row.lumiAdoptionRate > 0 && row.lumiAdoptionRate < 50) {
    tips.push(
      `LUMI adoption at ${row.lumiAdoptionRate.toFixed(0)}% — coaching on component mapping may help.`
    );
  }
  if (row.avgDetachmentRate >= 25) {
    tips.push(
      `Detachment rate ~${row.avgDetachmentRate.toFixed(0)}% — review when instances are being unlinked.`
    );
  }
  if (row.avgDesignDebtRate >= 40) {
    tips.push(
      `Design debt signals elevated (~${row.avgDesignDebtRate.toFixed(0)}%) — prioritize LUMI replacements.`
    );
  }
  if (row.qualityScore >= 75) {
    tips.push(`Quality score solid (${row.qualityScore.toFixed(0)}).`);
  } else if (row.qualityScore > 0 && row.qualityScore < 55) {
    tips.push(`Quality score ${row.qualityScore.toFixed(0)} — styles/tokens coaching opportunity.`);
  }
  if (row.lumiAttributedHoursSaved > 0) {
    tips.push(
      `${row.lumiAttributedHoursSaved.toFixed(1)} LUMI-attributed hours saved this ${period.replace("ly", "")}.`
    );
  }
  if (tips.length === 0) {
    tips.push("Session activity recorded — continue tracking adoption trends next period.");
  }
  return tips;
}

function buildAdoptionNarrative(
  summary: LumiReportBundle["summary"],
  admin: LumiReportBundle["adminEfficiency"],
  period: ReportPeriod
): string[] {
  const lines: string[] = [];
  lines.push(
    `${summary.designers} designer(s) contributed ${summary.sessions} finished session(s) and ${summary.scans} LUMI scan(s) this ${period} period.`
  );
  if (summary.avgLumiAdoption > 0) {
    lines.push(
      `Average LUMI component adoption across designers: ${summary.avgLumiAdoption.toFixed(0)}%.`
    );
  }
  if (summary.totalObservedHoursSaved > 0) {
    lines.push(
      `Observed hours saved vs benchmarks: ${summary.totalObservedHoursSaved.toFixed(1)}h (LUMI-attributed ${summary.totalLumiAttributedHoursSaved.toFixed(1)}h).`
    );
  }
  if (admin) {
    lines.push(
      `Portfolio view — LUMI reuse ${admin.lumiReuseRate.toFixed(0)}%, legacy usage ${admin.legacyUsageRate.toFixed(0)}%, design debt ${admin.designDebtRate.toFixed(0)}%, efficiency score ${admin.lumiEfficiencyScore.toFixed(0)}.`
    );
  }
  lines.push(
    "Framed for enablement: use these trends to coach LUMI reuse, not to rank individual performance."
  );
  return lines;
}

function renderHtml(bundle: Omit<LumiReportBundle, "html" | "text" | "designerCsv" | "adoptionCsv">): string {
  const { range, summary, designers, teams, adoptionNarrative, adminEfficiency, generatedAt } =
    bundle;

  const designerRows = designers
    .map(
      (d) => `
      <tr>
        <td>${escapeHtml(d.designerName)}</td>
        <td>${escapeHtml(d.teamName)}</td>
        <td>${d.sessions}</td>
        <td>${d.actualHours.toFixed(1)}</td>
        <td>${d.lumiAdoptionRate.toFixed(0)}%</td>
        <td>${d.tokenAdoptionRate.toFixed(0)}%</td>
        <td>${d.styleAdoptionRate.toFixed(0)}%</td>
        <td>${d.qualityScore.toFixed(0)}</td>
        <td>${d.observedHoursSaved.toFixed(1)}</td>
        <td>${d.insights.map((i) => escapeHtml(i)).join("<br/>")}</td>
      </tr>`
    )
    .join("");

  const teamRows = teams
    .map(
      (t) => `
      <tr>
        <td>${escapeHtml(t.teamName)}</td>
        <td>${t.designers}</td>
        <td>${t.sessions}</td>
        <td>${t.lumiAdoptionRate.toFixed(0)}%</td>
        <td>${t.qualityScore.toFixed(0)}</td>
        <td>${t.observedHoursSaved.toFixed(1)}</td>
      </tr>`
    )
    .join("");

  const narrative = adoptionNarrative.map((l) => `<li>${escapeHtml(l)}</li>`).join("");

  const adminBlock = adminEfficiency
    ? `
    <h2>LUMI vs legacy (portfolio)</h2>
    <table>
      <tr><th>LUMI reuse</th><td>${adminEfficiency.lumiReuseRate.toFixed(0)}%</td></tr>
      <tr><th>Legacy usage</th><td>${adminEfficiency.legacyUsageRate.toFixed(0)}%</td></tr>
      <tr><th>Custom usage</th><td>${adminEfficiency.customUsageRate.toFixed(0)}%</td></tr>
      <tr><th>Detachment</th><td>${adminEfficiency.detachmentRate.toFixed(0)}%</td></tr>
      <tr><th>Design debt</th><td>${adminEfficiency.designDebtRate.toFixed(0)}%</td></tr>
      <tr><th>Efficiency score</th><td>${adminEfficiency.lumiEfficiencyScore.toFixed(0)}</td></tr>
    </table>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>LUMI ${escapeHtml(range.period)} report — ${escapeHtml(range.label)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1a1a1a; margin: 24px; line-height: 1.45; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 16px; margin: 28px 0 10px; color: #222; }
    .muted { color: #666; font-size: 13px; margin-bottom: 20px; }
    .kpis { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0 24px; }
    .kpi { background: #f4f6f8; border-radius: 8px; padding: 12px 16px; min-width: 120px; }
    .kpi b { display: block; font-size: 20px; }
    .kpi span { font-size: 12px; color: #555; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; margin-bottom: 8px; }
    th, td { border: 1px solid #e2e5e9; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #eef1f4; }
    ul { padding-left: 18px; }
    .note { margin-top: 28px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 12px; }
  </style>
</head>
<body>
  <h1>LUMI designer performance &amp; adoption</h1>
  <p class="muted">${escapeHtml(range.label)} · ${escapeHtml(range.displayFrom)} → ${escapeHtml(range.displayTo)} · Generated ${escapeHtml(generatedAt)}</p>

  <div class="kpis">
    <div class="kpi"><b>${summary.designers}</b><span>Designers</span></div>
    <div class="kpi"><b>${summary.sessions}</b><span>Sessions</span></div>
    <div class="kpi"><b>${summary.scans}</b><span>Scans</span></div>
    <div class="kpi"><b>${summary.avgLumiAdoption.toFixed(0)}%</b><span>Avg LUMI adoption</span></div>
    <div class="kpi"><b>${summary.avgQuality.toFixed(0)}</b><span>Avg quality</span></div>
    <div class="kpi"><b>${summary.totalObservedHoursSaved.toFixed(1)}h</b><span>Hours saved</span></div>
  </div>

  <h2>How LUMI adoption is going</h2>
  <ul>${narrative}</ul>

  <h2>Per-designer detail</h2>
  <table>
    <thead>
      <tr>
        <th>Designer</th><th>Team</th><th>Sessions</th><th>Actual hours</th>
        <th>LUMI %</th><th>Token %</th><th>Style %</th><th>Quality</th>
        <th>Hours saved</th><th>Insights</th>
      </tr>
    </thead>
    <tbody>${designerRows || `<tr><td colspan="10">No designer activity in this period.</td></tr>`}</tbody>
  </table>

  <h2>By team</h2>
  <table>
    <thead>
      <tr><th>Team</th><th>Designers</th><th>Sessions</th><th>LUMI %</th><th>Quality</th><th>Hours saved</th></tr>
    </thead>
    <tbody>${teamRows || `<tr><td colspan="6">No team activity in this period.</td></tr>`}</tbody>
  </table>

  ${adminBlock}

  <p class="note">LUMI Analytics auto-report · Enablement insights for design leadership · Not a performance ranking.</p>
</body>
</html>`;
}

function renderText(bundle: Omit<LumiReportBundle, "html" | "text" | "designerCsv" | "adoptionCsv">): string {
  const lines = [
    `LUMI ${bundle.range.period} report — ${bundle.range.label}`,
    `${bundle.range.displayFrom} → ${bundle.range.displayTo}`,
    "",
    ...bundle.adoptionNarrative,
    "",
    "Per designer:",
  ];
  for (const d of bundle.designers) {
    lines.push(
      `- ${d.designerName} (${d.teamName}): ${d.sessions} sessions, LUMI ${d.lumiAdoptionRate.toFixed(0)}%, quality ${d.qualityScore.toFixed(0)}, saved ${d.observedHoursSaved.toFixed(1)}h`
    );
    for (const tip of d.insights) lines.push(`    · ${tip}`);
  }
  return lines.join("\n");
}

function renderDesignerCsv(designers: DesignerReportRow[]): string {
  const headers = [
    "designer_name",
    "team",
    "sessions",
    "tickets",
    "actual_hours",
    "observed_hours_saved",
    "lumi_attributed_hours_saved",
    "productivity_lift_percent",
    "lumi_adoption_rate",
    "token_adoption_rate",
    "style_adoption_rate",
    "quality_score",
    "components_reused",
    "scan_count",
    "avg_legacy_usage_rate",
    "avg_detachment_rate",
    "avg_design_debt_rate",
    "insights",
  ];
  const rows = designers.map((d) =>
    [
      d.designerName,
      d.teamName,
      d.sessions,
      d.tickets,
      d.actualHours.toFixed(2),
      d.observedHoursSaved.toFixed(2),
      d.lumiAttributedHoursSaved.toFixed(2),
      d.productivityLiftPercent.toFixed(1),
      d.lumiAdoptionRate.toFixed(1),
      d.tokenAdoptionRate.toFixed(1),
      d.styleAdoptionRate.toFixed(1),
      d.qualityScore.toFixed(1),
      d.componentsReused,
      d.scanCount,
      d.avgLegacyUsageRate.toFixed(1),
      d.avgDetachmentRate.toFixed(1),
      d.avgDesignDebtRate.toFixed(1),
      d.insights.join(" | "),
    ]
      .map(escapeCsv)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function renderAdoptionCsv(
  payloads: LumiAnalyticsScanPayload[],
  range: ReportDateRange
): string {
  const headers = [
    "scan_id",
    "scanned_at",
    "designer_name",
    "team",
    "flow",
    "jira_issue",
    "lumi_adoption_rate",
    "legacy_usage_rate",
    "token_adoption_rate",
    "style_adoption_rate",
    "detachment_rate",
    "design_debt_rate",
    "quality_score",
    "lumi_instances",
    "total_instances",
  ];
  const rows = payloads.map((p) =>
    [
      p.scanId,
      p.scannedAt,
      p.designerName ?? "",
      p.teamName ?? "",
      p.flowName ?? "",
      p.jiraIssueKey ?? "",
      p.rates.lumiAdoptionRate.toFixed(1),
      p.rates.legacyUsageRate.toFixed(1),
      p.rates.tokenAdoptionRate.toFixed(1),
      p.rates.styleAdoptionRate.toFixed(1),
      p.rates.detachmentRate.toFixed(1),
      p.rates.designDebtRate.toFixed(1),
      p.rates.qualityScore.toFixed(1),
      p.counts.lumiInstances,
      p.counts.totalComponentInstances,
    ]
      .map(escapeCsv)
      .join(",")
  );
  return [`# period=${range.period} ${range.displayFrom}_${range.displayTo}`, headers.join(","), ...rows].join(
    "\n"
  );
}

export function buildLumiReport(input: {
  period: ReportPeriod;
  results: ProductivityResult[];
  scanPayloads: LumiAnalyticsScanPayload[];
  now?: Date;
}): LumiReportBundle {
  const range = resolveReportRange(input.period, input.now ?? new Date());
  const results = input.results.filter(
    (r) => r.createdAt >= range.dateFrom && r.createdAt <= range.dateTo
  );
  const payloads = input.scanPayloads.filter(
    (p) => p.scannedAt >= range.dateFrom && p.scannedAt <= range.dateTo
  );

  const byDesigner = aggregateByDesigner(results);
  const byTeam = aggregateByTeam(results);

  const scansByDesigner = new Map<string, LumiAnalyticsScanPayload[]>();
  for (const p of payloads) {
    const key = (p.designerName ?? "Unknown").trim() || "Unknown";
    const list = scansByDesigner.get(key) ?? [];
    list.push(p);
    scansByDesigner.set(key, list);
  }

  const designerNames = new Set<string>([
    ...byDesigner.map((d) => d.designerName),
    ...scansByDesigner.keys(),
  ]);

  const designers: DesignerReportRow[] = [...designerNames]
    .map((name) => {
      const agg = byDesigner.find((d) => d.designerName === name);
      const scans = scansByDesigner.get(name) ?? [];
      const base = {
        designerName: name,
        teamName: agg?.teamName ?? scans[0]?.teamName ?? "Unassigned",
        sessions: agg?.sessions ?? 0,
        tickets: agg?.tickets ?? 0,
        actualHours: agg?.actualHours ?? 0,
        observedHoursSaved: agg?.observedHoursSaved ?? 0,
        lumiAttributedHoursSaved: agg?.lumiAttributedHoursSaved ?? 0,
        productivityLiftPercent: agg?.productivityLiftPercent ?? 0,
        lumiAdoptionRate:
          agg?.lumiAdoptionRate ?? avg(scans.map((s) => s.rates.lumiAdoptionRate)),
        tokenAdoptionRate:
          agg?.tokenAdoptionRate ?? avg(scans.map((s) => s.rates.tokenAdoptionRate)),
        styleAdoptionRate:
          agg?.styleAdoptionRate ?? avg(scans.map((s) => s.rates.styleAdoptionRate)),
        qualityScore: agg?.qualityScore ?? avg(scans.map((s) => s.rates.qualityScore)),
        componentsReused: agg?.componentsReused ?? 0,
        scanCount: scans.length,
        avgLegacyUsageRate: avg(scans.map((s) => s.rates.legacyUsageRate)),
        avgDetachmentRate: avg(scans.map((s) => s.rates.detachmentRate)),
        avgDesignDebtRate: avg(scans.map((s) => s.rates.designDebtRate)),
      };
      return { ...base, insights: buildDesignerInsights(base, input.period) };
    })
    .sort((a, b) => b.sessions - a.sessions || a.designerName.localeCompare(b.designerName));

  const teams = byTeam.map((t) => ({
    teamName: t.teamName,
    designers: t.designers,
    sessions: t.sessions,
    lumiAdoptionRate: t.lumiAdoptionRate,
    qualityScore: t.qualityScore,
    observedHoursSaved: t.observedHoursSaved,
  }));

  // Scan-only teams not in productivity aggregates
  for (const p of payloads) {
    const team = p.teamName ?? "Unassigned";
    if (!teams.some((t) => t.teamName === team)) {
      const teamScans = payloads.filter((x) => (x.teamName ?? "Unassigned") === team);
      teams.push({
        teamName: team,
        designers: new Set(teamScans.map((x) => x.designerName ?? "Unknown")).size,
        sessions: 0,
        lumiAdoptionRate: avg(teamScans.map((x) => x.rates.lumiAdoptionRate)),
        qualityScore: avg(teamScans.map((x) => x.rates.qualityScore)),
        observedHoursSaved: 0,
      });
    }
  }

  let adminEfficiency: LumiReportBundle["adminEfficiency"];
  if (payloads.length > 0) {
    const metrics = computeLumiAdoptionAdminMetricsFromPayloads(payloads);
    const current = metrics.comparison?.current;
    adminEfficiency = {
      lumiReuseRate: current?.lumiReuseRate ?? metrics.rates.lumiReuseRate,
      legacyUsageRate: metrics.rates.legacyUsageRate,
      designDebtRate: metrics.rates.designDebtRate,
      lumiEfficiencyScore: metrics.rates.lumiEfficiencyScore,
      customUsageRate: current?.customUsageRate ?? metrics.rates.customUsageRate,
      detachmentRate: current?.detachmentRate ?? metrics.rates.detachmentRate,
    };
  }

  const summary = {
    designers: designers.length,
    sessions: results.length,
    scans: payloads.length,
    avgLumiAdoption: avg(designers.map((d) => d.lumiAdoptionRate)),
    avgQuality: avg(designers.map((d) => d.qualityScore)),
    totalObservedHoursSaved: designers.reduce((s, d) => s + d.observedHoursSaved, 0),
    totalLumiAttributedHoursSaved: designers.reduce((s, d) => s + d.lumiAttributedHoursSaved, 0),
    teamsActive: teams.length,
  };

  const generatedAt = new Date().toISOString();
  const adoptionNarrative = buildAdoptionNarrative(summary, adminEfficiency, input.period);
  const partial = {
    range,
    generatedAt,
    summary,
    designers,
    teams,
    adoptionNarrative,
    adminEfficiency,
  };

  return {
    ...partial,
    html: renderHtml(partial),
    text: renderText(partial),
    designerCsv: renderDesignerCsv(designers),
    adoptionCsv: renderAdoptionCsv(payloads, range),
  };
}

export function reportSubject(bundle: LumiReportBundle): string {
  const periodLabel =
    bundle.range.period === "weekly"
      ? "Weekly"
      : bundle.range.period === "monthly"
        ? "Monthly"
        : "Quarterly";
  return `[LUMI] ${periodLabel} designer performance & adoption — ${bundle.range.label}`;
}
