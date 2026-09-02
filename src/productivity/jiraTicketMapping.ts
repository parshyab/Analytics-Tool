import type { JiraTicketNodeLink } from "../types";
import { getSharedPluginDataSafe, setSharedPluginDataSafe } from "./sharedPluginData";

const STORAGE_KEY = "jira.ticket.links.v1";
const MAX_LINKS = 40;

export function loadJiraTicketLinks(): JiraTicketNodeLink[] {
  const raw = getSharedPluginDataSafe(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as JiraTicketNodeLink[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveJiraTicketLink(link: JiraTicketNodeLink): void {
  const existing = loadJiraTicketLinks().filter((l) => l.issueKey !== link.issueKey);
  const next = [link, ...existing].slice(0, MAX_LINKS);
  setSharedPluginDataSafe(STORAGE_KEY, JSON.stringify(next));
}
