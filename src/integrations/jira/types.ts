/** Jira integration types for LUMI Analytics */

export type JiraDataSourceMode = "env-cache" | "direct" | "proxy" | "mock";

export const DEFAULT_JIRA_JQL =
  'project = UX AND created >= "2026-03-31" AND created < "2027-04-01" ORDER BY components DESC';

export const DEFAULT_JIRA_SITE_URL = "https://nykmage.atlassian.net";

/** Internal field IDs for Jira Cloud issue mapping (not part of saved connection config). */
export const JIRA_STORY_POINTS_FIELD = "customfield_10016";
export const JIRA_SPRINT_FIELD = "customfield_10020";

export type JiraConnectionConfig = {
  siteUrl: string;
  email?: string;
  apiToken?: string;
  projectKey: string;
  jql: string;
  dataSourceMode: JiraDataSourceMode;
  proxyUrl?: string;
  savedAt?: string;
  lastSyncedAt?: string;
};

export const DEFAULT_JIRA_PROXY_URL = "http://localhost:8787";

export const DEFAULT_JIRA_CONNECTION_CONFIG: Omit<JiraConnectionConfig, "savedAt"> = {
  siteUrl: DEFAULT_JIRA_SITE_URL,
  projectKey: "UX",
  jql: DEFAULT_JIRA_JQL,
  dataSourceMode: "env-cache",
};

/** @deprecated Use JiraConnectionConfig */
export type JiraAdminConfig = JiraConnectionConfig;

/** @deprecated Use DEFAULT_JIRA_CONNECTION_CONFIG */
export const DEFAULT_JIRA_ADMIN_CONFIG = DEFAULT_JIRA_CONNECTION_CONFIG;

export type JiraIssue = {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: string;
  statusCategory?: string;
  assigneeAccountId?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  reporterName?: string;
  priority?: string;
  projectKey?: string;
  projectName?: string;
  issueType?: string;
  labels: string[];
  components: string[];
  sprint?: string;
  epicKey?: string;
  storyPoints?: number;
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  url: string;
};

export type JiraAssigneeSummary = {
  accountId?: string;
  name: string;
  email?: string;
  totalTickets: number;
  activeTickets: number;
  doneTickets: number;
  blockedTickets?: number;
};

export type JiraCache = {
  syncedAt: string | null;
  source: "env-sync" | "direct-sync" | "proxy-sync" | "mock" | "empty";
  baseUrl: string;
  jql: string;
  projectKey?: string;
  total: number;
  issues: JiraIssue[];
  assignees: JiraAssigneeSummary[];
};

export type JiraConnectionTestResult = {
  ok: boolean;
  status?: number;
  message: string;
  cause:
    | "success"
    | "network-blocked"
    | "invalid-credentials"
    | "permission-denied"
    | "jql-error"
    | "endpoint-error"
    | "cors-or-direct-fetch-blocked"
    | "empty-result"
    | "missing-env"
    | "unknown";
  details?: string;
};

export type JiraSyncState = {
  status: "idle" | "syncing" | "success" | "error";
  lastSyncedAt?: string;
  totalIssues: number;
  totalAssignees: number;
  errorMessage?: string;
  debug?: {
    endpoint?: string;
    jql?: string;
    httpStatus?: number;
    responsePreview?: string;
  };
};

export type JiraDesignerWorkload = {
  designerName: string;
  designerEmail?: string;
  accountId?: string;
  totalTickets: number;
  activeTickets: number;
  doneTickets: number;
  blockedTickets: number;
  tickets: JiraIssue[];
};

export type JiraBoardSyncState = {
  lastSyncedAt?: string;
  totalIssues: number;
  totalAssignees: number;
  errors: string[];
  cacheSource?: JiraCache["source"];
  dataSourceMode?: JiraDataSourceMode;
};

export type FigmaToJiraUserMapping = {
  figmaUserId: string;
  figmaUserName: string;
  jiraAccountId?: string;
  jiraAssigneeName: string;
  jiraAssigneeEmail?: string;
  mappedAt: string;
};

export type JiraSharedIssueSummary = {
  key: string;
  summary: string;
  status: string;
  assigneeName?: string;
  components: string[];
  updatedAt: string;
};

export type JiraConfidence = "high" | "medium" | "low";

export type JiraTicketSuggestion = {
  issue: JiraIssue;
  confidence: JiraConfidence;
  score: number;
  reasons: string[];
  autoSelected: boolean;
};

export type ParsedJiraTicket = {
  ticketId?: string;
  projectKey?: string;
  url?: string;
  valid: boolean;
};

export interface JiraDataSource {
  testConnection(): Promise<JiraConnectionTestResult>;
  syncTickets(): Promise<JiraCache>;
  getIssues(): Promise<JiraIssue[]>;
  getAssignees(): Promise<JiraAssigneeSummary[]>;
}
