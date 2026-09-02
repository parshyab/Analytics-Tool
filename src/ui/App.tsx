import { useEffect, useState } from "react";
import type { PluginState, TabId } from "../types";
import { shouldShowConsent } from "../types";
import { WelcomeConsent } from "./components/WelcomeConsent";
import { StartSession } from "./components/StartSession";
import { ActiveSession } from "./components/ActiveSession";
import { ExportTab } from "./components/ExportTab";
import { Preferences } from "./components/Preferences";
import { PageLayout, EmptyPanel } from "./components/PageLayout";
import { PluginResizer } from "./components/PluginResizer";
import { MinimizedBar, expandPlugin, minimizePlugin } from "./components/MinimizedBar";
import { HorizontalNav } from "./components/ui/HorizontalNav";
import { StatusBanner } from "./components/ui/StatusBanner";
import { SessionContextStrip } from "./components/SessionContextStrip";
import { InsightsHub, INSIGHT_SUB_TABS } from "./components/InsightsHub";
import { IconChart, IconExport, IconSession, IconSettings } from "./components/ui/Icons";
import { usePluginState } from "./hooks";
import { safeGetItem, safeSetItem } from "./utils/safeStorage";
import type { MainMessage } from "../types";

const ADMIN_ONLY_TABS: TabId[] = [
  "monthly-dashboard",
  "designer-productivity",
  "team-dashboard",
  "lumi-adoption",
  "settings",
  "export",
  "jira-integration",
];

const INSIGHT_TAB_IDS = INSIGHT_SUB_TABS.map((t) => t.id);

function isAdminUser(state: PluginState): boolean {
  const access = state.lumiAccess;
  if (!access?.canViewAdminInsights && access?.role !== "admin") return false;
  if (access.preferredView === "designer") return false;
  return true;
}

function isInsightTab(tab: TabId): boolean {
  return INSIGHT_TAB_IDS.includes(tab);
}

type MainNavId = "session" | "insights" | "productivity" | "preferences" | "export";

function mainNavFromTab(tab: TabId): MainNavId {
  if (tab === "start-session" || tab === "active-session") return "session";
  if (tab === "privacy" || tab === "settings") return "preferences";
  if (tab === "export") return "export";
  if (tab === "my-productivity") return "productivity";
  if (isInsightTab(tab)) return "insights";
  return "session";
}

function AdminOnlyPanel({ setTab }: { setTab: (t: TabId) => void }) {
  return (
    <PageLayout narrow eyebrow="Access">
      <EmptyPanel icon="lock" title="Admin only" body="This view is for LUMI admins. Continue in Session or Preferences." />
      <button type="button" className="btn btn-primary" onClick={() => setTab("start-session")}>
        Go to Session
      </button>
    </PageLayout>
  );
}

