import type { PluginState } from "../../types";
import { getMyTodayStats } from "../../productivity/dashboardAggregates";
import { PageSection } from "./PageLayout";
import { KpiCard, formatMinutes } from "../hooks";

export function MyProductivity({ state }: { state: PluginState }) {
  const userId = state.profile?.userId ?? state.currentUser?.id ?? "";
  const myResults = state.productivityResults.filter((r) => r.designerUserId === userId);
  const today = getMyTodayStats(userId, state.sessions, state.productivityResults);

  const latest = myResults[0];
  const totalSaved = myResults.reduce((s, r) => s + (r.observedHoursSaved ?? 0), 0);
  const lumiSaved = myResults.reduce((s, r) => s + (r.lumiAttributedHoursSaved ?? 0), 0);

  return (
    <>
      <PageSection title="Today's snapshot" subtitle="Measured from your work sessions">
        <div className="grid">
          <KpiCard label="Sessions today" value={String(today.sessionsToday)} source="measured" />
          <KpiCard label="Time worked" value={formatMinutes(today.minutesToday)} source="measured" />
          <KpiCard label="LUMI adoption" value={`${today.lumiAdoption.toFixed(0)}%`} source="measured" />
          <KpiCard
            label="Observed saved"
            value={totalSaved > 0 ? `${totalSaved.toFixed(1)}h` : "Needs benchmark"}
            source="calculated"
          />
          <KpiCard
            label="LUMI-attributed"
            value={lumiSaved > 0 ? `${lumiSaved.toFixed(1)}h` : "Needs benchmark"}
            source="calculated"
          />
          <KpiCard
            label="Productivity lift"
            value={latest?.productivityLiftPercent !== undefined ? `${latest.productivityLiftPercent.toFixed(0)}%` : "—"}
            source="calculated"
          />
          <KpiCard
            label="LUMI leverage"
            value={latest ? `${latest.designSystemLeverageScore.toFixed(0)}` : "—"}
            source="calculated"
          />
          <KpiCard label="Confidence" value={latest?.confidence.label ?? "—"} source="benchmarked" />
        </div>
      </PageSection>

      <PageSection title="Session history" subtitle="Finished sessions with LUMI scan results" flush>
        {myResults.length === 0 ? (
          <div className="empty-panel">
            <p>No completed sessions yet. Start a session to track productivity.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="trend-table">
              <thead>
                <tr>
                  <th>Date</th><th>Project</th><th>Ticket</th><th>Flow</th>
                  <th>Actual</th><th>Benchmark</th><th>Saved</th>
                  <th>LUMI %</th><th>Quality</th><th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {myResults.map((r) => (
                  <tr key={r.id}>
                    <td>{r.createdAt.slice(0, 10)}</td>
                    <td>{r.projectName}</td>
                    <td>{r.jiraTicketId ?? "—"}</td>
                    <td>{r.flowName}</td>
                    <td>{formatMinutes(r.actualMinutes)}</td>
                    <td>{r.benchmarkMinutes ? formatMinutes(r.benchmarkMinutes) : "—"}</td>
                    <td>{r.observedHoursSaved !== undefined ? `${r.observedHoursSaved.toFixed(1)}h` : "N/A"}</td>
                    <td>{r.lumiAdoptionRate.toFixed(0)}%</td>
                    <td>{r.qualityScore.toFixed(0)}</td>
                    <td><span className={`confidence-pill confidence-${r.confidence.label}`}>{r.confidence.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </>
  );
}
