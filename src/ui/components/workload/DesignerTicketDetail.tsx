import type { DesignerWorkloadTicket } from "../../../productivity/designerWorkloadSummary";
import { formatWorkloadMetric } from "../../../productivity/designerWorkloadSummary";

type Props = {
  ticket: DesignerWorkloadTicket;
};

export function DesignerTicketDetail({ ticket }: Props) {
  const session = ticket.linkedSessions[0];

  return (
    <div className="workload-ticket-detail">
      <div className="workload-ticket-detail__grid">
        <div>
          <span className="workload-detail-label">Jira key</span>
          <strong>{ticket.key}</strong>
        </div>
        <div>
          <span className="workload-detail-label">Status</span>
          <strong>{ticket.status}</strong>
        </div>
        <div>
          <span className="workload-detail-label">Assignee</span>
          <strong>{ticket.assigneeName ?? "—"}</strong>
        </div>
        <div>
          <span className="workload-detail-label">Components</span>
          <strong>{ticket.components.join(", ") || "—"}</strong>
        </div>
        <div>
          <span className="workload-detail-label">Labels</span>
          <strong>{ticket.labels.join(", ") || "—"}</strong>
        </div>
      </div>

      {session ? (
        <>
          <h4>Linked LUMI session</h4>
          <div className="workload-ticket-detail__grid">
            <div>
              <span className="workload-detail-label">Figma file</span>
              <strong>{session.fileName}</strong>
            </div>
            <div>
              <span className="workload-detail-label">Page</span>
              <strong>{session.pageName ?? "—"}</strong>
            </div>
            <div>
              <span className="workload-detail-label">Selection</span>
              <strong>{session.selectedNodeName ?? "—"}</strong>
            </div>
            <div>
              <span className="workload-detail-label">Sessions</span>
              <strong>{ticket.sessions}</strong>
            </div>
            <div>
              <span className="workload-detail-label">Observed hours saved</span>
              <strong>{formatWorkloadMetric(ticket.observedHoursSaved, "h")}</strong>
            </div>
            <div>
              <span className="workload-detail-label">LUMI adoption</span>
              <strong>{formatWorkloadMetric(ticket.lumiAdoptionRate, "%")}</strong>
            </div>
            <div>
              <span className="workload-detail-label">Quality score</span>
              <strong>{formatWorkloadMetric(ticket.qualityScore)}</strong>
            </div>
          </div>
        </>
      ) : (
        <p className="workload-empty-inline">No LUMI session linked yet.</p>
      )}
    </div>
  );
}
