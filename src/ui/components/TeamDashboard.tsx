import type { PluginState, TeamAggregate } from "../../types";
import { aggregateByTeam } from "../../productivity/dashboardAggregates";
import { NYKAA_DESIGN_TEAMS } from "../../productivity/nykaaTeams";
import { PageSection } from "./PageLayout";
import { KpiCard } from "../hooks";

function emptyTeam(teamName: string): TeamAggregate {
  return {
    teamName,
    designers: 0,
    sessions: 0,
    tickets: 0,
    actualHours: 0,
    benchmarkHours: 0,
    observedHoursSaved: 0,
    lumiAttributedHoursSaved: 0,
    productivityLiftPercent: 0,
    lumiAdoptionRate: 0,
    tokenAdoptionRate: 0,
    styleAdoptionRate: 0,
    qualityScore: 0,
    confidence: "unavailable",
  };
}

export function TeamDashboard({ state }: { state: PluginState }) {
  const byName = new Map(aggregateByTeam(state.productivityResults).map((t) => [t.teamName, t]));
  const teams = NYKAA_DESIGN_TEAMS.map((name) => byName.get(name) ?? emptyTeam(name));

  return (
    <>
      <PageSection title="Team adoption">
        <div className="grid">
          {teams.map((t) => (
            <KpiCard key={t.teamName} label={t.teamName} value={`${t.lumiAdoptionRate.toFixed(0)}% LUMI`} source="measured" />
          ))}
        </div>
      </PageSection>

      <PageSection title="Team metrics" flush>
        <div className="table-scroll">
          <table className="trend-table">
            <thead>
              <tr>
                <th>Team</th><th>Designers</th><th>Sessions</th><th>Hours</th>
                <th>Saved</th><th>LUMI %</th><th>Token %</th><th>Quality</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.teamName}>
                  <td className="cell-strong">{t.teamName}</td>
                  <td>{t.designers}</td>
                  <td>{t.sessions}</td>
                  <td>{t.actualHours.toFixed(1)}h</td>
                  <td>{t.observedHoursSaved.toFixed(1)}h</td>
                  <td>{t.lumiAdoptionRate.toFixed(0)}%</td>
                  <td>{t.tokenAdoptionRate.toFixed(0)}%</td>
                  <td>{t.qualityScore.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>
    </>
  );
}
