import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  BootData,
  FigmaContextForJira,
  JiraBoardPayload,
  JiraSuggestionsPayload,
  MainMessage,
  PluginState,
  StartSessionContext,
  TabId,
  UIMessage,
} from "../types";
import type { DsBenchmarkDashboardPayload } from "../backend/types/designSystemRegistry";
import { shouldShowConsent } from "../types";
import { createDefaultPluginState, DEFAULT_BOOT_DATA } from "./defaultState";

const EMPTY_JIRA_BOARD: JiraBoardPayload = {
  syncState: { totalIssues: 0, totalAssignees: 0, errors: [] },
  issues: [],
  workloads: [],
  configured: false,
  connectionConfigUi: null,
  userMapping: null,
};

type DebugInfo = {
  uiMounted: boolean;
  bootDataReceived: boolean;
  lastPluginMessage: string;
  lastError: string | null;
};

type Ctx = {
  state: PluginState;
  bootData: BootData;
  tab: TabId;
  setTab: (t: TabId) => void;
  error: string | null;
  refresh: () => void;
  stateLoaded: boolean;
  debug: DebugInfo;
  liveTick: number;
  jiraPayload: JiraSuggestionsPayload | null;
  figmaContext: FigmaContextForJira | undefined;
  jiraLoading: boolean;
  startSessionContext: StartSessionContext | null;
  startSessionLoading: boolean;
  jiraBoard: JiraBoardPayload;
  requestJiraSuggestions: (flowName?: string) => void;
  refreshStartSession: (flowName?: string) => void;
  dsBenchmarkPayload: DsBenchmarkDashboardPayload | null;
};

const PluginContext = createContext<Ctx>({
  state: createDefaultPluginState(),
  bootData: DEFAULT_BOOT_DATA,
  tab: "welcome",
  setTab: () => {},
  error: null,
  refresh: () => {},
  stateLoaded: false,
  liveTick: 0,
  debug: {
    uiMounted: true,
    bootDataReceived: false,
    lastPluginMessage: "",
    lastError: null,
  },
  jiraPayload: null,
  figmaContext: undefined,
  jiraLoading: false,
  startSessionContext: null,
  startSessionLoading: false,
  jiraBoard: EMPTY_JIRA_BOARD,
  requestJiraSuggestions: () => {},
  refreshStartSession: () => {},
  dsBenchmarkPayload: null,
});

export function postMessage(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, "*");
}

