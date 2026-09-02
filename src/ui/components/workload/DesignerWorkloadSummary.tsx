import { useMemo, useState } from "react";
import type { PluginState } from "../../../types";
import {
  buildDesignerWorkloadSummaries,
  formatWorkloadMetric,
  trendSymbol,
  type DesignerWorkloadSummary,
} from "../../../productivity/designerWorkloadSummary";
import {
  resolveDesignerTeamName,
  type NykaaDesignTeam,
} from "../../../productivity/nykaaTeams";
import { PageSection } from "../PageLayout";
import { usePluginState } from "../../hooks";
import { DesignerWorkloadDrawer } from "./DesignerWorkloadDrawer";

export function DesignerWorkloadSummary({
  state,
  teamFilter,
}: {
  state: PluginState;
  teamFilter?: NykaaDesignTeam;
}) {
  const { jiraBoard } = usePluginState();
  const summaries = useMemo(() => {
    const rows = buildDesignerWorkloadSummaries({
      issues: jiraBoard.issues,
      sessions: state.sessions,
      results: state.productivityResults,
    });
    if (!teamFilter) return rows;
    return rows.filter(
      (row) =>
        resolveDesignerTeamName(
          "",
          row.designerName,
          state.sessions,
          state.productivityResults
        ) === teamFilter
    );
  }, [jiraBoard.issues, state.sessions, state.productivityResults, teamFilter]);

  const [selected, setSelected] = useState<DesignerWorkloadSummary | null>(null);

  if (jiraBoard.issues.length === 0) {
    return (
      <PageSection
        title="Designer workload"
        subtitle="Ticket ownership and LUMI impact by designer."
      >
        <div className="workload-empty">
          <p>No Jira ticket data available yet.</p>
        </div>
      </PageSection>
    );
  }

  return (
    <>
      <PageSection
        title="Designer workload"
        subtitle="Ticket ownership and LUMI impact by designer."
      >
        <div className="workload-table-wrap">
          <table className="workload-table">
            <thead>
              <tr>
                <th>Designer</th>
                <th>Active tickets</th>
                <th>LUMI adoption</th>
                <th>Hours saved</th>
                <th>Sessions</th>
                <th>Quality</th>
                <th>Trend</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {summaries.map((row) => (
                <tr key={row.designerName}>
                  <td className="cell-strong">{row.designerName}</td>
                  <td>{row.activeTickets}</td>
                  <td>
                    {row.sessions > 0
                      ? formatWorkloadMetric(row.lumiAdoptionRate, "%")
                      : "No LUMI sessions yet"}
                  </td>
                  <td>
                    {row.sessions > 0
                      ? formatWorkloadMetric(row.observedHoursSaved, "h")
                      : "—"}
                  </td>
                  <td>{row.sessions}</td>
                  <td>
                    {row.sessions > 0 ? formatWorkloadMetric(row.qualityScore) : "—"}
                  </td>
                  <td>
                    <span className={`workload-trend workload-trend--${row.trend ?? "none"}`}>
                      {trendSymbol(row.trend)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelected(row)}
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      {selected && (
        <DesignerWorkloadDrawer summary={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
