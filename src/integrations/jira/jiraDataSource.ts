import type {
  JiraAssigneeSummary,
  JiraCache,
  JiraConnectionConfig,
  JiraConnectionTestResult,
  JiraDataSource,
  JiraIssue,
} from "./types";
import {
  DEFAULT_JIRA_CONNECTION_CONFIG,
  JIRA_SPRINT_FIELD,
  JIRA_STORY_POINTS_FIELD,
} from "./types";
import { getBundledJiraCache } from "./jiraCacheLoader";
import { buildIssueUrl, normalizeSiteUrl } from "./jiraParser";
import { mapApiIssue } from "./jiraBoardSync";
import { createJiraApiError, formatPluginError } from "./jiraErrors";

const NETWORK_BLOCKED_MESSAGE =
  "Jira could not be reached. Check manifest networkAccess, re-import plugin, or use env-cache mode.";

const NETWORK_BLOCKED_INSTRUCTIONS = `Figma is blocking Jira requests.

Fix:
1. Add https://nykmage.atlassian.net to manifest.json networkAccess.allowedDomains
2. Run npm run build
3. In Figma, go to Plugins → Development → Import plugin from manifest
4. Reopen LUMI Analytics

Recommended: use env-cache mode for local development.`;

const MOCK_ISSUES: JiraIssue[] = [
  {
    id: "10001",
    key: "UX-458",
    summary: "Improve Checkout Address Flow",
    status: "In Progress",
    statusCategory: "In Progress",
    assigneeAccountId: "acc-rahul",
    assigneeName: "Rahul Sharma",
    assigneeEmail: "rahul.sharma@nykaa.com",
    priority: "High",
    projectKey: "UX",
    projectName: "UX Design",
    issueType: "Story",
    labels: ["design", "checkout"],
    components: ["Checkout"],
    storyPoints: 8,
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    url: "https://nykmage.atlassian.net/browse/UX-458",
  },
  {
    id: "10002",
    key: "UX-471",
    summary: "Payment Method Improvements",
    status: "In Progress",
    assigneeAccountId: "acc-rahul",
    assigneeName: "Rahul Sharma",
    priority: "Medium",
    projectKey: "UX",
    labels: ["payment"],
    components: ["Checkout", "Payment"],
    storyPoints: 5,
    updatedAt: new Date().toISOString(),
    url: "https://nykmage.atlassian.net/browse/UX-471",
  },
];

function buildAuthHeader(config: JiraConnectionConfig): string {
  const credentials = `${config.email ?? ""}:${config.apiToken ?? ""}`;
  return `Basic ${base64Encode(credentials)}`;
}

function base64Encode(value: string): string {
  if (typeof btoa === "function") {
    try {
      return btoa(value);
    } catch {
      // Non-Latin1 credentials — encode via bytes below.
    }
  }
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildSearchFields(): string[] {
  return [
    "summary",
    "status",
    "assignee",
    "reporter",
    "priority",
    "project",
    "issuetype",
    "labels",
    "components",
    "created",
    "updated",
    "duedate",
    "parent",
    JIRA_STORY_POINTS_FIELD,
    JIRA_SPRINT_FIELD,
  ];
}

function buildApiUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string>
): string {
  const normalized = normalizeSiteUrl(baseUrl);
  const fullPath = path.startsWith("/") ? path : `/${path}`;
  let url = `${normalized}${fullPath}`;
  if (params && Object.keys(params).length > 0) {
    const qs = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
    url += `?${qs}`;
  }
  return url;
}

function mapHttpError(status: number, detail?: string): JiraConnectionTestResult {
  if (status === 401) {
    return {
      ok: false,
      status,
      cause: "invalid-credentials",
      message: "Invalid Jira email or API token.",
      details: detail,
    };
  }
  if (status === 403) {
    return {
      ok: false,
      status,
      cause: "permission-denied",
      message:
        "Your Jira account can connect, but does not have permission to access this project or query.",
      details: detail,
    };
  }
  if (status === 400) {
    return {
      ok: false,
      status,
      cause: "jql-error",
      message: "Jira rejected the JQL. Check project key, dates, or fields.",
      details: detail,
    };
  }
  if (status === 404) {
    return {
      ok: false,
      status,
      cause: "endpoint-error",
      message: "Jira endpoint not found. Check Jira base URL.",
      details: detail,
    };
  }
  return {
    ok: false,
    status,
    cause: "unknown",
    message: detail ?? `Jira request failed (${status}).`,
    details: detail,
  };
}

