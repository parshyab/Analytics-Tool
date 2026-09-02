import { useEffect, useState } from "react";
import type { PluginState, TabId } from "../types";
import { shouldShowConsent } from "../types";
import { WelcomeConsent } from "./components/WelcomeConsent";
import { StartSession } from "./components/StartSession";
import { ActiveSession } from "./components/ActiveSession";
import { MyProductivity } from "./components/MyProductivity";
import { DesignerProductivity } from "./components/DesignerProductivity";
import { TeamDashboard } from "./components/TeamDashboard";
import { MonthlyDashboard } from "./components/MonthlyDashboard";
import { LumiAdoption } from "./components/LumiAdoption";
import { Settings } from "./components/Settings";
import { ExportTab } from "./components/ExportTab";
import { Privacy } from "./components/Privacy";
import { PageLayout, EmptyPanel } from "./components/PageLayout";
import { PluginResizer } from "./components/PluginResizer";
import { MinimizedBar, expandPlugin, minimizePlugin } from "./components/MinimizedBar";
import { usePluginState } from "./hooks";
import { safeGetItem, safeSetItem } from "./utils/safeStorage";
import type { MainMessage } from "../types";

type NavItem = { id: TabId; label: string; show: boolean };
type NavGroup = { label: string; items: NavItem[] };

const ADMIN_ONLY_TABS: TabId[] = [
  "monthly-dashboard",
  "designer-productivity",
  "team-dashboard",
  "lumi-adoption",
  "settings",
  "export",
  "jira-integration",
];

function isAdminUser(state: PluginState): boolean {
  const access = state.lumiAccess;
  if (!access?.canViewAdminInsights && access?.role !== "admin") return false;
  // Admins can temporarily use designer nav from Privacy
  if (access.preferredView === "designer") return false;
  return true;
}

function AdminOnlyPanel({ setTab }: { setTab: (t: TabId) => void }) {
  return (
    <PageLayout narrow eyebrow="Access">
      <EmptyPanel
        icon="🔒"
        title="Admin only"
        body="This view is available to LUMI admins. Switch to Work Sessions to continue your design work."
      />
      <button type="button" className="btn btn-primary" onClick={() => setTab("start-session")}>
        Go to Work Sessions
      </button>
    </PageLayout>
  );
}

