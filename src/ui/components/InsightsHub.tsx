import { lazy, Suspense, useEffect } from "react";
import type { PluginState, TabId } from "../../types";
import { MyProductivity } from "./MyProductivity";

const MonthlyDashboard = lazy(() =>
  import("./MonthlyDashboard").then((m) => ({ default: m.MonthlyDashboard }))
);
const DesignerProductivity = lazy(() =>
  import("./DesignerProductivity").then((m) => ({ default: m.DesignerProductivity }))
);
const TeamDashboard = lazy(() =>
  import("./TeamDashboard").then((m) => ({ default: m.TeamDashboard }))
);
const LumiAdoption = lazy(() =>
  import("./LumiAdoption").then((m) => ({ default: m.LumiAdoption }))
);
const JiraIntegrationPage = lazy(() =>
  import("./jira/JiraIntegrationPage").then((m) => ({ default: m.JiraIntegrationPage }))
);

export const INSIGHT_SUB_TABS: { id: TabId; label: string; adminOnly?: boolean }[] = [
  { id: "my-productivity", label: "My productivity" },
  { id: "monthly-dashboard", label: "Trends", adminOnly: true },
  { id: "designer-productivity", label: "Designers", adminOnly: true },
  { id: "team-dashboard", label: "Teams", adminOnly: true },
  { id: "lumi-adoption", label: "LUMI Adoption", adminOnly: true },
  { id: "jira-integration", label: "Jira", adminOnly: true },
];

function TabLoading() {
  return <p className="section-footnote">Loading…</p>;
}

export function InsightsHub({
  state,
  activeSubTab,
  onSubTabChange,
  isAdmin,
  showSubNav = true,
}: {
  state: PluginState;
  activeSubTab: TabId;
  onSubTabChange: (t: TabId) => void;
  isAdmin: boolean;
  showSubNav?: boolean;
}) {
  useEffect(() => {
    void import("../dashboard.css");
  }, []);

  const tabs = INSIGHT_SUB_TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="insights-hub">
      {showSubNav && tabs.length > 1 ? (
        <div className="insights-hub__nav" role="tablist" aria-label="Insights views">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeSubTab === t.id}
              className={`insights-hub__tab${activeSubTab === t.id ? " insights-hub__tab--active" : ""}`}
              onClick={() => onSubTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="insights-hub__body">
        <Suspense fallback={<TabLoading />}>
          {activeSubTab === "my-productivity" && <MyProductivity state={state} />}
          {activeSubTab === "monthly-dashboard" && isAdmin && <MonthlyDashboard state={state} />}
          {activeSubTab === "designer-productivity" && isAdmin && <DesignerProductivity state={state} />}
          {activeSubTab === "team-dashboard" && isAdmin && <TeamDashboard state={state} />}
          {activeSubTab === "lumi-adoption" && isAdmin && <LumiAdoption state={state} />}
          {activeSubTab === "jira-integration" && isAdmin && <JiraIntegrationPage embedded />}
        </Suspense>
      </div>
    </div>
  );
}