function mapFetchError(error: unknown): JiraConnectionTestResult {
  const hint = formatPluginError(error);
  if (/failed to fetch|network|typeerror/i.test(hint)) {
    return {
      ok: false,
      cause: "network-blocked",
      message: NETWORK_BLOCKED_MESSAGE,
      details: NETWORK_BLOCKED_INSTRUCTIONS,
    };
  }
  return {
    ok: false,
    cause: "unknown",
    message: hint,
  };
}

function buildAssigneeSummaries(issues: JiraIssue[]): JiraAssigneeSummary[] {
  const groups = new Map<string, JiraIssue[]>();
  for (const issue of issues) {
    const key = issue.assigneeAccountId ?? issue.assigneeName ?? "Unassigned";
    const list = groups.get(key) ?? [];
    list.push(issue);
    groups.set(key, list);
  }

  return Array.from(groups.values()).map((tickets) => {
    const sample = tickets[0];
    const name = sample.assigneeName ?? "Unassigned";
    const blockedTickets = tickets.filter(
      (t) =>
        t.status.toLowerCase().includes("blocked") ||
        t.labels.some((l) => l.toLowerCase() === "blocked")
    ).length;

    return {
      accountId: sample.assigneeAccountId,
      name,
      email: sample.assigneeEmail,
      totalTickets: tickets.length,
      activeTickets: tickets.filter((t) => t.statusCategory !== "Done").length,
      doneTickets: tickets.filter((t) => t.statusCategory === "Done").length,
      blockedTickets,
    };
  });
}

function toCache(
  issues: JiraIssue[],
  config: JiraConnectionConfig,
  source: JiraCache["source"]
): JiraCache {
  const assignees = buildAssigneeSummaries(issues);
  return {
    syncedAt: new Date().toISOString(),
    source,
    baseUrl: normalizeSiteUrl(config.siteUrl),
    jql: config.jql,
    projectKey: config.projectKey,
    total: issues.length,
    issues,
    assignees,
  };
}

async function parseSearchResponse(
  data: { issues?: unknown[] },
  config: JiraConnectionConfig
): Promise<JiraIssue[]> {
  const baseUrl = normalizeSiteUrl(config.siteUrl);
  return (data.issues ?? []).map((row) => mapApiIssue(row, config, baseUrl));
}

export class EnvCacheJiraDataSource implements JiraDataSource {
  async testConnection(): Promise<JiraConnectionTestResult> {
    const cache = getBundledJiraCache();
    if (cache.issues.length === 0) {
      return {
        ok: true,
        cause: "empty-result",
        message:
          "Bundled Jira cache is empty. Run npm run sync:jira locally, then npm run build and re-import the plugin.",
      };
    }
    return {
      ok: true,
      cause: "success",
      message: `Bundled cache has ${cache.issues.length} UX tickets (synced ${cache.syncedAt ?? "unknown"}).`,
    };
  }

  async syncTickets(): Promise<JiraCache> {
    return getBundledJiraCache();
  }

  async getIssues(): Promise<JiraIssue[]> {
    return getBundledJiraCache().issues;
  }

  async getAssignees(): Promise<JiraAssigneeSummary[]> {
    return getBundledJiraCache().assignees;
  }
}

export class DirectJiraDataSource implements JiraDataSource {
  constructor(private config: JiraConnectionConfig) {}

  async testConnection(): Promise<JiraConnectionTestResult> {
    if (!this.config.email || !this.config.apiToken) {
      return {
        ok: false,
        cause: "missing-env",
        message: "Enter your Jira email and API token for direct mode.",
      };
    }

    const baseUrl = normalizeSiteUrl(this.config.siteUrl);
    const url = buildApiUrl(baseUrl, "/rest/api/3/myself");
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: buildAuthHeader(this.config),
          Accept: "application/json",
        },
      });
    } catch (error) {
      return mapFetchError(error);
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 220);
      return mapHttpError(response.status, detail);
    }

    return {
      ok: true,
      status: response.status,
      cause: "success",
      message: "Jira connection successful.",
    };
  }

  async syncBoardTicketsLegacy(): Promise<JiraIssue[]> {
    const baseUrl = normalizeSiteUrl(this.config.siteUrl);
    const fields = buildSearchFields();
    const all: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = 100;
    let total = Infinity;

    while (startAt < total) {
      let response: Response;
      try {
        response = await fetch(
          buildApiUrl(baseUrl, "/rest/api/3/search", {
            jql: this.config.jql,
            startAt: String(startAt),
            maxResults: String(maxResults),
            fields: fields.join(","),
          }),
          {
            headers: {
              Authorization: buildAuthHeader(this.config),
              Accept: "application/json",
            },
          }
        );
      } catch (error) {
        throw new Error(mapFetchError(error).message);
      }

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 220);
        const mapped = mapHttpError(response.status, detail);
        throw new Error(mapped.message);
      }

      const data = (await response.json()) as { issues?: unknown[]; total?: number };
      total = data.total ?? 0;
      const batch = await parseSearchResponse(data, this.config);
      all.push(...batch);
      startAt += maxResults;
      if (batch.length === 0) break;
    }

    return all;
  }

  async syncTickets(): Promise<JiraCache> {
    const issues = await this.syncBoardTicketsLegacy();
    return toCache(issues, this.config, "direct-sync");
  }

  async getIssues(): Promise<JiraIssue[]> {
    return this.syncBoardTicketsLegacy();
  }

  async getAssignees(): Promise<JiraAssigneeSummary[]> {
    const issues = await this.getIssues();
    return buildAssigneeSummaries(issues);
  }
}