export function PluginProvider({ children }: { children: ReactNode }) {
  const [bootData, setBootData] = useState<BootData>(DEFAULT_BOOT_DATA);
  const [state, setState] = useState<PluginState>(() => createDefaultPluginState());
  const [tab, setTab] = useState<TabId>("welcome");
  const [error, setError] = useState<string | null>(null);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [liveTick, setLiveTick] = useState(0);
  const [jiraPayload, setJiraPayload] = useState<JiraSuggestionsPayload | null>(null);
  const [figmaContext, setFigmaContext] = useState<FigmaContextForJira | undefined>();
  const [jiraLoading, setJiraLoading] = useState(false);
  const [startSessionContext, setStartSessionContext] = useState<StartSessionContext | null>(null);
  const [startSessionLoading, setStartSessionLoading] = useState(false);
  const [jiraBoard, setJiraBoard] = useState<JiraBoardPayload>(EMPTY_JIRA_BOARD);
  const [dsBenchmarkPayload, setDsBenchmarkPayload] = useState<DsBenchmarkDashboardPayload | null>(
    null
  );
  const [debug, setDebug] = useState<DebugInfo>({
    uiMounted: true,
    bootDataReceived: false,
    lastPluginMessage: "UI mounted",
    lastError: null,
  });
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const initialTabSetRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(() => {
    postMessage({ type: "INIT" });
  }, []);

  const applyBootData = useCallback((payload: BootData) => {
    setBootData(payload);
    if (payload.figmaContext) setFigmaContext(payload.figmaContext);
    setState((prev) => ({
      ...prev,
      currentUser: payload.user,
      fileName: payload.fileName,
    }));
    setDebug((d) => ({
      ...d,
      bootDataReceived: true,
      lastPluginMessage: "BOOT_DATA",
    }));
  }, []);

  const requestJiraSuggestions = useCallback((flowName?: string) => {
    setJiraLoading(true);
    setStartSessionLoading(true);
    postMessage({ type: "FETCH_JIRA_SUGGESTIONS", flowName });
  }, []);

  const refreshStartSession = useCallback((flowName?: string) => {
    setStartSessionLoading(true);
    postMessage({ type: "REFRESH_START_SESSION", flowName });
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage as MainMessage | undefined;
      if (!msg?.type) return;

      setDebug((d) => ({ ...d, lastPluginMessage: msg.type }));

      switch (msg.type) {
        case "BOOT_DATA":
          applyBootData(msg.payload);
          break;

        case "STATE":
          setState(msg.state);
          setStateLoaded(true);
          setError(null);
          setLiveTick((t) => t + 1);
          {
            const hasRestore = !!(
              msg.state.pendingRestoreSession || msg.state.pendingClosedSessionPrompt
            );
            const hasActive = !!msg.state.activeSession;
            const consentOk =
              !!msg.state.consent?.consentGiven && !shouldShowConsent(msg.state.consent);
            const currentTab = tabRef.current;

            // Prefer Active Session whenever a session exists (fixes UI_READY → INIT race).
            if (hasRestore || hasActive) {
              if (
                !initialTabSetRef.current ||
                currentTab === "welcome" ||
                currentTab === "start-session"
              ) {
                setTab("active-session");
              }
              initialTabSetRef.current = true;
            } else if (!initialTabSetRef.current) {
              initialTabSetRef.current = true;
              if (consentOk) {
                setTab("start-session");
              }
            }
          }
          break;

        case "NAVIGATE":
          setTab(msg.tab);
          break;

        case "ADMIN_UNLOCK_RESULT":
          if (msg.ok) {
            setError(null);
          }
          break;

        case "ERROR":
          setError(msg.message);
          setDebug((d) => ({ ...d, lastError: msg.message }));
          break;

        case "PLUGIN_ERROR":
          setError(msg.payload?.message ?? "Unknown plugin error");
          setDebug((d) => ({
            ...d,
            lastError: msg.payload?.message ?? "Unknown plugin error",
          }));
          break;

        case "EXPORT_DATA": {
          const blob = new Blob([msg.content], { type: msg.mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = msg.filename;
          a.click();
          URL.revokeObjectURL(url);
          break;
        }

        case "START_SESSION_CONTEXT":
          setStartSessionContext(msg.context);
          setStartSessionLoading(false);
          setJiraLoading(false);
          break;

        case "JIRA_BOARD_DATA":
          setJiraBoard(msg.payload);
          break;

        case "JIRA_SUGGESTIONS":
          setJiraPayload(msg.payload);
          setFigmaContext(msg.payload.figmaContext);
          setJiraLoading(false);
          break;

        case "FIGMA_CONTEXT":
          setFigmaContext(msg.figmaContext);
          break;

        case "DS_BENCHMARK_DATA":
          setDsBenchmarkPayload(msg.payload);
          break;

        default:
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    postMessage({ type: "UI_READY" });

    return () => window.removeEventListener("message", handleMessage);
  }, [applyBootData]);

  useEffect(() => {
    if (!state.activeSession) return;
    const id = setInterval(() => setLiveTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [state.activeSession?.id, state.activeSession?.lastSeenAt]);

  useEffect(() => {
    const wasHidden = { current: false };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wasHidden.current = true;
        return;
      }
      if (document.visibilityState !== "visible" || !wasHidden.current) return;
      wasHidden.current = false;
      if (stateRef.current.activeSession?.pluginHiddenAt) {
        postMessage({ type: "UI_BECAME_VISIBLE" });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return (
    <PluginContext.Provider
      value={{
        state,
        bootData,
        tab,
        setTab,
        error,
        refresh,
        stateLoaded,
        debug,
        liveTick,
        jiraPayload,
        figmaContext,
        jiraLoading,
        startSessionContext,
        startSessionLoading,
        jiraBoard,
        requestJiraSuggestions,
        refreshStartSession,
        dsBenchmarkPayload,
      }}
    >
      {children}
    </PluginContext.Provider>
  );
}

export function usePluginState() {
  return useContext(PluginContext);
}

export function KpiCard({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source?: "measured" | "benchmarked" | "calculated";
}) {
  const badgeClass =
    source === "measured"
      ? "badge-measured"
      : source === "benchmarked"
        ? "badge-benchmarked"
        : "badge-calculated";
  return (
    <div className="kpi">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
      {source && (
        <div className="source">
          <span className={`badge ${badgeClass}`}>{source}</span>
        </div>
      )}
    </div>
  );
}

export function formatMinutes(m?: number): string {
  if (m === undefined || m === null) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export function formatTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
