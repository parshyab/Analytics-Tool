import type { PluginState } from "../../types";
import { ENABLEMENT_DISCLAIMER } from "../../types";
import { aggregateByDesigner } from "../../productivity/dashboardAggregates";
import {
  filterResultsForTeam,
  resolvePluginTeamName,
} from "../../productivity/nykaaTeams";
import { PageSection } from "./PageLayout";
import { KpiCard } from "../hooks";
import { DesignerWorkloadSummary } from "./workload/DesignerWorkloadSummary";

export function DesignerProductivity({ state }: { state: PluginState }) {
  const userTeam = resolvePluginTeamName(state);
  const teamResults = filterResultsForTeam(state.productivityResults, userTeam);
  const rows = aggregateByDesigner(teamResults);

  const totalActual = rows.reduce((s, r) => s + r.actualHours, 0);
  const totalSaved = rows.reduce((s, r) => s + r.observedHoursSaved, 0);
  const avgLift = rows.length ? rows.reduce((s, r) => s + r.productivityLiftPercent, 0) / rows.length : 0;

  return (
    <>
      <PageSection
        title={userTeam ? `${userTeam} designers` : "Team summary"}
        subtitle={ENABLEMENT_DISCLAIMER}
      >
        <div className="grid">
          <KpiCard label="Designers active" value={String(rows.length)} source="measured" />
          <KpiCard label="Sessions completed" value={String(teamResults.length)} source="measured" />
          <KpiCard label="Actual hours" value={`${totalActual.toFixed(1)}h`} source="measured" />
          <KpiCard label="Observed saved" value={`${totalSaved.toFixed(1)}h`} source="calculated" />
          <KpiCard label="Avg productivity lift" value={`${avgLift.toFixed(0)}%`} source="calculated" />
          <KpiCard
            label="Avg LUMI adoption"
            value={`${(rows.reduce((s, r) => s + r.lumiAdoptionRate, 0) / Math.max(1, rows.length)).toFixed(0)}%`}
            source="measured"
          />
        </div>
      </PageSection>

      <DesignerWorkloadSummary state={state} teamFilter={userTeam} />
    </>
  );
}