export class ProxyJiraDataSource implements JiraDataSource {
  constructor(private config: JiraConnectionConfig) {}

  async testConnection(): Promise<JiraConnectionTestResult> {
    return {
      ok: false,
      cause: "endpoint-error",
      message:
        "Proxy mode is not configured yet. Use env-cache mode (npm run sync:jira) for local development.",
    };
  }

  async syncTickets(): Promise<JiraCache> {
    throw new Error("Proxy Jira sync is not implemented yet.");
  }

  async getIssues(): Promise<JiraIssue[]> {
    return [];
  }

  async getAssignees(): Promise<JiraAssigneeSummary[]> {
    return [];
  }
}

export class MockJiraDataSource implements JiraDataSource {
  async testConnection(): Promise<JiraConnectionTestResult> {
    return {
      ok: true,
      cause: "success",
      message: "Mock Jira data source ready.",
    };
  }

  async syncTickets(): Promise<JiraCache> {
    return toCache(MOCK_ISSUES, DEFAULT_JIRA_CONNECTION_CONFIG, "mock");
  }

  async getIssues(): Promise<JiraIssue[]> {
    return MOCK_ISSUES;
  }

  async getAssignees(): Promise<JiraAssigneeSummary[]> {
    return buildAssigneeSummaries(MOCK_ISSUES);
  }
}

export function createJiraDataSource(config: JiraConnectionConfig): JiraDataSource {
  switch (config.dataSourceMode) {
    case "direct":
      return new DirectJiraDataSource(config);
    case "proxy":
      return new ProxyJiraDataSource(config);
    case "mock":
      return new MockJiraDataSource();
    case "env-cache":
    default:
      return new EnvCacheJiraDataSource();
  }
}

export function isJiraConnectionConfigured(config: Partial<JiraConnectionConfig>): boolean {
  const mode = config.dataSourceMode ?? "env-cache";
  if (mode === "env-cache" || mode === "mock") return true;
  if (mode === "proxy") {
    return !!(config.siteUrl && config.email && config.apiToken && config.jql && config.proxyUrl);
  }
  return !!(config.siteUrl && config.email && config.apiToken && config.jql);
}

export function mergeJiraConnectionConfig(
  partial?: Partial<JiraConnectionConfig>
): JiraConnectionConfig {
  return {
    ...DEFAULT_JIRA_CONNECTION_CONFIG,
    ...partial,
    savedAt: partial?.savedAt ?? new Date().toISOString(),
  };
}

export { NETWORK_BLOCKED_INSTRUCTIONS, NETWORK_BLOCKED_MESSAGE };

/** @deprecated Use isJiraConnectionConfigured */
export const isJiraAdminConfigured = isJiraConnectionConfigured;

/** @deprecated Use mergeJiraConnectionConfig */
export const mergeJiraAdminConfig = mergeJiraConnectionConfig;

/** Legacy adapter for code expecting syncBoardTickets on data source */
export async function syncBoardTicketsFromSource(
  config: JiraConnectionConfig
): Promise<JiraIssue[]> {
  const source = createJiraDataSource(config);
  if (config.dataSourceMode === "env-cache") {
    return source.getIssues();
  }
  const cache = await source.syncTickets();
  return cache.issues;
}

export async function testJiraConnection(
  config: JiraConnectionConfig
): Promise<JiraConnectionTestResult> {
  return createJiraDataSource(config).testConnection();
}

export async function getIssueFromSource(
  config: JiraConnectionConfig,
  issueKey: string
): Promise<JiraIssue | null> {
  const issues = await createJiraDataSource(config).getIssues();
  return issues.find((i) => i.key.toUpperCase() === issueKey.toUpperCase()) ?? null;
}

export { createJiraApiError, formatPluginError } from "./jiraErrors";
export { buildIssueUrl, normalizeSiteUrl } from "./jiraParser";
