import { useMemo, useState } from "react";
import type { DesignerWorkloadSummary as Summary } from "../../../productivity/designerWorkloadSummary";
import { formatWorkloadMetric, trendSymbol } from "../../../productivity/designerWorkloadSummary";
import { DesignerTicketTable } from "./DesignerTicketTable";

type Props = {
  summary: Summary;
  onClose: () => void;
};

export function DesignerWorkloadDrawer({ summary, onClose }: Props) {
  const [showCompleted, setShowCompleted] = useState(false);

  const activeCount = summary.activeTickets;
  const doneCount = summary.doneTickets;
  const blockedCount = summary.blockedTickets;

  const visibleTickets = useMemo(() => {
    if (showCompleted) return summary.tickets;
    return summary.tickets.filter(
      (t) => t.statusCategory !== "Done" && !["done", "closed", "resolved"].includes(t.status.toLowerCase())
    );
  }, [summary.tickets, showCompleted]);

  return (
    <div className="workload-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="workload-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${summary.designerName} workload`}
      >
        <header className="workload-drawer__head">
          <div>
            <h3>{summary.designerName}</h3>
            <p>
              {activeCount} active · {doneCount} done · {blockedCount} blocked
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="workload-drawer__cards">
          <div className="workload-mini-card">
            <span>Active tickets</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="workload-mini-card">
            <span>Hours saved</span>
            <strong>
              {summary.sessions > 0
                ? formatWorkloadMetric(summary.observedHoursSaved, "h")
                : "—"}
            </strong>
          </div>
          <div className="workload-mini-card">
            <span>LUMI adoption</span>
            <strong>
              {summary.sessions > 0
                ? formatWorkloadMetric(summary.lumiAdoptionRate, "%")
                : "—"}
            </strong>
          </div>
          <div className="workload-mini-card">
            <span>Sessions</span>
            <strong>{summary.sessions}</strong>
          </div>
          <div className="workload-mini-card">
            <span>Quality</span>
            <strong>
              {summary.sessions > 0
                ? formatWorkloadMetric(summary.qualityScore)
                : "—"}
            </strong>
          </div>
          <div className="workload-mini-card">
            <span>Trend</span>
            <strong className={`workload-trend workload-trend--${summary.trend ?? "none"}`}>
              {trendSymbol(summary.trend)}
            </strong>
          </div>
        </div>

        <div className="workload-drawer__toolbar">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            Show completed tickets
          </label>
        </div>

        <DesignerTicketTable tickets={visibleTickets} />
      </aside>
    </div>
  );
}