export function App() {
  const { state, bootData, tab, setTab, error, stateLoaded } = usePluginState();
  const [minimized, setMinimized] = useState(false);
  const [showReimportHint, setShowReimportHint] = useState(false);

  const showWelcome = shouldShowConsent(state.consent) || tab === "welcome";
  const isAdmin = isAdminUser(state);
  const hasConsent = !!state.consent?.consentGiven;

  useEffect(() => {
    if (showWelcome || isAdmin) return;
    if (ADMIN_ONLY_TABS.includes(tab)) {
      setTab(hasConsent ? "start-session" : "privacy");
    }
  }, [tab, isAdmin, showWelcome, hasConsent, setTab]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage as MainMessage | undefined;
      if (msg?.type === "PLUGIN_UI_MODE") {
        setMinimized(msg.minimized);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const stamp = bootData.uiBuildStamp;
    if (!stamp) return;
    const key = "lumi-ui-build-stamp";
    const prev = safeGetItem(key);
    if (prev && prev !== stamp) {
      setShowReimportHint(true);
    }
    safeSetItem(key, stamp);
  }, [bootData.uiBuildStamp]);

  if (minimized) {
    return (
      <MinimizedBar
        pluginName={bootData.pluginName}
        session={state.activeSession}
        onExpand={() => {
          expandPlugin();
          setMinimized(false);
        }}
      />
    );
  }

  const navGroups: NavGroup[] = [
    {
      label: "Sessions",
      items: [
        { id: "start-session", label: "Work Sessions", show: hasConsent },
        { id: "active-session", label: "Active Session", show: hasConsent },
      ],
    },
    {
      label: "Insights",
      items: [
        { id: "my-productivity", label: "My Productivity", show: hasConsent },
        { id: "monthly-dashboard", label: "Trends & Monthly", show: hasConsent && isAdmin },
        { id: "designer-productivity", label: "Designers", show: hasConsent && isAdmin },
        { id: "team-dashboard", label: "Teams", show: hasConsent && isAdmin },
        { id: "lumi-adoption", label: "LUMI Adoption", show: hasConsent && isAdmin },
      ],
    },
    {
      label: "Settings",
      items: [
        { id: "privacy", label: "Privacy", show: true },
        { id: "settings", label: "Settings", show: isAdmin },
        { id: "export", label: "Export", show: hasConsent && isAdmin },
      ],
    },
  ];

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>{bootData.pluginName}</h1>
          <p className="header-subtitle">Design system enablement & productivity insights</p>
        </div>
        <div className="header-meta">
          <span>{state.fileName || bootData.fileName}</span>
          {!stateLoaded && <span className="sync-badge">Syncing…</span>}
          <div className="header-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm header-minimize-btn"
              title="Shrink panel — timer keeps running (recommended)"
              aria-label="Minimize plugin panel"
              onClick={() => {
                minimizePlugin();
                setMinimized(true);
              }}
            >
              Minimize
            </button>
          </div>
        </div>
      </header>

      <div className="disclaimer">
        Opt-in sessions for enablement insights — not performance ranking.
      </div>

      {showReimportHint && (
        <div className="banner-reimport">
          LUMI was rebuilt — re-import the plugin from <code>manifest.json</code> in Figma to load the
          latest UI.
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowReimportHint(false)}>
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="banner-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="layout">
        {!showWelcome && (
          <nav className="nav">
            {navGroups.map((group) => {
              const visible = group.items.filter((t) => t.show);
              if (visible.length === 0) return null;
              return (
                <div key={group.label}>
                  <div className="nav-group-label">{group.label}</div>
                  {visible.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={tab === t.id ? "active" : ""}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
        )}

        <main className="content">
          {showWelcome ? (
            <WelcomeConsent
              state={state}
              onDone={() => setTab(state.activeSession ? "active-session" : "start-session")}
            />
          ) : (
            <>
              {!state.consent?.consentGiven && (
                <PageLayout narrow>
                  <EmptyPanel
                    icon="🔒"
                    title="Consent required"
                    body="Allow tracking or continue anonymously to use work sessions."
                  />
                  <button type="button" className="btn btn-primary" onClick={() => setTab("welcome")}>
                    Review consent
                  </button>
                </PageLayout>
              )}
              <TabContent tab={tab} state={state} setTab={setTab} isAdmin={isAdmin} />
            </>
          )}
        </main>
      </div>

      {!showWelcome && <PluginResizer />}
    </div>
  );
}

function TabContent({
  tab,
  state,
  setTab,
  isAdmin,
}: {
  tab: TabId;
  state: PluginState;
  setTab: (t: TabId) => void;
  isAdmin: boolean;
}) {
  if (!isAdmin && ADMIN_ONLY_TABS.includes(tab)) {
    return <AdminOnlyPanel setTab={setTab} />;
  }

  switch (tab) {
    case "start-session":
      return (
        <PageLayout eyebrow="Work sessions" narrow compact>
          <StartSession state={state} onStarted={() => setTab("active-session")} />
        </PageLayout>
      );
    case "active-session":
      return (
        <PageLayout
          title="Active session"
          subtitle="Timer, pause, finish, or run in background."
          eyebrow="Live"
          compact
        >
          <ActiveSession state={state} setTab={setTab} />
        </PageLayout>
      );
    case "my-productivity":
      return (
        <PageLayout
          title="My productivity"
          subtitle="Your personal LUMI enablement insights — not a performance score."
          eyebrow="Personal"
          compact
        >
          <MyProductivity state={state} />
        </PageLayout>
      );
    case "designer-productivity":
      return (
        <PageLayout
          title="Designer workload"
          subtitle="Ticket ownership and LUMI impact by designer — executive summary, not a Jira backlog."
          eyebrow="Designers"
        >
          <DesignerProductivity state={state} />
        </PageLayout>
      );
    case "team-dashboard":
      return (
        <PageLayout title="Team dashboard" subtitle="Aggregated adoption and hours saved by team." eyebrow="Teams">
          <TeamDashboard state={state} />
        </PageLayout>
      );
    case "monthly-dashboard":
      return <MonthlyDashboard state={state} />;
    case "lumi-adoption":
      return (
        <PageLayout
          title="LUMI adoption"
          subtitle="Adoption metrics plus admin efficiency comparison vs older design systems."
          eyebrow="Adoption"
        >
          <LumiAdoption state={state} />
        </PageLayout>
      );
    case "jira-integration":
      return (
        <PageLayout title="Unavailable" eyebrow="Jira">
          <EmptyPanel
            icon="🔒"
            title="Not available"
            body="Jira integration is managed outside the plugin. Use Start Session to pick a ticket."
          />
          <button type="button" className="btn btn-primary" onClick={() => setTab("start-session")}>
            Go to Start Session
          </button>
        </PageLayout>
      );
    case "privacy":
      return (
        <PageLayout title="Privacy" subtitle="Consent, auto-start, background mode, and your data." eyebrow="Privacy" compact>
          <Privacy state={state} />
        </PageLayout>
      );
    case "settings":
      return (
        <PageLayout title="Settings" subtitle="LUMI library prefix, team name, and optional cloud scanning." eyebrow="Config" compact>
          <Settings state={state} />
        </PageLayout>
      );
    case "export":
      return (
        <PageLayout title="Export data" subtitle="Download CSV or JSON for reporting and analysis." eyebrow="Export" compact>
          <ExportTab state={state} />
        </PageLayout>
      );
    default:
      return (
        <PageLayout title="My productivity" eyebrow="Personal">
          <MyProductivity state={state} />
        </PageLayout>
      );
  }
}
