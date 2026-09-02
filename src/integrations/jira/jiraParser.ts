import type { ParsedJiraTicket } from "./types";

const TICKET_PATTERN = /^([A-Z][A-Z0-9]+-\d+)$/i;
const JIRA_URL_PATTERN =
  /(?:https?:\/\/)?[\w.-]+\.atlassian\.net\/browse\/([A-Z][A-Z0-9]+-\d+)/i;

export function parseJiraTicket(input: string, baseUrl = "https://nykmage.atlassian.net"): ParsedJiraTicket {
  const trimmed = input.trim();
  if (!trimmed) return { valid: false };

  const urlMatch = trimmed.match(JIRA_URL_PATTERN);
  if (urlMatch) {
    const ticketId = urlMatch[1].toUpperCase();
    const normalized = baseUrl.replace(/\/+$/, "");
    return {
      ticketId,
      projectKey: ticketId.split("-")[0],
      url: trimmed.startsWith("http") ? trimmed : `${normalized}/browse/${ticketId}`,
      valid: true,
    };
  }

  const idMatch = trimmed.match(TICKET_PATTERN);
  if (idMatch) {
    const ticketId = idMatch[1].toUpperCase();
    const normalized = baseUrl.replace(/\/+$/, "");
    return {
      ticketId,
      projectKey: ticketId.split("-")[0],
      url: `${normalized}/browse/${ticketId}`,
      valid: true,
    };
  }

  return { valid: false };
}

export function normalizeSiteUrl(url?: string): string {
  const base = (url ?? "https://nykmage.atlassian.net").trim().replace(/\/+$/, "");
  return base.startsWith("http") ? base : `https://${base}`;
}

export function buildIssueUrl(baseUrl: string, key: string): string {
  return `${normalizeSiteUrl(baseUrl)}/browse/${key.toUpperCase()}`;
}
