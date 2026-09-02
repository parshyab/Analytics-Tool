import "dotenv/config";
import fs from "fs";
import path from "path";
import type { JiraAssigneeSummary, JiraCache, JiraIssue } from "../src/integrations/jira/types";

const DEFAULT_JQL =
  'project = UX AND created >= "2026-03-31" AND created < "2027-04-01" ORDER BY components DESC';

type EnvConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  jql: string;
  storyPointsField: string;
  sprintField: string;
  cacheOutput: string;
  maxResults: number;
};

function loadEnv(): EnvConfig {
  const email = process.env.JIRA_EMAIL?.trim() ?? "";
  const apiToken = process.env.JIRA_API_TOKEN?.trim() ?? "";

  if (!email || !apiToken) {
    console.error("Missing JIRA_EMAIL or JIRA_API_TOKEN in .env");
    process.exit(1);
  }

  return {
    baseUrl: (process.env.JIRA_BASE_URL ?? "https://nykmage.atlassian.net").replace(/\/+$/, ""),
    email,
    apiToken,
    projectKey: process.env.JIRA_PROJECT_KEY?.trim() || "UX",
    jql: process.env.JIRA_DEFAULT_JQL?.trim() || DEFAULT_JQL,
    storyPointsField: process.env.JIRA_STORY_POINTS_FIELD?.trim() || "customfield_10016",
    sprintField: process.env.JIRA_SPRINT_FIELD?.trim() || "",
    cacheOutput: process.env.JIRA_CACHE_OUTPUT?.trim() || "src/generated/jira-cache.json",
    maxResults: Number(process.env.JIRA_MAX_RESULTS ?? "100") || 100,
  };
}

function authHeader(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
}

function buildFields(storyPointsField: string, sprintField: string): string[] {
  const fields = [
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
    storyPointsField,
  ];
  if (sprintField) fields.push(sprintField);
  return fields;
}

function readNestedName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  return typeof (value as { name?: string }).name === "string"
    ? (value as { name: string }).name
    : undefined;
}

function readSprintName(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) {
    const last = value[value.length - 1];
    if (typeof last === "object" && last) {
      return readNestedName(last);
    }
  }
  if (typeof value === "object") return readNestedName(value);
  return undefined;
}

function normalizeIssue(
  row: { id?: string; key?: string; fields?: Record<string, unknown> },
  config: EnvConfig
): JiraIssue {
  const fields = row.fields ?? {};
  const assignee = fields.assignee as
    | { accountId?: string; displayName?: string; emailAddress?: string }
    | undefined;
  const reporter = fields.reporter as { displayName?: string } | undefined;
  const project = fields.project as { key?: string; name?: string } | undefined;
  const parent = fields.parent as { key?: string } | undefined;
  const status = fields.status as { name?: string; statusCategory?: { name?: string } } | undefined;
  const components = (fields.components as Array<{ name?: string }> | undefined) ?? [];
  const labels = (fields.labels as string[] | undefined) ?? [];
  const storyPointsRaw = fields[config.storyPointsField];
  const sprintRaw = config.sprintField ? fields[config.sprintField] : undefined;
  const key = (row.key ?? "UNKNOWN").toUpperCase();

  const storyPoints =
    typeof storyPointsRaw === "number" ? storyPointsRaw : undefined;

  return {
    id: row.id ?? key,
    key,
    summary: typeof fields.summary === "string" ? fields.summary : "",
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
    sprint: readSprintName(sprintRaw),
    epicKey: parent?.key,
    storyPoints,
    createdAt: typeof fields.created === "string" ? fields.created : undefined,
    updatedAt: typeof fields.updated === "string" ? fields.updated : undefined,
    dueDate: typeof fields.duedate === "string" ? fields.duedate : undefined,
    url: `${config.baseUrl}/browse/${key}`,
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

  return Array.from(groups.entries()).map(([groupKey, tickets]) => {
    const sample = tickets[0];
    const name = sample.assigneeName ?? "Unassigned";
    const doneTickets = tickets.filter((t) => t.statusCategory === "Done").length;
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
      doneTickets,
      blockedTickets,
    };
  });
}

