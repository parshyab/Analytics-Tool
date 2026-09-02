export function jiraErrorMessage(status: number, detail?: string): string {
  if (status === 401) return "Invalid Jira email or API token.";
  if (status === 403) {
    return "Your Jira account does not have permission to view these tickets or this project. Please check access to the UX project.";
  }
  if (detail) {
    const parsed = parseJiraErrorDetail(detail);
    if (parsed) return parsed;
    return `Jira API error (${status}): ${detail}`;
  }
  return `Jira API error (${status})`;
}

function parseJiraErrorDetail(detail: string): string | null {
  try {
    const json = JSON.parse(detail) as {
      errorMessages?: string[];
      message?: string;
      errors?: Record<string, string>;
    };
    if (Array.isArray(json.errorMessages) && json.errorMessages.length > 0) {
      return json.errorMessages.join(" ");
    }
    if (typeof json.message === "string" && json.message.trim()) {
      return json.message;
    }
    if (json.errors && typeof json.errors === "object") {
      const values = Object.values(json.errors).filter(Boolean);
      if (values.length > 0) return values.join(" ");
    }
  } catch {
    // not JSON — use raw detail via caller
  }
  return null;
}

export function formatPluginError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) return humanizeFetchFailure(message);
    return error.name || "Unknown error";
  }
  if (typeof error === "string") {
    return humanizeFetchFailure(error.trim() || "Unknown error");
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return humanizeFetchFailure(record.message);
    }
    if (record.message && typeof record.message === "object") {
      try {
        return JSON.stringify(record.message);
      } catch {
        // ignore
      }
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return humanizeFetchFailure(record.error);
    }
    if (typeof record.reason === "string" && record.reason.trim()) {
      return humanizeFetchFailure(record.reason);
    }
    if (typeof record.status === "number") {
      return jiraErrorMessage(record.status);
    }
    try {
      const json = JSON.stringify(error);
      if (json && json !== "{}") return json;
    } catch {
      // ignore
    }
  }
  return "Unexpected Jira connection error.";
}

function humanizeFetchFailure(message: string): string {
  if (/failed to fetch/i.test(message)) {
    return (
      "Could not reach the Jira proxy. Start it with npm run jira-proxy, set Proxy URL to http://localhost:8787, " +
      "re-import manifest.json in Figma, then test again. (Jira blocks direct API calls from Figma — proxy mode is required.)"
    );
  }
  return message;
}

export function coerceUiMessage(value: unknown): string {
  if (typeof value === "string") return value;
  return formatPluginError(value);
}

export function createJiraApiError(status: number, detail?: string): Error {
  return Object.assign(new Error(jiraErrorMessage(status, detail)), {
    status,
    name: "JiraApiError",
  });
}
