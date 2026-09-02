import type {
  DesignerProfile,
  MonthlyAggregate,
  PluginSettings,
  ProductivityBenchmark,
  ProductivityResult,
  WorkSession,
} from "../types";
import { getBundledJiraCache } from "../integrations/jira/jiraCacheLoader";
import { aggregateByDesigner, aggregateByMonth } from "./dashboardAggregates";
import { buildDesignerWorkloadSummaries } from "./designerWorkloadSummary";
import { exportLumiEfficiencyCsv } from "../backend/services/lumiAdoptionAdminMetrics";
import type { LumiScanSnapshot } from "../types";

function escapeCsv(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: (string | number | undefined | null)[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(","));
  }
  return lines.join("\n");
}

export function exportDesignerProductivityCsv(
  results: ProductivityResult[],
  includeEmails: boolean,
  profiles: DesignerProfile[]
): string {
  const aggregates = aggregateByDesigner(results);
  const emailMap = new Map(profiles.map((p) => [p.userId, p.email]));

  return toCsv(
    [
      "designer_name",
      ...(includeEmails ? ["email"] : []),
      "team",
      "sessions",
      "tickets",
      "actual_hours",
      "benchmark_hours",
      "observed_hours_saved",
      "lumi_attributed_hours_saved",
      "productivity_lift_percent",
      "lumi_adoption_rate",
      "components_reused",
      "components_reused_per_hour",
      "token_adoption_rate",
      "style_adoption_rate",
      "quality_score",
      "confidence",
    ],
    aggregates.map((d) => {
      const row: (string | number | undefined)[] = [
        d.designerName,
        ...(includeEmails ? [emailMap.get(d.designerUserId)] : []),
        d.teamName,
        d.sessions,
        d.tickets,
        d.actualHours.toFixed(2),
        d.benchmarkHours.toFixed(2),
        d.observedHoursSaved.toFixed(2),
        d.lumiAttributedHoursSaved.toFixed(2),
        d.productivityLiftPercent.toFixed(1),
        d.lumiAdoptionRate.toFixed(1),
        d.componentsReused,
        d.componentsReusedPerHour.toFixed(1),
        d.tokenAdoptionRate.toFixed(1),
        d.styleAdoptionRate.toFixed(1),
        d.qualityScore.toFixed(1),
        d.confidence,
      ];
      return row;
    })
  );
}

export function exportWorkSessionsCsv(
  sessions: WorkSession[],
  results: ProductivityResult[],
  includeEmails: boolean
): string {
  const resultMap = new Map(results.map((r) => [r.sessionId, r]));

  return toCsv(
    [
      "session_id",
      "designer_name",
      ...(includeEmails ? ["designer_email"] : []),
      "project",
      "ticket_id",
      "ticket_url",
      "jira_assignee",
      "jira_status",
      "jira_components",
      "figma_page",
      "figma_selection",
      "flow",
      "work_type",
      "complexity",
      "started_at",
      "finished_at",
      "actual_minutes",
      "benchmark_minutes",
      "observed_minutes_saved",
      "lumi_attributed_hours_saved",
      "lumi_adoption_rate",
      "lumi_instances",
      "token_adoption_rate",
      "style_adoption_rate",
      "quality_score",
      "confidence",
    ],
    sessions
      .filter((s) => s.status === "finished")
      .map((s) => {
        const r = resultMap.get(s.id);
        return [
          s.id,
          s.designerName,
          ...(includeEmails ? [s.designerEmail] : []),
          s.projectName,
          s.jiraTicketId,
          s.jiraTicketUrl,
          s.jiraAssigneeName,
          s.jiraStatus,
          (s.jiraComponents ?? []).join("; "),
          s.pageName,
          s.selectedNodeName,
          s.flowName,
          s.workType,
          s.complexity,
          s.startedAt,
          s.finishedAt,
          s.adjustedActualMinutes,
          r?.benchmarkMinutes,
          r?.observedMinutesSaved,
          r?.lumiAttributedHoursSaved?.toFixed(2),
          r?.lumiAdoptionRate?.toFixed(1),
          r?.lumiComponentInstances,
          r?.tokenAdoptionRate?.toFixed(1),
          r?.styleAdoptionRate?.toFixed(1),
          r?.qualityScore?.toFixed(1),
          r?.confidence.label,
        ];
      })
  );
}