export function App() {
  const { state, bootData, tab, setTab, error, stateLoaded } = usePluginState();
  const [minimized, setMinimized] = useState(false);
  const [showReimportHint, setShowReimportHint] = useState(false);
  const [insightSubTab, setInsightSubTab] = useState<TabId>("monthly-dashboard");

  const showWelcome = shouldShowConsent(state.consent) || tab === "welcome";
  const isAdmin = isAdminUser(state);
  const hasConsent = !!state.consent?.consentGiven;
  const mainNav = mainNavFromTab(tab);

  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      document.documentElement.dataset.theme = e.matches ? "dark" : "light";
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isInsightTab(tab)) setInsightSubTab(tab);
  }, [tab]);

  useEffect(() => {
    if (showWelcome || isAdmin) return;
    if (ADMIN_ONLY_TABS.includes(tab)) {
      setTab(hasConsent ? "start-session" : "privacy");
    }
  }, [tab, isAdmin, showWelcome, hasConsent, setTab]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage as MainMessage | undefined;
      if (msg?.type === "PLUGIN_UI_MODE") setMinimized(msg.minimized);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const stamp = bootData.uiBuildStamp;
    if (!stamp) return;
    const key = "lumi-ui-build-stamp";
    const prev = safeGetItem(key);
    if (prev && prev !== stamp) setShowReimportHint(true);
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

  const designerNav = [
    { id: "session", label: "Session", icon: <IconSession size={16} />, show: hasConsent },
    { id: "productivity", label: "Productivity", icon: <IconChart size={16} />, show: hasConsent },
    { id: "preferences", label: "Preferences", icon: <IconSettings size={16} />, show: true },
  ];

  const adminNav = [
    { id: "session", label: "Session", icon: <IconSession size={16} />, show: hasConsent },
    { id: "insights", label: "Insights", icon: <IconChart size={16} />, show: hasConsent },
    { id: "preferences", label: "Preferences", icon: <IconSettings size={16} />, show: true },
    { id: "export", label: "Export", icon: <IconExport size={16} />, show: hasConsent },
  ];

  const navTabs = isAdmin ? adminNav : designerNav;

  const onNavChange = (id: string) => {
    switch (id) {
      case "session":
        setTab(state.activeSession ? "active-session" : "start-session");
        break;
      case "productivity":
        setTab("my-productivity");
        break;
      case "preferences":
        setTab("privacy");
        break;
      case "insights":
        setTab(insightSubTab);
        break;
      case "export":
        setTab("export");
        break;
      default:
        break;
    }
  };

  return (
    <div className={`app app--${isAdmin ? "admin" : "designer"}`}>
      <header className="header header--compact">
        <div className="header__brand">
          <h1>{bootData.pluginName}</h1>
          {!stateLoaded && <span className="sync-badge">Syncing…</span>}
        </div>
        <div className="header__actions">
          {!showWelcome && !isAdmin && hasConsent && (
            <>
              <button
                type="button"
                className={`btn btn-ghost btn-sm header-action-btn${mainNav === "productivity" ? " header-action-btn--active" : ""}`}
                onClick={() => setTab("my-productivity")}
                aria-label="My productivity"
              >
                <IconChart size={16} />
              </button>
              <button
                type="button"
                className={`btn btn-ghost btn-sm header-action-btn${mainNav === "preferences" ? " header-action-btn--active" : ""}`}
                onClick={() => setTab("privacy")}
                aria-label="Preferences"
              >
                <IconSettings size={16} />
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm header-minimize-btn"
            aria-label="Minimize"
            onClick={() => {
              minimizePlugin();
              setMinimized(true);
            }}
          >
            Minimize
          </button>
        </div>
      </header>

      {!showWelcome && hasConsent && (state.activeSession || state.pendingRestoreSession || isAdmin) && (
        <SessionContextStrip state={state} session={state.activeSession} />
      )}

      {!isAdmin && !showWelcome && (
        <p className="disclaimer disclaimer--compact">Opt-in enablement insights — not performance ranking.</p>
      )}

      {showReimportHint && (
        <StatusBanner variant="reimport" onDismiss={() => setShowReimportHint(false)}>
          Re-import <code>manifest.json</code> in Figma to load the latest UI.
        </StatusBanner>
      )}

      {error && (
        <StatusBanner variant="error">
          <strong>Error:</strong> {error}
        </StatusBanner>
      )}

      {!showWelcome && isAdmin && (
        <HorizontalNav tabs={navTabs} activeId={mainNav} onChange={onNavChange} />
      )}

      <div className="layout layout--horizontal">
        <main className="content content--flush">
          {showWelcome ? (
            <WelcomeConsent
              state={state}
              onDone={() => setTab(state.activeSession ? "active-session" : "start-session")}
            />
          ) : (
            <>
              {!state.consent?.consentGiven && (
                <PageLayout narrow compact>
                  <EmptyPanel icon="lock" title="Consent required" body="Allow tracking to use sessions." />
                  <button type="button" className="btn btn-primary" onClick={() => setTab("welcome")}>
                    Review consent
                  </button>
                </PageLayout>
              )}
              <TabContent
                tab={tab}
                mainNav={mainNav}
                state={state}
                setTab={setTab}
                isAdmin={isAdmin}
                insightSubTab={insightSubTab}
                onInsightSubTab={setInsightSubTab}
              />
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
  mainNav,
  state,
  setTab,
  isAdmin,
  insightSubTab,
  onInsightSubTab,
}: {
  tab: TabId;
  mainNav: MainNavId;
  state: PluginState;
  setTab: (t: TabId) => void;
  isAdmin: boolean;
  insightSubTab: TabId;
  onInsightSubTab: (t: TabId) => void;
}) {
  if (!isAdmin && ADMIN_ONLY_TABS.includes(tab)) {
    return <AdminOnlyPanel setTab={setTab} />;
  }

  if (mainNav === "session" || tab === "start-session" || tab === "active-session") {
    return (
      <PageLayout compact>
        {state.activeSession || state.pendingRestoreSession ? (
          <ActiveSession state={state} setTab={setTab} />
        ) : (
          <StartSession state={state} onStarted={() => setTab("active-session")} />
        )}
      </PageLayout>
    );
  }

  if (mainNav === "insights" || (isAdmin && isInsightTab(tab))) {
    return (
      <PageLayout title="Insights" subtitle="Productivity and adoption dashboards." compact>
        <InsightsHub
          state={state}
          activeSubTab={insightSubTab}
          onSubTabChange={(t) => {
            onInsightSubTab(t);
            setTab(t);
          }}
          isAdmin={isAdmin}
        />
      </PageLayout>
    );
  }

  if (mainNav === "productivity" || tab === "my-productivity") {
    return (
      <PageLayout
        title="My productivity"
        subtitle="Personal enablement insights."
        compact
        actions={
          !isAdmin ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab(state.activeSession ? "active-session" : "start-session")}>
              Back to session
            </button>
          ) : undefined
        }
      >
        <InsightsHub
          state={state}
          activeSubTab="my-productivity"
          onSubTabChange={() => setTab("my-productivity")}
          isAdmin={false}
          showSubNav={false}
        />
      </PageLayout>
    );
  }

  if (mainNav === "preferences" || tab === "privacy" || tab === "settings") {
    return (
      <PageLayout
        title="Preferences"
        subtitle="Automation, consent, and configuration."
        compact
        actions={
          !isAdmin ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab(state.activeSession ? "active-session" : "start-session")}>
              Back to session
            </button>
          ) : undefined
        }
      >
        <Preferences state={state} />
      </PageLayout>
    );
  }

  if (tab === "export") {
    return (
      <PageLayout title="Export" subtitle="Reports and data downloads." compact>
        <ExportTab state={state} />
      </PageLayout>
    );
  }

  return (
    <PageLayout compact>
      <ActiveSession state={state} setTab={setTab} />
    </PageLayout>
  );
}
