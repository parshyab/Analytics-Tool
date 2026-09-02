import type {
  LumiConsent,
  PluginSettings,
  PluginState,
  SessionTimeAdjustment,
  TabId,
  UIMessage,
  WorkSession,
  WorkType,
  WorkComplexity,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import {
  buildProfile,
  buildLumiConsent,
  canTrackSessions,
  loadLumiConsent,
  saveLumiConsent,
  deleteLumiConsent,
} from "./productivity/designerConsent";
import {
  createSession,
  finishSession,
  handleRestoreSession,
  enterBackgroundMode,
  markPluginRestored,
  pauseSession,
  resumeSession,
  buildTimeAdjustment,
  updateReportingEligibility,
  getActiveStatuses,
} from "./productivity/sessionTracker";
import {
  isMetadataCompleteFromOpts,
  sessionOptsFromContext,
  shouldAutoFinishIdleSession,
  touchSessionActivity,
} from "./productivity/sessionAutomation";
import { loadAutoStartSettings, saveAutoStartSettings } from "./productivity/autoStartStorage";
import {
  loadSettings,
  saveSettings,
  workLogStore,
} from "./productivity/workLogStore";
import {
  needsRestorePrompt,
  shouldAutoContinueSession,
  startSessionHeartbeat,
  saveActiveSessionHeartbeat,
} from "./productivity/sessionHeartbeat";
import { findBestBenchmark } from "./productivity/benchmarkEngine";
import { calculateProductivity } from "./productivity/productivityCalculator";
import { runLumiScan } from "./scanner/lumiScanner";
import { generateExport, type ExportType } from "./productivity/exportProductivity";
import { buildTrendSeries } from "./productivity/productivityTrendAggregator";
import { exportTrendCsv } from "./productivity/exportTrendCsv";
import { SharedFileRealtimeProductivityStore } from "./productivity/realtimeProductivityStore";
import { getCurrentFigmaContext } from "./productivity/figmaContext";
import { saveJiraTicketLink } from "./productivity/jiraTicketMapping";
import { buildStartSessionContext } from "./productivity/buildStartSessionContext";
import { resolveCurrentLumiRole, setDevModeEnabled, isDevModeEnabled } from "./access/devMode";
import { resolveLumiAccess, isAuthorizedAdminEmail } from "./access/lumiAdminAccess";
import { loadUiViewMode, saveUiViewMode } from "./access/uiViewMode";
import { getBundledDesignSystemRegistry } from "./integrations/designSystems/registryCacheLoader";
import {
  buildLocalDsBenchmarkDashboard,
  postProductivityToBackend,
  postScanPayloadToBackend,
} from "./productivity/dsBenchmarkLocal";
import {
  checkAnalyticsApiHealth,
  normalizeApiBase,
  sendLumiReportViaApi,
  syncPluginDataToAnalyticsApi,
} from "./productivity/analyticsApiClient";
import { buildPluginLumiReport } from "./productivity/pluginLumiReport";
import { resolveReportRecipientOptions } from "./backend/services/reportRecipients";
import type { ReportPeriod } from "./backend/services/lumiReportService";
import { reportSubject, type LumiReportBundle } from "./backend/services/lumiReportService";
import {
  compactExistingScanStorage,
  ensureScanStorageMigrated,
  getAllScanSnapshotsFromStorage,
} from "./productivity/scanStorage";
import { isJiraConnectionConfigured, testJiraConnection } from "./integrations/jira/jiraDataSource";
import { formatPluginError } from "./integrations/jira/jiraErrors";
import { debounce } from "./scanner/debounce";
import { syncUxBoardTickets } from "./integrations/jira/jiraBoardSync";
import {
  clearAllJiraData,
  loadFigmaToJiraUserMapping,
  loadJiraConnectionConfig,
  loadJiraConnectionConfigForUi,
  loadJiraBoardSyncState,
  loadSyncedJiraIssues,
  resolveJiraConnectionConfig,
  saveFigmaToJiraUserMapping,
  saveJiraConnectionConfigFromUi,
  saveJiraBoardSyncState,
  saveSyncedJiraIssues,
} from "./integrations/jira/jiraStore";
import { groupIssuesByAssignee } from "./integrations/jira/jiraTicketMapper";

import {
  clampPluginUiSize,
  PLUGIN_UI_SIZE,
  UI_SIZE_STORAGE_KEY,
  UI_MINIMIZED_STORAGE_KEY,
  type PluginUiSize,
} from "./pluginUiSize";

const UI_WIDTH = PLUGIN_UI_SIZE.defaultWidth;
const UI_HEIGHT = PLUGIN_UI_SIZE.defaultHeight;

/** Faster, safer traversal — we only read nodes for analytics, never edit instance interiors. */
figma.skipInvisibleInstanceChildren = true;

const store = workLogStore;
const sharedTrendStore = new SharedFileRealtimeProductivityStore();

const ANALYTICS_API_URL = normalizeApiBase(
  typeof __LUMI_ANALYTICS_API_URL__ === "string" && __LUMI_ANALYTICS_API_URL__.trim().length > 0
    ? __LUMI_ANALYTICS_API_URL__
    : "http://localhost:8788"
);

const ANALYTICS_OWNER_KEY =
  typeof __LUMI_ANALYTICS_OWNER_KEY__ === "string" ? __LUMI_ANALYTICS_OWNER_KEY__.trim() : "";

function postReportBundleExports(bundle: LumiReportBundle, period: ReportPeriod): void {
  figma.ui.postMessage({
    type: "EXPORT_DATA",
    filename: `lumi-report-${period}.html`,
    content: bundle.html,
    mimeType: "text/html",
  });
  figma.ui.postMessage({
    type: "EXPORT_DATA",
    filename: `lumi-designers-${period}.csv`,
    content: bundle.designerCsv,
    mimeType: "text/csv",
  });
  figma.ui.postMessage({
    type: "EXPORT_DATA",
    filename: `lumi-adoption-scans-${period}.csv`,
    content: bundle.adoptionCsv,
    mimeType: "text/csv",
  });
}

async function postDsBenchmarkData(scans: import("./types").LumiScanSnapshot[]): Promise<void> {
  const registry = getBundledDesignSystemRegistry();
  const payload = buildLocalDsBenchmarkDashboard(scans, registry.syncedAt);
  figma.ui.postMessage({ type: "DS_BENCHMARK_DATA", payload });
}

function getFallbackHtml(): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f7f8;
        color: #1f1f1f;
      }
      .fallback { padding: 32px; }
      .card {
        background: white;
        border: 1px solid #e5e5e5;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.08);
      }
      h1 { margin: 0 0 8px; font-size: 24px; color: #6c5ce7; }
      p { margin: 0; color: #666; }
    </style>
  </head>
  <body>
    <div class="fallback">
      <div class="card">
        <h1>LUMI Analytics</h1>
        <p>Fallback UI loaded. Re-run <code>npm run build</code> to bundle the full dashboard.</p>
      </div>
    </div>
  </body>
</html>`;
}

function sendBootData(flowName?: string): void {
  void (async () => {
    try {
      const userId = await getUserId();
      const designerEmail = await getDesignerEmail(userId);
      const figmaContext = await getCurrentFigmaContext();
      const devModeEnabled = await isDevModeEnabled();
      figma.ui.postMessage({
        type: "BOOT_DATA",
        payload: {
          pluginName: "LUMI Analytics",
          fileName: figma.root?.name ?? "Untitled",
          fileKey: figma.fileKey ?? null,
          currentPageName: figma.currentPage?.name ?? "Page",
          user: figma.currentUser
            ? {
                id: figma.currentUser.id,
                name: figma.currentUser.name,
                photoUrl: figma.currentUser.photoUrl ?? undefined,
              }
            : null,
          figmaContext,
          designerEmail,
          devModeEnabled,
          uiBuildStamp:
            typeof __LUMI_UI_BUILD_STAMP__ === "string" ? __LUMI_UI_BUILD_STAMP__ : undefined,
        },
      });
    } catch (error) {
      console.warn("[LUMI] boot data failed:", error);
      figma.ui.postMessage({
        type: "BOOT_DATA",
        payload: {
          pluginName: "LUMI Analytics",
          fileName: figma.root?.name ?? "Untitled",
          fileKey: figma.fileKey ?? null,
          currentPageName: figma.currentPage?.name ?? "Page",
          user: figma.currentUser
            ? {
                id: figma.currentUser.id,
                name: figma.currentUser.name,
                photoUrl: figma.currentUser.photoUrl ?? undefined,
              }
            : null,
          designerEmail: undefined,
          devModeEnabled: false,
          uiBuildStamp:
            typeof __LUMI_UI_BUILD_STAMP__ === "string" ? __LUMI_UI_BUILD_STAMP__ : undefined,
        },
      });
    }
  })();
}

async function loadSavedUiSize(): Promise<PluginUiSize> {
  try {
    const saved = (await figma.clientStorage.getAsync(UI_SIZE_STORAGE_KEY)) as
      | Partial<PluginUiSize>
      | undefined;
    if (saved?.width && saved?.height) {
      return clampPluginUiSize(saved.width, saved.height);
    }
  } catch {
    /* use defaults */
  }
  return { width: UI_WIDTH, height: UI_HEIGHT };
}

async function openPluginUI(): Promise<void> {
  const html =
    typeof __html__ === "string" && __html__.trim().length > 0
      ? __html__
      : getFallbackHtml();

  const size = await loadSavedUiSize();

  figma.showUI(html, {
    width: size.width,
    height: size.height,
    themeColors: true,
    title: "LUMI Analytics",
  });

  sendBootData();
}

void openPluginUI();

figma.on("close", () => {
  void (async () => {
    try {
      const userId = await getUserId();
      const settings = await loadMergedSettings();
      const active = await store.getActiveSession(userId);
      if (!active || !getActiveStatuses().includes(active.status)) return;

      if (settings.autoStart.autoFinishOnClose) {
        await completeActiveSession(active, settings, settings.autoStart.autoScanOnFinish);
      } else if (active.status === "active") {
        await store.updateSession(pauseSession(active));
      }
    } catch {
      /* best-effort — plugin may terminate before async save completes */
    }
  })();
});

async function getCurrentUser(): Promise<{ id: string; name: string; photoUrl?: string } | null> {
  const user = figma.currentUser;
  if (!user) return null;
  return { id: user.id, name: user.name, photoUrl: user.photoUrl ?? undefined };
}

async function getUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user?.id ?? "local-user";
}

async function getDesignerEmail(userId: string): Promise<string | undefined> {
  const profile = await store.getDesignerProfile(userId);
  const consent = await loadLumiConsent();
  return profile?.email?.trim() || consent?.email?.trim() || undefined;
}

async function postStartSessionContext(flowName?: string): Promise<void> {
  try {
    const userId = await getUserId();
    const profile = await store.getDesignerProfile(userId);
    const context = await buildStartSessionContext({
      userId,
      profile,
      flowName,
    });
    figma.ui.postMessage({ type: "START_SESSION_CONTEXT", context });
  } catch (error) {
    // Document traversal can fail on newer/unsupported node types — degrade gracefully.
    console.warn("[LUMI] start session context failed:", error);
    const userId = await getUserId();
    const profile = await store.getDesignerProfile(userId);
    figma.ui.postMessage({
      type: "START_SESSION_CONTEXT",
      context: {
        designerUserId: userId,
        designerName: profile?.name ?? figma.currentUser?.name ?? "Designer",
        fileName: figma.root?.name ?? "Untitled",
        fileKey: figma.fileKey ?? null,
        pageName: figma.currentPage?.name ?? "Page",
        parentPath: [figma.currentPage?.name ?? "Page"],
        jiraSuggestions: [],
        suggestedScanScope: "current-page",
        scanScopeLabel: "Current page",
        jiraConfigured: false,
        jiraSynced: false,
        jiraFetchError: "Select a manual ticket or continue without Jira.",
        jiraIssueCount: 0,
      },
    });
  }
}

const debouncedPostStartSessionContext = debounce((flowName?: string) => {
  void postStartSessionContext(flowName);
}, 400);

async function postJiraBoardData(userId: string): Promise<void> {
  const connectionConfig = await loadJiraConnectionConfig();
  const syncState = await loadJiraBoardSyncState();
  const issues = await loadSyncedJiraIssues();
  const userMapping = await loadFigmaToJiraUserMapping(userId);
  const profile = await store.getDesignerProfile(userId);
  const consent = await loadLumiConsent();
  const roleInfo = await resolveCurrentLumiRole({
    profile,
    consentEmail: consent?.email,
    devModeEnabled: await isDevModeEnabled(),
  });
  const connectionConfigUi = roleInfo.devModeEnabled
    ? await loadJiraConnectionConfigForUi({ isOwner: true })
    : null;

  figma.ui.postMessage({
    type: "JIRA_BOARD_DATA",
    payload: {
      syncState: syncState ?? {
        totalIssues: issues.length,
        totalAssignees: groupIssuesByAssignee(issues).filter((w) => w.designerName !== "Unassigned").length,
        errors: [],
      },
      issues,
      workloads: groupIssuesByAssignee(issues),
      configured: isJiraConnectionConfigured(connectionConfig ?? {}),
      connectionConfigUi,
      userMapping,
      isOwner: roleInfo.devModeEnabled,
      devModeEnabled: roleInfo.devModeEnabled,
      ownerReason: roleInfo.reason,
    },
  });
}

figma.on("selectionchange", () => {
  debouncedPostStartSessionContext();
  debouncedTouchSessionActivity();
});

const debouncedTouchSessionActivity = debounce(() => {
  void (async () => {
    try {
      const userId = await getUserId();
      const active = await store.getActiveSession(userId);
      if (!active || !getActiveStatuses().includes(active.status)) return;
      await store.updateSession(touchSessionActivity(active));
    } catch {
      /* non-fatal */
    }
  })();
}, 800);

async function loadMergedSettings(): Promise<PluginSettings> {
  const base = await loadSettings<PluginSettings>(DEFAULT_SETTINGS);
  const autoStart = await loadAutoStartSettings();
  return { ...base, autoStart, updatedAt: new Date().toISOString() };
}

async function buildState(restorePrompt?: WorkSession | null): Promise<PluginState> {
  const user = await getCurrentUser();
  const userId = await getUserId();
  const consent = await loadLumiConsent();
  const profile = await store.getDesignerProfile(userId);
  const settings = await loadMergedSettings();
  const activeSession = await store.getActiveSession(userId);
  const sessions = await store.getSessions();
  const scans = await getAllScanSnapshotsFromStorage();
  const productivityResults = await store.getProductivityResults();
  const benchmarks = await store.getBenchmarks();
  const jiraConnectionConfig = await loadJiraConnectionConfig();
  const jiraBoardSyncState = await loadJiraBoardSyncState();
  const jiraIssueCount = (await loadSyncedJiraIssues()).length;
  const devModeEnabled = await isDevModeEnabled();
  const figmaEmail = (figma.currentUser as { email?: string } | null)?.email;
  const lumiAccessResolved = resolveLumiAccess({
    profile,
    consentEmail: consent?.email,
    devModeEnabled,
    currentUserEmail: figmaEmail,
  });
  const preferredView =
    lumiAccessResolved.canViewAdminInsights
      ? await loadUiViewMode()
      : "designer";

  return {
    consent,
    profile,
    settings,
    activeSession,
    sessions,
    scans,
    productivityResults,
    benchmarks,
    currentUser: user,
    fileName: figma.root.name,
    pendingRestoreSession: restorePrompt ?? undefined,
    pendingClosedSessionPrompt: restorePrompt ?? undefined,
    jiraBoardSyncState,
    jiraIssueCount,
    jiraConfigured: isJiraConnectionConfigured(jiraConnectionConfig ?? {}),
    devModeEnabled,
    dsRegistrySyncedAt: getBundledDesignSystemRegistry().syncedAt,
    lumiAccess: {
      role: lumiAccessResolved.role,
      canViewAdminInsights: lumiAccessResolved.canViewAdminInsights,
      reason: lumiAccessResolved.reason,
      preferredView,
    },
    reportRecipientOptions: resolveReportRecipientOptions(
      typeof __LUMI_REPORT_RECIPIENT_OPTIONS__ === "string"
        ? __LUMI_REPORT_RECIPIENT_OPTIONS__
        : undefined
    ),
  };
}

async function postState(restorePrompt?: WorkSession | null): Promise<void> {
  figma.ui.postMessage({ type: "STATE", state: await buildState(restorePrompt) });
}

function navigateToTab(tab: TabId): void {
  figma.ui.postMessage({ type: "NAVIGATE", tab });
}

async function restoreUiFromBackground(): Promise<void> {
  const userId = await getUserId();
  const active = await store.getActiveSession(userId);
  const wasBackground = !!active?.pluginHiddenAt;

  const size = await loadSavedUiSize();
  figma.ui.resize(size.width, size.height);
  void figma.clientStorage.setAsync(UI_MINIMIZED_STORAGE_KEY, false);
  figma.ui.postMessage({ type: "PLUGIN_UI_MODE", minimized: false });

  if (active?.pluginHiddenAt && !active.pluginRestoredAt) {
    await store.updateSession(markPluginRestored(active));
  }
  await postState();
  if (active && wasBackground) {
    navigateToTab("active-session");
  }
}

let storageMaintenanceDone = false;

async function runStorageMaintenanceOnce(): Promise<void> {
  if (storageMaintenanceDone) return;
  storageMaintenanceDone = true;
  try {
    await ensureScanStorageMigrated();
    await compactExistingScanStorage();
  } catch {
    storageMaintenanceDone = false;
  }
}

async function completeActiveSession(
  session: WorkSession,
  settings: PluginSettings,
  runScan: boolean
): Promise<void> {
  if (!getActiveStatuses().includes(session.status)) return;

  const adjustment = buildTimeAdjustment(session);
  let finished = finishSession(session, adjustment);
  finished = updateReportingEligibility(finished, settings);
  await store.updateSession(finished);

  if (!runScan || !settings.autoStart.autoScanOnFinish) return;

  const snapshot = await runLumiScan(
    finished,
    settings.lumiLibraryPrefix,
    settings.figmaApiToken,
    settings.figmaTeamIds?.[0]
  );
  await store.saveScanSnapshot(snapshot);

  if (snapshot.systemClassification) {
    void postScanPayloadToBackend(snapshot.systemClassification, ANALYTICS_API_URL);
  }

  const allScans = await getAllScanSnapshotsFromStorage();
  await postDsBenchmarkData(allScans);

  const allSessions = await store.getSessions();
  const finishedSessions = allSessions.filter((x) => x.status === "finished");
  const benchmarks = await store.getBenchmarks();
  const benchmark = findBestBenchmark(
    {
      projectName: finished.projectName,
      flowName: finished.flowName,
      workType: finished.workType,
      complexity: finished.complexity,
      platform: finished.platform,
    },
    finishedSessions,
    benchmarks
  );

  const result = calculateProductivity(finished, snapshot, benchmark);
  await store.saveProductivityResult(result);
  await sharedTrendStore.publishFinishedSession(result);
  void postProductivityToBackend({ result, session: finished }, ANALYTICS_API_URL);
  figma.ui.postMessage({ type: "SCAN_COMPLETE", snapshot, result });
}

async function maybeAutoHideAfterStart(settings: PluginSettings): Promise<void> {
  if (!settings.autoStart.autoHideOnStart || !settings.autoStart.keepSessionWhenHidden) return;

  const userId = await getUserId();
  const active = await store.getActiveSession(userId);
  if (!active || active.pluginHiddenAt) return;

  const updated = enterBackgroundMode(active);
  await store.updateSession(updated);
  figma.ui.hide();
  figma.notify("LUMI is tracking your session in the background.", { timeout: 6000 });
}

async function autoStartSession(
  userId: string,
  consent: LumiConsent,
  settings: PluginSettings
): Promise<WorkSession | null> {
  if (!canTrackSessions(consent) || !settings.autoStart.enabled) return null;

  const existing = await store.getActiveSession(userId);
  if (existing) return existing;

  const user = await getCurrentUser();
  const profile =
    (await store.getDesignerProfile(userId)) ??
    buildProfile(userId, consent.name ?? settings.manualName ?? user?.name ?? "Designer", {
      teamName: consent.teamName ?? settings.teamName,
      consentGiven: true,
      anonymous: consent.mode === "anonymous",
    });

  const context = await buildStartSessionContext({ userId, profile });
  const inferredOpts = settings.autoStart.autoFillMetadata
    ? sessionOptsFromContext(context)
    : { scanScope: context.suggestedScanScope };

  const metadataReady = isMetadataCompleteFromOpts(inferredOpts);
  const startAsDraft =
    settings.autoStart.startAsDraft && !metadataReady;

  const session = createSession(
    profile,
    { scanScope: context.suggestedScanScope, ...inferredOpts },
    startAsDraft
  );
  const withActivity = touchSessionActivity(session);
  await store.saveSession(withActivity);
  return withActivity;
}

async function init(): Promise<void> {
  const userId = await getUserId();
  const consent = await loadLumiConsent();
  const settings = await loadMergedSettings();

  let active = await store.getActiveSession(userId);
  let createdNewSession = false;

  if (active && needsRestorePrompt(active)) {
    if (settings.autoStart.autoFinishStaleSessions) {
      await completeActiveSession(active, settings, settings.autoStart.autoScanOnFinish);
      figma.notify("Previous session auto-finished.");
      active = null;
    } else {
      await postState(active);
      return;
    }
  }

  if (active && shouldAutoContinueSession(active)) {
    active = markPluginRestored(active);
    await store.updateSession(active);
  } else if (!active && consent && canTrackSessions(consent)) {
    active = await autoStartSession(userId, consent, settings);
    createdNewSession = !!active;
  } else if (active && active.pluginHiddenAt && !active.pluginRestoredAt) {
    active = markPluginRestored(active);
    await store.updateSession(active);
  }

  await postState();

  if (createdNewSession && active) {
    await maybeAutoHideAfterStart(settings);
  }
}

startSessionHeartbeat(
  async () => store.getActiveSession(await getUserId()),
  async (session) => {
    await saveActiveSessionHeartbeat(session);
    try {
      const settings = await loadMergedSettings();
      const idleMin = settings.autoStart.autoFinishIdleMinutes;
      if (idleMin > 0 && shouldAutoFinishIdleSession(session, idleMin)) {
        await completeActiveSession(session, settings, settings.autoStart.autoScanOnFinish);
        await postState();
        figma.notify("Session auto-finished (idle timeout).");
      }
    } catch {
      /* heartbeat must not crash plugin */
    }
  }
);

figma.ui.onmessage = async (msg: UIMessage) => {
  try {
    if (!msg || !msg.type) return;

    const userId = await getUserId();
    const user = await getCurrentUser();

    switch (msg.type) {
      case "UI_READY":
      case "RELOAD_UI": {
        sendBootData();
        // Run full init (auto-start / resume) before background maintenance so the first
        // settled STATE already includes an active session when possible.
        await init();
        void (async () => {
          await runStorageMaintenanceOnce();
          await postStartSessionContext();
          await postJiraBoardData(userId);
          const scans = await getAllScanSnapshotsFromStorage();
          await postDsBenchmarkData(scans);
          const active = await store.getActiveSession(userId);
          if (active?.pluginHiddenAt && !active.pluginRestoredAt) {
            await store.updateSession(markPluginRestored(active));
            await postState();
          }
        })();
        break;
      }

      case "INIT":
        await init();
        break;

      case "SAVE_CONSENT": {
        await saveLumiConsent(msg.consent);
        await store.saveDesignerProfile(msg.profile);
        if (msg.consent.teamName || msg.profile.teamName) {
          const settings = await loadMergedSettings();
          await saveSettings({
            ...settings,
            teamName: msg.consent.teamName ?? msg.profile.teamName,
            updatedAt: new Date().toISOString(),
          });
        }
        if (canTrackSessions(msg.consent)) {
          const settings = await loadMergedSettings();
          const started = await autoStartSession(userId, msg.consent, settings);
          if (started) await maybeAutoHideAfterStart(settings);
        }
        await postState();
        break;
      }

      case "SWITCH_TO_ANONYMOUS": {
        const existing = await loadLumiConsent();
        if (!existing) break;
        const anonymous = buildLumiConsent("anonymous", {
          userId: existing.userId ?? userId,
          teamName: existing.teamName,
        });
        await saveLumiConsent(anonymous);
        await postState();
        break;
      }

      case "SAVE_AUTOSTART":
        await saveAutoStartSettings(msg.autoStart);
        await postState();
        break;

      case "RUN_IN_BACKGROUND": {
        const sessions = await store.getSessions();
        const s = sessions.find((x) => x.id === msg.sessionId);
        if (!s) break;
        const settings = await loadMergedSettings();
        if (!settings.autoStart.keepSessionWhenHidden) {
          figma.ui.resize(PLUGIN_UI_SIZE.minimizedWidth, PLUGIN_UI_SIZE.minimizedHeight);
          void figma.clientStorage.setAsync(UI_MINIMIZED_STORAGE_KEY, true);
          figma.ui.postMessage({ type: "PLUGIN_UI_MODE", minimized: true });
          figma.notify("Session keeps running. Panel minimized — click Expand to reopen.");
          break;
        }
        const updated = enterBackgroundMode(s);
        await store.updateSession(updated);
        await postState();
        figma.ui.hide();
        figma.notify(
          "Timer running — click “Running LUMI Analytics” at the bottom to reopen. Cancel on that bar stops LUMI.",
          {
            timeout: Infinity,
            button: {
              text: "Open session",
              action: () => {
                figma.ui.show();
                void restoreUiFromBackground();
                return true;
              },
            },
          }
        );
        break;
      }

      case "UI_BECAME_VISIBLE":
        await restoreUiFromBackground();
        break;

      case "RESTORE_SESSION":
      case "HANDLE_CLOSED_TIME": {
        const sessions = await store.getSessions();
        const s = sessions.find((x) => x.id === msg.sessionId);
        if (!s) break;

        const action =
          msg.type === "RESTORE_SESSION"
            ? msg.action
            : msg.action === "count"
              ? "continue"
              : msg.action === "manual"
                ? "edit"
                : msg.action;

        const result = handleRestoreSession(
          s,
          action as "continue" | "pause" | "edit" | "finish" | "discard",
          msg.manualMinutes
        );

        if (result === "finish") {
          const adjustment = buildTimeAdjustment(s);
          const finished = finishSession(s, adjustment);
          await store.updateSession(finished);
          await postState();
          navigateToTab("start-session");
          break;
        }

        if (result === null) {
          await store.updateSession({
            ...s,
            status: "cancelled",
            updatedAt: new Date().toISOString(),
          });
          await postState();
          navigateToTab("start-session");
          break;
        } else {
          await store.updateSession(result);
        }
        await postState();
        break;
      }

      case "DISMISS_RESTORE":
        await postState();
        break;

      case "START_SESSION": {
        const consent = await loadLumiConsent();
        if (!canTrackSessions(consent)) {
          figma.ui.postMessage({ type: "ERROR", message: "Consent required to start a session." });
          break;
        }
        const existing = await store.getActiveSession(userId);
        if (existing) {
          figma.ui.postMessage({ type: "ERROR", message: "An active session already exists." });
          await postState();
          break;
        }
        const profile =
          (await store.getDesignerProfile(userId)) ??
          buildProfile(userId, user?.name ?? "Designer", { consentGiven: true });
        const session = createSession(profile, msg.session as Partial<WorkSession>);
        await store.saveSession(session);
        await postState();
        break;
      }

      case "UPDATE_SESSION":
        await store.updateSession(msg.session);
        await postState();
        break;

      case "PAUSE_SESSION": {
        const sessions = await store.getSessions();
        const s = sessions.find((x) => x.id === msg.sessionId);
        if (s) await store.updateSession(pauseSession(s));
        await postState();
        break;
      }

      case "RESUME_SESSION": {
        const sessions = await store.getSessions();
        const s = sessions.find((x) => x.id === msg.sessionId);
        if (s) await store.updateSession(resumeSession(s));
        await postState();
        break;
      }

      case "FINISH_SESSION":
      case "RUN_SCAN": {
        const sessions = await store.getSessions();
        const s = sessions.find((x) => x.id === msg.sessionId);
        if (!s) break;

        let finished = s;
        if (msg.type === "FINISH_SESSION") {
          finished = finishSession(s, msg.adjustment as SessionTimeAdjustment);
          await store.updateSession(finished);
        }

        const settings = await loadMergedSettings();
        const shouldScan =
          msg.type === "RUN_SCAN" || (msg.type === "FINISH_SESSION" && msg.runScan);

        if (shouldScan) {
          const snapshot = await runLumiScan(
            finished,
            settings.lumiLibraryPrefix,
            settings.figmaApiToken,
            settings.figmaTeamIds?.[0]
          );
          await store.saveScanSnapshot(snapshot);

          if (snapshot.systemClassification) {
            void postScanPayloadToBackend(snapshot.systemClassification, ANALYTICS_API_URL);
          }

          const allScans = await getAllScanSnapshotsFromStorage();
          await postDsBenchmarkData(allScans);

          const allSessions = await store.getSessions();
          const finishedSessions = allSessions.filter((x) => x.status === "finished");
          const benchmarks = await store.getBenchmarks();
          const benchmark = findBestBenchmark(
            {
              projectName: finished.projectName,
              flowName: finished.flowName,
              workType: finished.workType,
              complexity: finished.complexity,
              platform: finished.platform,
            },
            finishedSessions,
            benchmarks
          );

          const result = calculateProductivity(finished, snapshot, benchmark);
          await store.saveProductivityResult(result);
          await sharedTrendStore.publishFinishedSession(result);
          void postProductivityToBackend({ result, session: finished }, ANALYTICS_API_URL);
          figma.ui.postMessage({ type: "SCAN_COMPLETE", snapshot, result });
        }

        await postState();
        if (msg.type === "FINISH_SESSION") {
          navigateToTab("start-session");
        }
        break;
      }

      case "DISCARD_SESSION": {
        const sessions = await store.getSessions();
        const s = sessions.find((x) => x.id === msg.sessionId);
        if (s) {
          await store.updateSession({
            ...s,
            status: "cancelled",
            updatedAt: new Date().toISOString(),
          });
        }
        await postState();
        navigateToTab("start-session");
        break;
      }

      case "SAVE_SETTINGS": {
        await saveSettings(msg.settings);
        await saveAutoStartSettings(msg.settings.autoStart);
        await postState();
        break;
      }

      case "DELETE_LOCAL_DATA":
        await store.deleteAllLocalData();
        await deleteLumiConsent();
        await postState();
        break;

      case "ZOOM_TO_NODE": {
        const node = await figma.getNodeByIdAsync(msg.nodeId);
        if (node && "visible" in node) {
          figma.currentPage.selection = [node as SceneNode];
          figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
        }
        break;
      }

      case "GET_EXPORT": {
        const state = await buildState();
        if (
          msg.exportType === "lumi-efficiency-vs-legacy" &&
          !state.lumiAccess?.canViewAdminInsights
        ) {
          figma.ui.postMessage({
            type: "ERROR",
            message: "LUMI efficiency export requires admin access.",
          });
          break;
        }
        const exportData = generateExport(msg.exportType as ExportType, {
          sessions: state.sessions,
          scans: state.scans,
          results: state.productivityResults,
          benchmarks: state.benchmarks,
          settings: state.settings,
          profile: state.profile,
          dsRegistrySyncedAt: state.dsRegistrySyncedAt,
        }, msg.includeEmails);
        figma.ui.postMessage({
          type: "EXPORT_DATA",
          filename: exportData.filename,
          content: exportData.content,
          mimeType: exportData.mimeType,
        });
        break;
      }

      case "GET_TREND_EXPORT": {
        const state = await buildState();
        const consent = await loadLumiConsent();
        const series = await buildTrendSeries(
          state.productivityResults,
          state.sessions,
          msg.filters,
          {
            consent,
            currentUserId: userId,
            teamName: state.settings.teamName ?? state.profile?.teamName,
          }
        );
        const exportData = exportTrendCsv(series);
        figma.ui.postMessage({
          type: "EXPORT_DATA",
          filename: exportData.filename,
          content: exportData.content,
          mimeType: exportData.mimeType,
        });
        break;
      }

      case "FETCH_JIRA_SUGGESTIONS":
      case "REFRESH_START_SESSION":
        await postStartSessionContext(msg.flowName);
        break;

      case "SAVE_JIRA_TICKET_LINK": {
        const selection = figma.currentPage?.selection?.[0];
        saveJiraTicketLink({
          ...msg.link,
          fileKey: figma.fileKey ?? null,
          nodeId: selection?.id ?? msg.link.nodeId,
          nodeName: selection?.name ?? msg.link.nodeName,
        });
        break;
      }

      case "SAVE_JIRA_CONNECTION_CONFIG":
      case "SAVE_JIRA_ADMIN_CONFIG": {
        await saveJiraConnectionConfigFromUi(msg.config);
        await postJiraBoardData(userId);
        await postState();
        break;
      }

      case "TEST_JIRA_CONNECTION": {
        const config = await resolveJiraConnectionConfig(msg.config);
        if (!config) {
          figma.ui.postMessage({
            type: "JIRA_TEST_RESULT",
            ok: false,
            message: "Jira connection settings are not available.",
            cause: "unknown",
          });
          break;
        }
        const result = await testJiraConnection(config);
        figma.ui.postMessage({
          type: "JIRA_TEST_RESULT",
          ok: result.ok,
          message: result.details && !result.ok ? `${result.message}\n\n${result.details}` : result.message,
          cause: result.cause,
          status: result.status,
        });
        break;
      }

      case "SYNC_JIRA_BOARD": {
        const config = await resolveJiraConnectionConfig(msg.config);
        if (!config) {
          figma.ui.postMessage({
            type: "JIRA_SYNC_RESULT",
            ok: false,
            message: "Jira connection settings are not available.",
          });
          break;
        }

        if (config.dataSourceMode === "env-cache") {
          await postJiraBoardData(userId);
          await postStartSessionContext();
          await postState();
          const issues = await loadSyncedJiraIssues();
          figma.ui.postMessage({
            type: "JIRA_SYNC_RESULT",
            ok: true,
            message:
              issues.length > 0
                ? `Loaded ${issues.length} UX tickets from bundled Jira cache.`
                : "Bundled Jira cache is empty. Run npm run sync:jira locally, then npm run build.",
          });
          break;
        }

        if (!isJiraConnectionConfigured(config)) {
          figma.ui.postMessage({
            type: "JIRA_SYNC_RESULT",
            ok: false,
            message: "Configure your Jira connection before syncing UX tickets.",
          });
          break;
        }
        const result = await syncUxBoardTickets(config);
        if (result.issues.length > 0) {
          await saveSyncedJiraIssues(result.issues);
        }
        await saveJiraBoardSyncState(result.syncState);
        if (msg.config) {
          await saveJiraConnectionConfigFromUi({
            ...msg.config,
            lastSyncedAt: result.syncState.lastSyncedAt,
          });
        } else {
          await saveJiraConnectionConfigFromUi({ lastSyncedAt: result.syncState.lastSyncedAt });
        }
        await postJiraBoardData(userId);
        await postStartSessionContext();
        await postState();
        if (result.syncState.errors.length > 0) {
          figma.ui.postMessage({
            type: "JIRA_SYNC_RESULT",
            ok: false,
            message: result.syncState.errors[0],
          });
        } else {
          figma.ui.postMessage({
            type: "JIRA_SYNC_RESULT",
            ok: true,
            message: "Synced UX tickets from Jira.",
          });
        }
        break;
      }

      case "LOAD_JIRA_BOARD":
        await postJiraBoardData(userId);
        break;

      case "CLEAR_JIRA_CREDENTIALS":
        await clearAllJiraData();
        await postJiraBoardData(userId);
        await postStartSessionContext();
        await postState();
        break;

      case "SAVE_JIRA_USER_MAPPING":
        await saveFigmaToJiraUserMapping(msg.mapping);
        await postJiraBoardData(userId);
        await postStartSessionContext();
        break;

      case "SET_DEV_OWNER_OVERRIDE":
      case "SET_DEV_MODE":
        await setDevModeEnabled(msg.enabled);
        await postJiraBoardData(userId);
        await postState();
        break;

      case "SET_UI_VIEW_MODE": {
        const state = await buildState();
        if (!state.lumiAccess?.canViewAdminInsights) {
          figma.ui.postMessage({
            type: "ERROR",
            message: "Only unlocked admins can switch view mode.",
          });
          break;
        }
        const mode = msg.mode === "designer" ? "designer" : "admin";
        await saveUiViewMode(mode);
        await postState();
        navigateToTab(mode === "designer" ? "start-session" : "lumi-adoption");
        break;
      }

      case "UNLOCK_ADMIN": {
        const email = msg.email?.trim() ?? "";
        if (!email || !email.includes("@")) {
          figma.ui.postMessage({
            type: "ADMIN_UNLOCK_RESULT",
            ok: false,
            message: "Enter a valid email address.",
          });
          break;
        }

        if (!isAuthorizedAdminEmail(email)) {
          figma.ui.postMessage({
            type: "ADMIN_UNLOCK_RESULT",
            ok: false,
            message: "This email is not authorized for admin access.",
          });
          break;
        }

        const existingConsent = await loadLumiConsent();
        const existingProfile = await store.getDesignerProfile(userId);
        const displayName =
          existingProfile?.name ??
          existingConsent?.name ??
          user?.name ??
          "Admin";

        const profile = buildProfile(userId, displayName, {
          email,
          teamName: existingProfile?.teamName ?? existingConsent?.teamName,
          role: "admin",
          consentGiven: existingConsent?.consentGiven ?? existingProfile?.consentGiven ?? true,
        });
        await store.saveDesignerProfile(profile);

        if (existingConsent) {
          await saveLumiConsent({
            ...existingConsent,
            email,
            name: existingConsent.name ?? displayName,
            updatedAt: new Date().toISOString(),
          });
        }

        await saveUiViewMode("admin");
        await postState();
        figma.ui.postMessage({
          type: "ADMIN_UNLOCK_RESULT",
          ok: true,
          message: "Admin access unlocked. Opening LUMI Adoption.",
        });
        navigateToTab(
          existingConsent?.consentGiven ? "lumi-adoption" : "privacy"
        );
        break;
      }

      case "CHECK_ANALYTICS_API": {
        const health = await checkAnalyticsApiHealth(ANALYTICS_API_URL, ANALYTICS_OWNER_KEY);
        let emailHint: string | undefined;
        if (health.ok && health.email) {
          if (health.email.liveSendReady) {
            emailHint = "SMTP configured — Send report will email recipients.";
          } else if (!health.email.configured || !health.email.hasCredentials) {
            emailHint =
              "Add LUMI_SMTP_* credentials in .env (Google App Password) and restart analytics-api.";
          } else if (health.email.dryRunDefault) {
            emailHint = "Set LUMI_REPORT_DRY_RUN=false in .env for live email.";
          }
        }
        figma.ui.postMessage({
          type: "ANALYTICS_API_STATUS",
          ok: health.ok,
          url: health.baseUrl ?? ANALYTICS_API_URL,
          emailReady: health.email?.liveSendReady === true,
          emailHint,
        });
        break;
      }

      case "SEND_LUMI_REPORT": {
        const state = await buildState();
        if (!state.lumiAccess?.canViewAdminInsights) {
          figma.ui.postMessage({
            type: "LUMI_REPORT_SEND_RESULT",
            ok: false,
            message: "Admin access required to send reports.",
          });
          break;
        }

        const recipients = (msg.recipients ?? [])
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        if (!recipients.length) {
          figma.ui.postMessage({
            type: "LUMI_REPORT_SEND_RESULT",
            ok: false,
            message: "Select at least one recipient from the dropdown.",
          });
          break;
        }

        const period = msg.period as ReportPeriod;
        const dryRun = msg.dryRun === true;

        const health = await checkAnalyticsApiHealth(ANALYTICS_API_URL, ANALYTICS_OWNER_KEY);
        if (health.ok) {
          await syncPluginDataToAnalyticsApi(ANALYTICS_API_URL, ANALYTICS_OWNER_KEY);
          const apiResult = await sendLumiReportViaApi(
            ANALYTICS_API_URL,
            { period, recipients, dryRun },
            ANALYTICS_OWNER_KEY
          );

          if (apiResult.ok && apiResult.data) {
            const send = apiResult.data.send;
            const sentLive = send?.mode === "smtp";
            if (!dryRun && !sentLive) {
              figma.ui.postMessage({
                type: "LUMI_REPORT_SEND_RESULT",
                ok: false,
                mode: send?.mode,
                outputPath: send?.outputPath,
                message:
                  send?.error ??
                  "Email was not sent. Add LUMI_SMTP_USER and LUMI_SMTP_PASS to .env, set LUMI_REPORT_DRY_RUN=false, and restart npm run analytics-api.",
              });
              break;
            }
            figma.ui.postMessage({
              type: "LUMI_REPORT_SEND_RESULT",
              ok: true,
              mode: send?.mode,
              outputPath: send?.outputPath,
              message: sentLive
                ? `Email sent to ${recipients.join(", ")}.`
                : `Dry-run saved${send?.outputPath ? `: ${send.outputPath}` : "."}`,
            });
            break;
          }

          if (!dryRun) {
            figma.ui.postMessage({
              type: "LUMI_REPORT_SEND_RESULT",
              ok: false,
              message:
                apiResult.error ??
                "Send failed. Check SMTP settings and LUMI_REPORT_DRY_RUN in .env.",
            });
            break;
          }
        }

        if (dryRun) {
          const bundle = buildPluginLumiReport(
            period,
            state.productivityResults,
            state.scans
          );
          postReportBundleExports(bundle, period);
          const subject = reportSubject(bundle);
          figma.ui.postMessage({
            type: "LUMI_REPORT_SEND_RESULT",
            ok: true,
            mode: "dry-run",
            message: health.ok
              ? `Dry-run complete — API send failed; downloaded HTML and CSV for "${subject}" (${recipients.join(", ")}).`
              : `Dry-run complete — downloaded HTML and CSV for "${subject}" (${recipients.join(", ")}). Start npm run analytics-api to save to data/reports/.`,
          });
          break;
        }

        figma.ui.postMessage({
          type: "LUMI_REPORT_SEND_RESULT",
          ok: false,
          message: `Could not reach analytics API at ${ANALYTICS_API_URL}. Run npm run analytics-api, then try Send report again.`,
        });
        break;
      }

      case "MINIMIZE_PLUGIN": {
        figma.ui.resize(PLUGIN_UI_SIZE.minimizedWidth, PLUGIN_UI_SIZE.minimizedHeight);
        void figma.clientStorage.setAsync(UI_MINIMIZED_STORAGE_KEY, true);
        figma.ui.postMessage({ type: "PLUGIN_UI_MODE", minimized: true });
        break;
      }

      case "EXPAND_PLUGIN": {
        const size = await loadSavedUiSize();
        figma.ui.resize(size.width, size.height);
        void figma.clientStorage.setAsync(UI_MINIMIZED_STORAGE_KEY, false);
        figma.ui.postMessage({ type: "PLUGIN_UI_MODE", minimized: false });
        break;
      }

      case "RESIZE": {
        const size = clampPluginUiSize(msg.width, msg.height);
        figma.ui.resize(size.width, size.height);
        void figma.clientStorage.setAsync(UI_SIZE_STORAGE_KEY, size);
        void figma.clientStorage.setAsync(UI_MINIMIZED_STORAGE_KEY, false);
        figma.ui.postMessage({ type: "PLUGIN_UI_MODE", minimized: false });
        break;
      }

      case "CLOSE_PLUGIN":
        figma.closePlugin();
        break;

      default:
        break;
    }
  } catch (error) {
    const message = formatPluginError(error);
    figma.ui.postMessage({ type: "ERROR", message });
    figma.ui.postMessage({ type: "PLUGIN_ERROR", payload: { message } });
  }
};

init().catch((error) => {
  const message = formatPluginError(error);
  figma.ui.postMessage({ type: "PLUGIN_ERROR", payload: { message } });
});