async function fetchViaSearchJql(
  config: EnvConfig,
  fields: string[]
): Promise<JiraIssue[]> {
  const url = `${config.baseUrl}/rest/api/3/search/jql`;
  const headers = {
    Authorization: authHeader(config.email, config.apiToken),
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const all: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  for (;;) {
    const body: Record<string, unknown> = {
      jql: config.jql,
      maxResults: config.maxResults,
      fields,
    };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (response.status === 404) {
      throw new Error("search-jql-404");
    }

    if (!response.ok) {
      await handleHttpError(response);
    }

    const data = (await response.json()) as {
      issues?: unknown[];
      isLast?: boolean;
      nextPageToken?: string;
    };

    for (const row of data.issues ?? []) {
      all.push(normalizeIssue(row as { id?: string; key?: string; fields?: Record<string, unknown> }, config));
    }

    if (data.isLast === true || !data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }

  return all;
}

async function fetchViaLegacySearch(
  config: EnvConfig,
  fields: string[]
): Promise<JiraIssue[]> {
  const all: JiraIssue[] = [];
  let startAt = 0;
  let total = Infinity;

  while (startAt < total) {
    const params = new URLSearchParams({
      jql: config.jql,
      startAt: String(startAt),
      maxResults: String(config.maxResults),
      fields: fields.join(","),
    });

    const response = await fetch(`${config.baseUrl}/rest/api/3/search?${params}`, {
      headers: {
        Authorization: authHeader(config.email, config.apiToken),
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      await handleHttpError(response);
    }

    const data = (await response.json()) as { issues?: unknown[]; total?: number };
    total = data.total ?? 0;

    const batch = (data.issues ?? []).map((row) =>
      normalizeIssue(row as { id?: string; key?: string; fields?: Record<string, unknown> }, config)
    );
    all.push(...batch);
    startAt += config.maxResults;
    if (batch.length === 0) break;
  }

  return all;
}

async function handleHttpError(response: Response): Promise<never> {
  const preview = (await response.text()).slice(0, 220);

  if (response.status === 401) {
    console.error("Invalid Jira email or API token.");
    process.exit(1);
  }
  if (response.status === 403) {
    console.error("Your Jira account does not have permission to access this project or JQL.");
    process.exit(1);
  }
  if (response.status === 400) {
    console.error("Jira rejected the JQL. Check project key, date range, or fields.");
    process.exit(1);
  }

  throw new Error(`Jira HTTP ${response.status}: ${preview}`);
}

async function fetchAllIssues(config: EnvConfig): Promise<JiraIssue[]> {
  const fields = buildFields(config.storyPointsField, config.sprintField);

  try {
    return await fetchViaSearchJql(config, fields);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "search-jql-404") {
      if (error instanceof TypeError || (error instanceof Error && /fetch/i.test(error.message))) {
        console.error("Could not reach Jira from Node. Check network/VPN/base URL.");
        process.exit(1);
      }
      throw error;
    }
    return fetchViaLegacySearch(config, fields);
  }
}

async function main(): Promise<void> {
  const config = loadEnv();
  console.log(`Syncing Jira tickets from ${config.baseUrl} (project ${config.projectKey})…`);

  let issues: JiraIssue[];
  try {
    issues = await fetchAllIssues(config);
  } catch (error) {
    if (error instanceof TypeError) {
      console.error("Could not reach Jira from Node. Check network/VPN/base URL.");
      process.exit(1);
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const assignees = buildAssigneeSummaries(issues);
  const cache: JiraCache = {
    syncedAt: new Date().toISOString(),
    source: "env-sync",
    baseUrl: config.baseUrl,
    jql: config.jql,
    projectKey: config.projectKey,
    total: issues.length,
    issues,
    assignees,
  };

  const outputPath = path.resolve(config.cacheOutput);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");

  console.log(`✓ Wrote ${issues.length} issues to ${config.cacheOutput}`);
  console.log(`  Assignees: ${assignees.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