export function exportMonthlySummaryCsv(results: ProductivityResult[]): string {
  const months = aggregateByMonth(results);
  return toCsv(
    [
      "month",
      "designers",
      "sessions",
      "tickets",
      "actual_hours",
      "benchmark_hours",
      "observed_hours_saved",
      "lumi_attributed_hours_saved",
      "average_lumi_adoption",
      "component_reuse",
      "token_adoption",
      "quality_score",
    ],
    months.map((m: MonthlyAggregate) => [
      m.month,
      m.designers,
      m.sessions,
      m.tickets,
      m.actualHours.toFixed(1),
      m.benchmarkHours.toFixed(1),
      m.observedHoursSaved.toFixed(1),
      m.lumiAttributedHoursSaved.toFixed(1),
      m.averageLumiAdoption.toFixed(1),
      m.componentReuse,
      m.tokenAdoption.toFixed(1),
      m.qualityScore.toFixed(1),
    ])
  );
}

export function exportBenchmarksCsv(benchmarks: ProductivityBenchmark[]): string {
  return toCsv(
    [
      "project",
      "flow",
      "work_type",
      "complexity",
      "platform",
      "benchmark_level",
      "sample_size",
      "median_minutes",
      "average_minutes",
      "confidence",
      "source",
    ],
    benchmarks.map((b) => [
      b.key.projectName,
      b.key.flowName,
      b.key.workType,
      b.key.complexity,
      b.key.platform,
      b.benchmarkLevel,
      b.sampleSize,
      b.medianMinutes,
      b.averageMinutes,
      b.confidence,
      b.source,
    ])
  );
}

