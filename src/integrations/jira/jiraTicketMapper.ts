import type { FigmaContextForJira } from "../../types";
import type { JiraIssue, JiraTicketSuggestion } from "./types";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "into", "your", "this", "that", "flow",
  "improve", "update", "design", "figma", "page", "frame", "section",
]);

const DONE_STATUSES = new Set(["done", "closed", "resolved", "cancelled"]);
const BLOCKED_STATUSES = new Set(["blocked", "won't do", "wont do"]);
const IN_PROGRESS_STATUSES = new Set(["in progress", "in review", "in development"]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsKey(text: string | undefined, key: string): boolean {
  if (!text) return false;
  return new RegExp(`\\b${escapeRegExp(key)}\\b`, "i").test(text);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function keywordOverlapScore(source: string, target: string, cap: number): number {
  const sourceTokens = new Set(tokenize(source));
  const targetTokens = tokenize(target);
  if (sourceTokens.size === 0 || targetTokens.length === 0) return 0;
  let matches = 0;
  for (const token of targetTokens) {
    if (sourceTokens.has(token)) matches++;
  }
  if (matches === 0) return 0;
  return Math.min(cap, matches * 15);
}

function hoursSince(iso?: string): number {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function scoreToConfidence(score: number): JiraTicketSuggestion["confidence"] {
  if (score >= 90) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export function scoreIssueForContext(
  issue: JiraIssue,
  figmaContext: FigmaContextForJira,
  detectedFlow?: string
): { score: number; reasons: string[] } {
  const key = issue.key.toUpperCase();
  let score = 0;
  const reasons: string[] = [];

  if (containsKey(figmaContext.selectedNodeName, key)) {
    score += 100;
    reasons.push("Ticket key found in selected node name");
  } else if (figmaContext.parentPath.some((name) => containsKey(name, key))) {
    score += 100;
    reasons.push("Ticket key found in parent path");
  } else if (containsKey(figmaContext.pageName, key)) {
    score += 100;
    reasons.push("Ticket key found in page name");
  }

  if (figmaContext.selectedNodeName) {
    const nodeKw = keywordOverlapScore(issue.summary, figmaContext.selectedNodeName, 70);
    if (nodeKw > 0) {
      score += nodeKw;
      reasons.push("Ticket summary matches selected node keywords");
    }
  }

  const pageKw = keywordOverlapScore(issue.summary, figmaContext.pageName, 60);
  if (pageKw > 0) {
    score += pageKw;
    reasons.push("Ticket summary matches page name keywords");
  }

  const flow = (detectedFlow ?? figmaContext.flowName ?? "").toLowerCase();
  if (flow) {
    if (issue.components.some((c) => c.toLowerCase().includes(flow))) {
      score += 50;
      reasons.push("Jira component matches detected flow");
    }
    if (issue.labels.some((l) => l.toLowerCase().includes(flow))) {
      score += 40;
      reasons.push("Jira label matches detected flow");
    }
  }

  const status = issue.status.toLowerCase();
  if (IN_PROGRESS_STATUSES.has(status)) {
    score += 30;
    reasons.push("Ticket is in progress");
  }
  if (DONE_STATUSES.has(status)) {
    score -= 50;
    reasons.push("Ticket is done");
  }
  if (BLOCKED_STATUSES.has(status)) {
    score -= 30;
    reasons.push("Ticket is blocked");
  }
  if (!issue.assigneeName) {
    score -= 20;
    reasons.push("Ticket is unassigned");
  }
  if (hoursSince(issue.updatedAt) <= 48) {
    score += 20;
    reasons.push("Ticket updated recently");
  }

  return { score: Math.max(0, score), reasons: reasons.length ? reasons : ["No strong Figma context match"] };
}

export { suggestJiraTicketForCurrentContext } from "./jiraTicketSuggestion";

export function issueToSessionFields(issue: JiraIssue, baseUrl?: string) {
  const url = issue.url || buildIssueUrlSafe(baseUrl, issue.key);
  return {
    jiraTicketId: issue.key.toUpperCase(),
    jiraTicketUrl: url,
    jiraIssueKey: issue.key.toUpperCase(),
    jiraIssueUrl: url,
    ticketTitle: issue.summary,
    jiraSummary: issue.summary,
    jiraStatus: issue.status,
    jiraPriority: issue.priority,
    jiraProjectKey: issue.projectKey,
    jiraAssigneeName: issue.assigneeName,
    jiraAssigneeEmail: issue.assigneeEmail,
    jiraComponents: issue.components,
    jiraLabels: issue.labels,
    jiraStoryPoints: issue.storyPoints,
  };
}

function buildIssueUrlSafe(baseUrl: string | undefined, key: string): string {
  const normalized = (baseUrl ?? "https://nykmage.atlassian.net").replace(/\/+$/, "");
  return `${normalized}/browse/${key.toUpperCase()}`;
}

export function groupIssuesByAssignee(issues: JiraIssue[]): import("./types").JiraDesignerWorkload[] {
  const groups = new Map<string, JiraIssue[]>();

  for (const issue of issues) {
    const name = issue.assigneeName?.trim() || "Unassigned";
    const list = groups.get(name) ?? [];
    list.push(issue);
    groups.set(name, list);
  }

  return Array.from(groups.entries())
    .map(([designerName, tickets]) => {
      const activeTickets = tickets.filter(
        (t) => !DONE_STATUSES.has(t.status.toLowerCase()) && !BLOCKED_STATUSES.has(t.status.toLowerCase())
      ).length;
      const doneTickets = tickets.filter((t) => DONE_STATUSES.has(t.status.toLowerCase())).length;
      const blockedTickets = tickets.filter((t) => BLOCKED_STATUSES.has(t.status.toLowerCase())).length;
      const first = tickets[0];
      return {
        designerName,
        designerEmail: first.assigneeEmail,
        accountId: first.assigneeAccountId,
        totalTickets: tickets.length,
        activeTickets,
        doneTickets,
        blockedTickets,
        tickets: tickets.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
      };
    })
    .sort((a, b) => b.activeTickets - a.activeTickets || a.designerName.localeCompare(b.designerName));
}

export function filterMyTickets(issues: JiraIssue[], assigneeName?: string): JiraIssue[] {
  if (!assigneeName) return [];
  const needle = assigneeName.toLowerCase();
  return issues.filter((i) => i.assigneeName?.toLowerCase() === needle);
}

export function searchIssues(issues: JiraIssue[], query: string): JiraIssue[] {
  const q = query.trim().toLowerCase();
  if (!q) return issues;
  return issues.filter((issue) => {
    const haystack = [
      issue.key,
      issue.summary,
      issue.status,
      issue.assigneeName ?? "",
      ...(issue.components ?? []),
      ...(issue.labels ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
