import type { JiraConnectionConfig, JiraBoardSyncState, JiraIssue, JiraSharedIssueSummary } from "./types";
import { JIRA_SPRINT_FIELD, JIRA_STORY_POINTS_FIELD } from "./types";
import { syncBoardTicketsFromSource } from "./jiraDataSource";
import { formatPluginError } from "./jiraErrors";
import { groupIssuesByAssignee } from "./jiraTicketMapper";
import { buildIssueUrl } from "./jiraParser";

type ApiIssueRow = {
  id?: string;
  key?: string;
  fields?: Record<string, unknown>;
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function readNestedName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  return readString((value as { name?: string }).name);
}

function readSprintName(value: unknown, sprintField?: string): string | undefined {
  if (!sprintField || value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) {
    const last = value[value.length - 1];
    if (typeof last === "object" && last) {
      return readString((last as { name?: string }).name);
    }
  }
  if (typeof value === "object" && value) {
    return readString((value as { name?: string }).name);
  }
  return undefined;
}

export function mapApiIssue(row: unknown, config: JiraConnectionConfig, baseUrl: string): JiraIssue {
  const issue = row as ApiIssueRow;
  const fields = (issue.fields ?? {}) as Record<string, unknown>;
  const assignee = fields.assignee as
    | { accountId?: string; displayName?: string; emailAddress?: string }
    | undefined;
  const reporter = fields.reporter as { displayName?: string } | undefined;
  const project = fields.project as { key?: string; name?: string } | undefined;
  const parent = fields.parent as { key?: string } | undefined;
  const status = fields.status as { name?: string; statusCategory?: { name?: string } } | undefined;
  const components = (fields.components as Array<{ name?: string }> | undefined) ?? [];
  const labels = (fields.labels as string[] | undefined) ?? [];
  const storyPointsRaw = fields[JIRA_STORY_POINTS_FIELD];
  const sprintRaw = fields[JIRA_SPRINT_FIELD];

  const key = (issue.key ?? "UNKNOWN").toUpperCase();

  return {
    id: issue.id ?? key,
    key,
    summary: readString(fields.summary) ?? key,
    description: readString(fields.description),
    status: readNestedName(status) ?? "Unknown",
    statusCategory: readNestedName(status?.statusCategory),
    assigneeAccountId: assignee?.accountId,
    assigneeName: assignee?.displayName || "Unassigned",
    assigneeEmail: assignee?.emailAddress,
    reporterName: reporter?.displayName,
    priority: readNestedName(fields.priority),
    projectKey: project?.key ?? config.projectKey,
    projectName: project?.name,
    issueType: readNestedName(fields.issuetype),
    labels: [...labels],
    components: components.map((c) => c.name ?? "").filter(Boolean),
    sprint: readSprintName(sprintRaw, JIRA_SPRINT_FIELD),
    epicKey: parent?.key,
    storyPoints: readNumber(storyPointsRaw) ?? undefined,
    createdAt: readString(fields.created),
    updatedAt: readString(fields.updated) ?? new Date().toISOString(),
    dueDate: readString(fields.duedate),
    url: buildIssueUrl(baseUrl, key),
  };
}

export type JiraSyncResult = {
  issues: JiraIssue[];
  workloads: ReturnType<typeof groupIssuesByAssignee>;
  syncState: JiraBoardSyncState;
};

export async function syncUxBoardTickets(config: JiraConnectionConfig): Promise<JiraSyncResult> {
  const errors: string[] = [];

  try {
    const issues = await syncBoardTicketsFromSource(config);
    const workloads = groupIssuesByAssignee(issues);
    const syncState: JiraBoardSyncState = {
      lastSyncedAt: new Date().toISOString(),
      totalIssues: issues.length,
      totalAssignees: workloads.filter((w) => w.designerName !== "Unassigned").length,
      errors,
    };
    return { issues, workloads, syncState };
  } catch (error) {
    errors.push(formatPluginError(error));
    return {
      issues: [],
      workloads: [],
      syncState: {
        lastSyncedAt: new Date().toISOString(),
        totalIssues: 0,
        totalAssignees: 0,
        errors,
      },
    };
  }
}

export function toSharedIssueSummaries(issues: JiraIssue[]): JiraSharedIssueSummary[] {
  return issues.map((issue) => ({
    key: issue.key,
    summary: issue.summary,
    status: issue.status,
    assigneeName: issue.assigneeName,
    components: issue.components,
    updatedAt: issue.updatedAt,
  }));
}
