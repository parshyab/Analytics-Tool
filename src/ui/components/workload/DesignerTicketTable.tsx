import { useMemo, useState } from "react";
import type { DesignerWorkloadTicket } from "../../../productivity/designerWorkloadSummary";
import { formatWorkloadMetric } from "../../../productivity/designerWorkloadSummary";
import { DesignerTicketDetail } from "./DesignerTicketDetail";

type Props = {
  tickets: DesignerWorkloadTicket[];
};

type SortKey = "recent" | "hours" | "adoption" | "priority";
type FilterKey = "all" | "active" | "done" | "blocked" | "review";

export function DesignerTicketTable({ tickets }: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let rows = [...tickets];

    if (filter === "active") {
      rows = rows.filter(
        (t) =>
          t.statusCategory !== "Done" &&
          !["done", "closed", "resolved"].includes(t.status.toLowerCase())
      );
    } else if (filter === "done") {
      rows = rows.filter(
        (t) =>
          t.statusCategory === "Done" ||
          ["done", "closed", "resolved"].includes(t.status.toLowerCase())
      );
    } else if (filter === "blocked") {
      rows = rows.filter(
        (t) =>
          t.status.toLowerCase().includes("blocked") ||
          t.labels.some((l) => l.toLowerCase() === "blocked")
      );
    } else if (filter === "review") {
      rows = rows.filter((t) => t.status.toLowerCase().includes("review"));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (t) =>
          t.key.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          t.components.some((c) => c.toLowerCase().includes(q))
      );
    }

    rows.sort((a, b) => {
      if (sort === "hours") {
        return (b.observedHoursSaved ?? 0) - (a.observedHoursSaved ?? 0);
      }
      if (sort === "adoption") {
        return (b.lumiAdoptionRate ?? 0) - (a.lumiAdoptionRate ?? 0);
      }
      if (sort === "priority") {
        return (b.priority ?? "").localeCompare(a.priority ?? "");
      }
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    });

    return rows;
  }, [tickets, search, sort, filter]);

  if (tickets.length === 0) {
    return <p className="workload-empty-inline">No tickets to show for this filter.</p>;
  }

  return (
    <div className="workload-ticket-panel">
      <div className="workload-ticket-toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticket ID, summary, or flow…"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
          <option value="review">In review</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="recent">Most recent</option>
          <option value="hours">Highest hours saved</option>
          <option value="adoption">Highest LUMI adoption</option>
          <option value="priority">Priority</option>
        </select>
      </div>

      <div className="workload-ticket-list">
        {filtered.map((ticket) => (
          <div key={ticket.key} className="workload-ticket-row">
            <button
              type="button"
              className="workload-ticket-row__main"
              onClick={() =>
                setExpandedKey(expandedKey === ticket.key ? null : ticket.key)
              }
            >
              <div className="workload-ticket-row__head">
                <strong>{ticket.key}</strong>
                <span className={`status-badge status-badge--${statusTone(ticket.status)}`}>
                  {ticket.status}
                </span>
              </div>
              <p>{ticket.summary}</p>
              <div className="workload-ticket-row__meta">
                <span>Flow: {ticket.components[0] ?? "—"}</span>
                <span>
                  Saved:{" "}
                  {ticket.sessions > 0
                    ? formatWorkloadMetric(ticket.observedHoursSaved, "h")
                    : "—"}
                </span>
                <span>
                  LUMI:{" "}
                  {ticket.sessions > 0
                    ? formatWorkloadMetric(ticket.lumiAdoptionRate, "%")
                    : "—"}
                </span>
              </div>
            </button>
            <div className="workload-ticket-row__actions">
              <a className="btn btn-ghost btn-sm" href={ticket.url} target="_blank" rel="noreferrer">
                Open in Jira
              </a>
            </div>
            {expandedKey === ticket.key && <DesignerTicketDetail ticket={ticket} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("progress")) return "progress";
  if (s.includes("done") || s.includes("closed")) return "done";
  if (s.includes("blocked")) return "blocked";
  if (s.includes("review")) return "review";
  return "default";
}