export function exportFullJson(
  data: {
    sessions: WorkSession[];
    scans: unknown[];
    productivityResults: ProductivityResult[];
    benchmarks: ProductivityBenchmark[];
    settings: PluginSettings;
  },
  includeEmails: boolean
): string {
  const sanitized = {
    ...data,
    sessions: data.sessions.map((s) => ({
      ...s,
      designerEmail: includeEmails ? s.designerEmail : undefined,
    })),
    assumptions: {
      lumiLeverageFormula:
        "0.45*lumiAdoption + 0.2*tokenAdoption + 0.15*styleAdoption + 0.2*qualityScore",
      designSystemLeverageFormula:
        "0.35*lumi + 0.20*token + 0.15*style + 0.15*lowDetachment + 0.15*quality",
      hoursSavedRequiresBenchmark: true,
    },
    privacy: {
      includeEmails,
      trackingMode: "opt-in-sessions-only",
    },
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(sanitized, null, 2);
}

export function exportJiraTicketProductivityCsv(
  sessions: WorkSession[],
  results: ProductivityResult[],
  includeEmails: boolean
): string {
  const resultMap = new Map(results.map((r) => [r.sessionId, r]));

  return toCsv(
    [
      "jira_issue_key",
      "jira_summary",
      "jira_status",
      "jira_assignee",
      "jira_components",
      "figma_file",
      "figma_page",
      "figma_node",
      "designer_session_owner",
      ...(includeEmails ? ["designer_email"] : []),
      "actual_hours",
      "benchmark_hours",
      "observed_hours_saved",
      "lumi_attributed_hours_saved",
      "productivity_lift_percent",
      "lumi_adoption_rate",
      "components_reused",
      "token_adoption_rate",
      "style_adoption_rate",
      "quality_score",
      "confidence",
    ],
    sessions
      .filter((s) => s.status === "finished")
      .filter((s) => s.jiraIssueKey || s.jiraTicketId)
      .map((s) => {
        const r = resultMap.get(s.id);
        const actualHours = (s.adjustedActualMinutes ?? 0) / 60;
        const benchmarkHours = (r?.benchmarkMinutes ?? 0) / 60;
        const observedHoursSaved = (r?.observedMinutesSaved ?? 0) / 60;
        return [
          s.jiraIssueKey ?? s.jiraTicketId,
          s.jiraSummary ?? s.ticketTitle,
          s.jiraStatus,
          s.jiraAssigneeName,
          (s.jiraComponents ?? []).join("; "),
          s.fileName,
          s.pageName,
          s.selectedNodeName,
          s.designerName,
          ...(includeEmails ? [s.designerEmail] : []),
          actualHours.toFixed(2),
          benchmarkHours.toFixed(2),
          observedHoursSaved.toFixed(2),
          r?.lumiAttributedHoursSaved?.toFixed(2),
          r?.productivityLiftPercent?.toFixed(1),
          r?.lumiAdoptionRate?.toFixed(1),
          r?.lumiComponentInstances,
          r?.tokenAdoptionRate?.toFixed(1),
          r?.styleAdoptionRate?.toFixed(1),
          r?.qualityScore?.toFixed(1),
          r?.confidence.label,
        ];
      })
  );
}

export function exportDesignerWorkloadSummaryCsv(
  sessions: WorkSession[],
  results: ProductivityResult[]
): string {
  const cache = getBundledJiraCache();
  const summaries = buildDesignerWorkloadSummaries({
    issues: cache.issues,
    sessions,
    results,
  });

  return toCsv(
    [
      "designer",
      "active_tickets",
      "done_tickets",
      "blocked_tickets",
      "sessions",
      "observed_hours_saved",
      "lumi_attributed_hours_saved",
      "lumi_adoption_rate",
      "quality_score",
    ],
    summaries.map((row) => [
      row.designerName,
      row.activeTickets,
      row.doneTickets,
      row.blockedTickets,
      row.sessions,
      row.observedHoursSaved?.toFixed(2),
      row.lumiAttributedHoursSaved?.toFixed(2),
      row.lumiAdoptionRate?.toFixed(1),
      row.qualityScore?.toFixed(1),
    ])
  );
}

export function exportDesignerTicketDetailCsv(
  sessions: WorkSession[],
  results: ProductivityResult[]
): string {
  const cache = getBundledJiraCache();
  const summaries = buildDesignerWorkloadSummaries({
    issues: cache.issues,
    sessions,
    results,
  });

  const rows: (string | number | undefined)[][] = [];
  for (const designer of summaries) {
    for (const ticket of designer.tickets) {
      rows.push([
        designer.designerName,
        ticket.key,
        ticket.summary,
        ticket.status,
        ticket.components.join("; "),
        ticket.labels.join("; "),
        ticket.sessions,
        ticket.observedHoursSaved?.toFixed(2),
        ticket.lumiAdoptionRate?.toFixed(1),
        ticket.qualityScore?.toFixed(1),
      ]);
    }
  }

  return toCsv(
    [
      "designer",
      "ticket_key",
      "ticket_summary",
      "ticket_status",
      "components",
      "labels",
      "sessions",
      "observed_hours_saved",
      "lumi_adoption_rate",
      "quality_score",
    ],
    rows
  );
}

export type ExportType =
  | "designer-productivity"
  | "work-sessions"
  | "jira-ticket-productivity"
  | "designer-workload-summary"
  | "designer-ticket-detail"
  | "monthly-summary"
  | "benchmarks"
  | "lumi-efficiency-vs-legacy"
  | "full-json";

export function generateExport(
  type: ExportType,
  data: {
    sessions: WorkSession[];
    scans: unknown[];
    results: ProductivityResult[];
    benchmarks: ProductivityBenchmark[];
    settings: PluginSettings;
    profile: DesignerProfile | null;
    dsRegistrySyncedAt?: string | null;
  },
  includeEmails: boolean
): { filename: string; content: string; mimeType: string } {
  switch (type) {
    case "designer-productivity":
      return {
        filename: "lumi-designer-productivity.csv",
        content: exportDesignerProductivityCsv(
          data.results,
          includeEmails,
          data.profile ? [data.profile] : []
        ),
        mimeType: "text/csv",
      };
    case "work-sessions":
      return {
        filename: "lumi-work-sessions.csv",
        content: exportWorkSessionsCsv(data.sessions, data.results, includeEmails),
        mimeType: "text/csv",
      };
    case "jira-ticket-productivity":
      return {
        filename: "jira-ticket-productivity.csv",
        content: exportJiraTicketProductivityCsv(data.sessions, data.results, includeEmails),
        mimeType: "text/csv",
      };
    case "designer-workload-summary":
      return {
        filename: "designer-workload-summary.csv",
        content: exportDesignerWorkloadSummaryCsv(data.sessions, data.results),
        mimeType: "text/csv",
      };
    case "designer-ticket-detail":
      return {
        filename: "designer-ticket-detail.csv",
        content: exportDesignerTicketDetailCsv(data.sessions, data.results),
        mimeType: "text/csv",
      };
    case "monthly-summary":
      return {
        filename: "lumi-monthly-summary.csv",
        content: exportMonthlySummaryCsv(data.results),
        mimeType: "text/csv",
      };
    case "benchmarks":
      return {
        filename: "lumi-benchmarks.csv",
        content: exportBenchmarksCsv(data.benchmarks),
        mimeType: "text/csv",
      };
    case "lumi-efficiency-vs-legacy":
      return {
        filename: "lumi-efficiency-vs-legacy.csv",
        content: exportLumiEfficiencyCsv(
          data.scans as LumiScanSnapshot[],
          data.dsRegistrySyncedAt ?? null
        ),
        mimeType: "text/csv",
      };
    case "full-json":
      return {
        filename: "lumi-analytics-export.json",
        content: exportFullJson(
          {
            sessions: data.sessions,
            scans: data.scans,
            productivityResults: data.results,
            benchmarks: data.benchmarks,
            settings: data.settings,
          },
          includeEmails
        ),
        mimeType: "application/json",
      };
    default:
      throw new Error(`Unknown export type: ${type}`);
  }
}
