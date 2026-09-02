import { useMemo, useState } from "react";
import type {
  JiraIssue,
  JiraTicketSuggestion,
  SessionMetadataSource,
  StartSessionContext,
  WorkSession,
} from "../../../types";
import { issueToSessionFields, searchIssues } from "../../../integrations/jira/jiraTicketMapper";
import { parseJiraTicket } from "../../../integrations/jira/jiraParser";
import { postMessage, usePluginState } from "../../hooks";

export type SelectedJiraTicket = ReturnType<typeof issueToSessionFields>;

type Props = {
  context: StartSessionContext | null;
  loading: boolean;
  selectedTicket: SelectedJiraTicket | null;
  manualInput: string;
  onManualInputChange: (value: string) => void;
  onSelect: (ticket: SelectedJiraTicket | null, source: SessionMetadataSource["ticket"]) => void;
  onRefresh: () => void;
};

type TabId = "suggested" | "recent" | "all" | "assignees";

export function JiraTicketPicker(props: Props) {
  return <JiraTicketSection {...props} />;
}

function recentIssueKeys(sessions: WorkSession[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const sorted = [...sessions].sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
  for (const session of sorted) {
    const key = (session.jiraIssueKey ?? session.jiraTicketId)?.toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
    if (keys.length >= 8) break;
  }
  return keys;
}

export function JiraTicketSection({
  context,
  loading,
  selectedTicket,
  manualInput,
  onManualInputChange,
  onSelect,
  onRefresh,
}: Props) {
  const { jiraBoard, state } = usePluginState();
  const [tab, setTab] = useState<TabId>("suggested");
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const allIssues = jiraBoard.issues;
  const hasCache = allIssues.length > 0;
  const suggestions = context?.jiraSuggestions ?? [];
  const top = context?.suggestedJiraTicket ?? suggestions[0] ?? null;

  const recentIssues = useMemo(() => {
    const keys = recentIssueKeys(state.sessions);
    return keys
      .map((key) => allIssues.find((i) => i.key.toUpperCase() === key))
      .filter((i): i is JiraIssue => !!i);
  }, [state.sessions, allIssues]);

  const filtered = useMemo(() => searchIssues(allIssues, search), [allIssues, search]);

  const baseUrl =
    jiraBoard.connectionConfigUi?.siteUrl || "https://nykmage.atlassian.net";
  const cacheSyncedAt = jiraBoard.syncState?.lastSyncedAt;

  const applySuggestion = (suggestion: JiraTicketSuggestion) => {
    onSelect(issueToSessionFields(suggestion.issue, baseUrl), suggestion.autoSelected ? "jira-auto" : "jira-suggested");
    setPickerOpen(false);
    if (context) {
      postMessage({
        type: "SAVE_JIRA_TICKET_LINK",
        link: {
          issueKey: suggestion.issue.key,
          fileKey: context.fileKey ?? null,
          pageName: context.pageName,
          nodeId: context.selectedNodeId,
          nodeName: context.selectedNodeName,
          linkedAt: new Date().toISOString(),
        },
      });
    }
  };

  const applyIssue = (issue: JiraIssue, source: SessionMetadataSource["ticket"]) => {
    onSelect(issueToSessionFields(issue, baseUrl), source);
    setPickerOpen(false);
  };

  const applyManual = () => {
    const parsed = parseJiraTicket(manualInput, baseUrl);
    if (!parsed.valid && !manualInput.trim()) {
      onSelect(null, "none");
      return;
    }
    onSelect(
      {
        jiraTicketId: parsed.ticketId ?? manualInput.trim().toUpperCase(),
        jiraTicketUrl: parsed.url,
        jiraIssueKey: parsed.ticketId ?? manualInput.trim().toUpperCase(),
        jiraIssueUrl: parsed.url,
        ticketTitle: manualInput,
        jiraSummary: manualInput,
      },
      "manual"
    );
    setPickerOpen(false);
    setManualOpen(false);
  };

  if (loading && !context) {
    return <p className="start-session__hint">Loading tickets…</p>;
  }

  if (!hasCache) {
    return (
      <div className="jira-panel">
        <p className="jira-panel__notice">
          No Jira tickets available. Continue with manual ticket or start without one.
        </p>
        {!manualOpen ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setManualOpen(true)}>
            Continue with manual ticket
          </button>
        ) : (
          <>
            <div className="form-group">
              <label>Ticket ID or URL</label>
              <input
                value={manualInput}
                onChange={(e) => onManualInputChange(e.target.value)}
                placeholder="UX-458"
              />
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={applyManual}>
                Use ticket
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect(null, "none")}>
                Continue without ticket
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (selectedTicket?.jiraTicketId && !pickerOpen) {
    return (
      <div className="jira-card jira-card--confirmed">
        <TicketCardBody issue={findIssue(allIssues, selectedTicket.jiraTicketId, selectedTicket)} suggestion={top} />
        <div className="btn-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPickerOpen(true)}>
            Change
          </button>
          {selectedTicket.jiraTicketUrl && (
            <a className="btn btn-ghost btn-sm" href={selectedTicket.jiraTicketUrl} target="_blank" rel="noreferrer">
              Open in Jira
            </a>
          )}
        </div>
      </div>
    );
  }

  if (top && !pickerOpen && (top.autoSelected || top.confidence !== "low")) {
    return (
      <div className="jira-card jira-card--suggested">
        <div className="jira-card__label">Suggested from your Jira board and Figma context</div>
        <TicketCardBody issue={top.issue} suggestion={top} />
        <div className="btn-row">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => applySuggestion(top)}>
            Use ticket
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPickerOpen(true)}>
            Choose another
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect(null, "none")}>
            Continue without ticket
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="jira-panel">
      <div className="jira-panel__head">
        <div>
          <p className="jira-panel__context">
            {allIssues.length} UX tickets
            {cacheSyncedAt ? ` · Updated ${new Date(cacheSyncedAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <div className="start-session__segmented jira-tabs">
        {([
          ["suggested", "Suggested"],
          ["recent", "Recently used"],
          ["all", "All UX tickets"],
          ["assignees", "By assignee"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`start-session__segment ${tab === id ? "start-session__segment--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="form-group">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticket ID, title, assignee, component, label, status…"
        />
      </div>

      <div className="jira-picker-list">
        {(tab === "suggested"
          ? suggestions
          : tab === "recent"
            ? recentIssues
            : tab === "all"
              ? filtered
              : []
        )
          .slice(0, tab === "assignees" ? 0 : 20)
          .map((item) => {
            const issue = "issue" in item ? item.issue : item;
            const suggestion = "issue" in item ? item : undefined;
            return (
              <div key={issue.key} className="jira-card jira-card--option">
                <TicketCardBody issue={issue} suggestion={suggestion} />
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      suggestion ? applySuggestion(suggestion) : applyIssue(issue, "jira-suggested")
                    }
                  >
                    Use ticket
                  </button>
                  <a className="btn btn-ghost btn-sm" href={issue.url} target="_blank" rel="noreferrer">
                    Open in Jira
                  </a>
                </div>
              </div>
            );
          })}

        {tab === "assignees" &&
          groupByAssignee(filtered).map((group) => (
            <div key={group.name} className="jira-workload-group">
              <div className="jira-workload-group__head">
                <strong>{group.name}</strong>
                <span>{group.issues.length} tickets</span>
              </div>
              {group.issues.slice(0, 6).map((issue) => (
                <div key={issue.key} className="jira-card jira-card--option">
                  <TicketCardBody issue={issue} compact />
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => applyIssue(issue, "jira-suggested")}
                    >
                      Use ticket
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>

      <div className="form-group">
        <label>Manual ticket (URL or ID)</label>
        <input value={manualInput} onChange={(e) => onManualInputChange(e.target.value)} placeholder="UX-458" />
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-secondary btn-sm" onClick={applyManual}>
          Use ticket
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect(null, "none")}>
          Continue without ticket
        </button>
      </div>
    </div>
  );
}

function groupByAssignee(issues: JiraIssue[]): { name: string; issues: JiraIssue[] }[] {
  const map = new Map<string, JiraIssue[]>();
  for (const issue of issues) {
    const name = issue.assigneeName?.trim() || "Unassigned";
    const list = map.get(name) ?? [];
    list.push(issue);
    map.set(name, list);
  }
  return [...map.entries()]
    .map(([name, list]) => ({ name, issues: list }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function findIssue(issues: JiraIssue[], key?: string, selected?: SelectedJiraTicket): JiraIssue {
  const found = issues.find((i) => i.key === key);
  if (found) return found;
  return {
    id: key ?? "manual",
    key: key ?? "MANUAL",
    summary: selected?.jiraSummary ?? selected?.ticketTitle ?? key ?? "Manual ticket",
    status: selected?.jiraStatus ?? "—",
    labels: selected?.jiraLabels ?? [],
    components: selected?.jiraComponents ?? [],
    updatedAt: new Date().toISOString(),
    url: selected?.jiraTicketUrl ?? "",
    assigneeName: selected?.jiraAssigneeName,
    priority: selected?.jiraPriority,
  };
}

function TicketCardBody({
  issue,
  suggestion,
  compact,
}: {
  issue: JiraIssue;
  suggestion?: JiraTicketSuggestion;
  compact?: boolean;
}) {
  const updated = issue.updatedAt ? formatRelative(issue.updatedAt) : "—";
  return (
    <div className="jira-suggestion">
      <div className="jira-suggestion__head">
        <strong>{issue.key}</strong>
        {!compact && <span className="jira-suggestion__summary">{issue.summary}</span>}
      </div>
      {!compact && (
        <div className="jira-suggestion__meta">
          {issue.assigneeName && issue.assigneeName !== "Unassigned" && (
            <span>Assignee: {issue.assigneeName}</span>
          )}
          <span>Status: {issue.status}</span>
          {issue.components.length > 0 && <span>Components: {issue.components.join(", ")}</span>}
          <span>Updated: {updated}</span>
        </div>
      )}
      {suggestion?.reasons[0] && !compact && (
        <p className="jira-suggestion__reason">{suggestion.reasons[0]}</p>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** @deprecated Designer identity mapping removed from product UX */
export function JiraIdentityMapping() {
  return null;
}
