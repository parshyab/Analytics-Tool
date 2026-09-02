import jiraCacheJson from "../../generated/jira-cache.json";
import type { JiraAssigneeSummary, JiraCache, JiraIssue } from "./types";

export function getBundledJiraCache(): JiraCache {
  const cache = jiraCacheJson as JiraCache;

  return {
    syncedAt: cache.syncedAt || null,
    source: cache.source || "empty",
    baseUrl: cache.baseUrl || "",
    jql: cache.jql || "",
    projectKey: cache.projectKey || "UX",
    total: cache.total || 0,
    issues: Array.isArray(cache.issues) ? cache.issues : [],
    assignees: Array.isArray(cache.assignees) ? cache.assignees : [],
  };
}

export function getJiraIssues(): JiraIssue[] {
  return getBundledJiraCache().issues;
}

export function getJiraAssignees(): JiraAssigneeSummary[] {
  return getBundledJiraCache().assignees;
}

export function hasJiraCache(): boolean {
  return getJiraIssues().length > 0;
}
