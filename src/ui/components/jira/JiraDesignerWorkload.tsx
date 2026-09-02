import type { JiraDesignerWorkload, JiraIssue } from "../../../types";
import { PageSection } from "../PageLayout";

export function JiraDesignerWorkloadView({ workloads }: { workloads: JiraDesignerWorkload[] }) {
  return (
    <PageSection title="Designer workload" subtitle="Tickets grouped by Jira assignee from the synced UX board.">
      {workloads.length === 0 ? (
        <p className="start-session__hint">Sync UX tickets to see designer workload.</p>
      ) : (
        <div className="jira-workload-list">
          {workloads.map((group) => (
            <div key={group.designerName} className="jira-workload-group">
              <div className="jira-workload-group__head">
                <strong>{group.designerName}</strong>
                <span className="jira-workload-counts">
                  {group.activeTickets} active · {group.doneTickets} done · {group.blockedTickets} blocked
                </span>
              </div>
              <ul className="jira-workload-tickets">
                {group.tickets.slice(0, 8).map((ticket) => (
                  <li key={ticket.key}>
                    <TicketLine ticket={ticket} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </PageSection>
  );
}

function TicketLine({ ticket }: { ticket: JiraIssue }) {
  return (
    <span>
      <strong>{ticket.key}</strong> {ticket.summary}
      <span className="jira-workload-meta"> · {ticket.status}</span>
    </span>
  );
}
