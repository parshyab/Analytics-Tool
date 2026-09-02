import type { JiraIssue } from "../integrations/jira/types";
import type { ProductivityResult, WorkSession } from "../types";

export type DesignerWorkloadTicket = {
  key: string;
  summary: string;
  status: string;
  statusCategory?: string;
  components: string[];
  labels: string[];
  updatedAt?: string;
  priority?: string;
  url: string;
  assigneeName?: string;

  sessions: number;
  observedHoursSaved?: number;
  lumiAttributedHoursSaved?: number;
  lumiAdoptionRate?: number;
  qualityScore?: number;
  linkedSessions: WorkSession[];
};

export type DesignerWorkloadSummary = {
  designerName: string;
  assigneeAccountId?: string;
  assigneeEmail?: string;

  activeTickets: number;
  doneTickets: number;
  blockedTickets: number;
  totalTickets: number;

  sessions: number;
  observedHoursSaved?: number;
  lumiAttributedHoursSaved?: number;
  lumiAdoptionRate?: number;
  qualityScore?: number;

  trend?: "up" | "down" | "flat" | "none";

  tickets: DesignerWorkloadTicket[];
};

function ticketKey(session: WorkSession): string | undefined {
  return (session.jiraIssueKey ?? session.jiraTicketId)?.toUpperCase();
}

function isDone(issue: JiraIssue): boolean {
  if (issue.statusCategory === "Done") return true;
  return ["done", "closed", "resolved", "cancelled"].includes(issue.status.toLowerCase());
}

function isBlocked(issue: JiraIssue): boolean {
  return (
    issue.status.toLowerCase().includes("blocked") ||
    issue.labels.some((l) => l.toLowerCase() === "blocked")
  );
}

function avg(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function computeTrend(results: ProductivityResult[]): DesignerWorkloadSummary["trend"] {
  if (results.length === 0) return "none";
  if (results.length < 2) return "flat";
  const sorted = [...results].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const mid = Math.max(1, Math.floor(sorted.length / 2));
  const first = sorted.slice(0, mid);
  const second = sorted.slice(mid);
  const avgFirst = avg(first.map((r) => r.observedHoursSaved ?? 0)) ?? 0;
  const avgSecond = avg(second.map((r) => r.observedHoursSaved ?? 0)) ?? 0;
  if (Math.abs(avgSecond - avgFirst) < 0.05) return "flat";
  return avgSecond > avgFirst ? "up" : "down";
}

function buildTicketRow(
  issue: JiraIssue,
  sessions: WorkSession[],
  results: ProductivityResult[]
): DesignerWorkloadTicket {
  const linked = sessions.filter((s) => ticketKey(s) === issue.key.toUpperCase());
  const linkedResults = results.filter((r) => linked.some((s) => s.id === r.sessionId));

  return {
    key: issue.key,
    summary: issue.summary,
    status: issue.status,
    statusCategory: issue.statusCategory,
    components: issue.components,
    labels: issue.labels,
    updatedAt: issue.updatedAt,
    priority: issue.priority,
    url: issue.url,
    assigneeName: issue.assigneeName,
    sessions: linked.length,
    observedHoursSaved: linkedResults.length
      ? sum(linkedResults.map((r) => r.observedHoursSaved ?? 0))
      : undefined,
    lumiAttributedHoursSaved: linkedResults.length
      ? sum(linkedResults.map((r) => r.lumiAttributedHoursSaved ?? 0))
      : undefined,
    lumiAdoptionRate: avg(linkedResults.map((r) => r.lumiAdoptionRate)),
    qualityScore: avg(linkedResults.map((r) => r.qualityScore)),
    linkedSessions: linked,
  };
}

export function buildDesignerWorkloadSummaries(input: {
  issues: JiraIssue[];
  sessions: WorkSession[];
  results: ProductivityResult[];
}): DesignerWorkloadSummary[] {
  const finishedSessions = input.sessions.filter((s) => s.status === "finished");
  const groups = new Map<string, JiraIssue[]>();

  for (const issue of input.issues) {
    const name = issue.assigneeName?.trim() || "Unassigned";
    const list = groups.get(name) ?? [];
    list.push(issue);
    groups.set(name, list);
  }

  const summaries: DesignerWorkloadSummary[] = [];

  for (const [designerName, tickets] of groups.entries()) {
    const sample = tickets[0];
    const ticketRows = tickets.map((issue) =>
      buildTicketRow(issue, finishedSessions, input.results)
    );
    const ticketKeys = new Set(tickets.map((t) => t.key.toUpperCase()));
    const linkedResults = input.results.filter((r) =>
      r.jiraTicketId ? ticketKeys.has(r.jiraTicketId.toUpperCase()) : false
    );

    summaries.push({
      designerName,
      assigneeAccountId: sample.assigneeAccountId,
      assigneeEmail: sample.assigneeEmail,
      activeTickets: tickets.filter((t) => !isDone(t)).length,
      doneTickets: tickets.filter((t) => isDone(t)).length,
      blockedTickets: tickets.filter((t) => isBlocked(t)).length,
      totalTickets: tickets.length,
      sessions: ticketRows.reduce((n, t) => n + t.sessions, 0),
      observedHoursSaved: linkedResults.length
        ? sum(linkedResults.map((r) => r.observedHoursSaved ?? 0))
        : undefined,
      lumiAttributedHoursSaved: linkedResults.length
        ? sum(linkedResults.map((r) => r.lumiAttributedHoursSaved ?? 0))
        : undefined,
      lumiAdoptionRate: avg(linkedResults.map((r) => r.lumiAdoptionRate)),
      qualityScore: avg(linkedResults.map((r) => r.qualityScore)),
      trend: computeTrend(linkedResults),
      tickets: ticketRows.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
    });
  }

  return summaries.sort((a, b) => {
    if (a.designerName === "Unassigned") return 1;
    if (b.designerName === "Unassigned") return -1;
    return b.activeTickets - a.activeTickets || a.designerName.localeCompare(b.designerName);
  });
}

export function formatWorkloadMetric(value: number | undefined, suffix = ""): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(suffix === "%" ? 0 : 1)}${suffix}`;
}

export function trendSymbol(trend?: DesignerWorkloadSummary["trend"]): string {
  switch (trend) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "flat":
      return "→";
    default:
      return "—";
  }
}
