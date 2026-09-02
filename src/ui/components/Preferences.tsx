import { useEffect, useState } from "react";
import type { AutoStartSettings, MainMessage, PluginState } from "../../types";
import { DEFAULT_AUTOSTART_SETTINGS, DEFAULT_SETTINGS } from "../../types";
import { isNykaaDesignTeam, NYKAA_DESIGN_TEAMS, type NykaaDesignTeam } from "../../productivity/nykaaTeams";
import { PageSection } from "./PageLayout";
import { DeveloperTools } from "./dev/DeveloperTools";
import { postMessage, usePluginState } from "../hooks";

const RECOMMENDED_AUTOSTART: AutoStartSettings = {
  ...DEFAULT_AUTOSTART_SETTINGS,
  enabled: true,
  startAsDraft: false,
  requireMetadataBeforeReporting: false,
  keepSessionWhenHidden: true,
  autoFillMetadata: true,
  autoHideOnStart: true,
  autoFinishOnClose: true,
  autoFinishStaleSessions: true,
  autoFinishIdleMinutes: 0,
  autoScanOnFinish: true,
};

export function Preferences({ state }: { state: PluginState }) {
  const { refresh, setTab, bootData, debug, stateLoaded } = usePluginState();
  const [autoStart, setAutoStart] = useState<AutoStartSettings>(
    state.settings.autoStart ?? DEFAULT_AUTOSTART_SETTINGS
  );
  const [settings, setSettings] = useState(state.settings ?? DEFAULT_SETTINGS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [adminEmail, setAdminEmail] = useState(state.profile?.email ?? state.consent?.email ?? "");
  const [unlockStatus, setUnlockStatus] = useState<"idle" | "loading" | "error" | "success">(
    state.lumiAccess?.role === "admin" ? "success" : "idle"
  );
  const [unlockMessage, setUnlockMessage] = useState(
    state.lumiAccess?.role === "admin" ? "Admin access is active." : ""
  );

  const devMode = state.devModeEnabled === true;
  const [devModeChecked, setDevModeChecked] = useState(devMode);

  const isAdmin =
    state.lumiAccess?.role === "admin" || state.lumiAccess?.canViewAdminInsights === true;
  const viewingAsDesigner = isAdmin && state.lumiAccess?.preferredView === "designer";

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage as MainMessage | undefined;
      if (msg?.type !== "ADMIN_UNLOCK_RESULT") return;
      setUnlockStatus(msg.ok ? "success" : "error");
      setUnlockMessage(msg.message);
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      setUnlockStatus("success");
      setUnlockMessage((prev) => prev || "Admin access is active.");
    }
  }, [isAdmin]);

  const consent = state.consent;
  const consentLabel = !consent
    ? "Not set"
    : consent.mode === "declined"
      ? "Declined"
      : consent.mode === "anonymous"
        ? "Anonymous"
        : "Identified";

  const saveAutoStart = () => {
    postMessage({
      type: "SAVE_AUTOSTART",
      autoStart: { ...autoStart, updatedAt: new Date().toISOString() },
    });
  };

  const savePluginSettings = () => {
    postMessage({
      type: "SAVE_SETTINGS",
      settings: { ...settings, autoStart, updatedAt: new Date().toISOString() },
    });
  };

  const applyRecommended = () => {
    const next = { ...RECOMMENDED_AUTOSTART, updatedAt: new Date().toISOString() };
    setAutoStart(next);
    postMessage({ type: "SAVE_AUTOSTART", autoStart: next });
  };

  const unlockAdmin = () => {
    const email = adminEmail.trim();
    if (!email) {
      setUnlockStatus("error");
      setUnlockMessage("Enter your admin email address.");
      return;
    }
    setUnlockStatus("loading");
    setUnlockMessage("Checking access…");
    postMessage({ type: "UNLOCK_ADMIN", email });
  };

  return (
    <>
      <PageSection
        title="Recommended setup"
        subtitle="One click — open LUMI once, work in Figma, sessions capture automatically."
      >
        <button type="button" className="btn btn-primary" onClick={applyRecommended}>
          Apply recommended automation
        </button>
        <p className="section-footnote">
          Auto-start, infer ticket/flow, hide UI, auto-finish on close, and LUMI scan on finish.
        </p>
      </PageSection>

      <PageSection title="Automation" subtitle="Toggle individual behaviors or open advanced options.">
        <label className="pref-toggle">
          <input type="checkbox" checked={autoStart.enabled} onChange={(e) => setAutoStart({ ...autoStart, enabled: e.target.checked })} />
          <span>Auto-start when plugin opens</span>
        </label>
        <label className="pref-toggle">
          <input type="checkbox" checked={autoStart.autoFillMetadata} onChange={(e) => setAutoStart({ ...autoStart, autoFillMetadata: e.target.checked })} />
          <span>Auto-fill ticket &amp; flow from Jira + file</span>
        </label>
        <label className="pref-toggle">
          <input type="checkbox" checked={autoStart.autoHideOnStart} onChange={(e) => setAutoStart({ ...autoStart, autoHideOnStart: e.target.checked })} />
          <span>Hide UI after auto-start</span>
        </label>
        <label className="pref-toggle">
          <input type="checkbox" checked={autoStart.autoFinishOnClose} onChange={(e) => setAutoStart({ ...autoStart, autoFinishOnClose: e.target.checked })} />
          <span>Auto-finish when plugin closes</span>
        </label>
        <label className="pref-toggle">
          <input type="checkbox" checked={autoStart.autoScanOnFinish} onChange={(e) => setAutoStart({ ...autoStart, autoScanOnFinish: e.target.checked })} />
          <span>Run LUMI scan on auto-finish</span>
        </label>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={saveAutoStart}>Save automation</button>
          <button type="button" className="btn btn-ghost" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? "Hide advanced" : "Advanced options"}
          </button>
        </div>
        {showAdvanced ? (
          <div className="pref-advanced">
            <label className="pref-toggle">
              <input type="checkbox" checked={autoStart.autoFinishStaleSessions} onChange={(e) => setAutoStart({ ...autoStart, autoFinishStaleSessions: e.target.checked })} />
              <span>Auto-finish stale sessions on reopen (30+ min)</span>
            </label>
            <label className="pref-toggle">
              <input type="checkbox" checked={autoStart.startAsDraft} onChange={(e) => setAutoStart({ ...autoStart, startAsDraft: e.target.checked })} />
              <span>Start as draft</span>
            </label>
            <label className="pref-toggle">
              <input type="checkbox" checked={autoStart.keepSessionWhenHidden} onChange={(e) => setAutoStart({ ...autoStart, keepSessionWhenHidden: e.target.checked })} />
              <span>Allow hide via Figma bottom bar</span>
            </label>
            <label className="pref-toggle">
              <input type="checkbox" checked={autoStart.requireMetadataBeforeReporting} onChange={(e) => setAutoStart({ ...autoStart, requireMetadataBeforeReporting: e.target.checked })} />
              <span>Require metadata before reporting</span>
            </label>
            <div className="form-group">
              <label>Idle auto-finish (minutes, 0 = off)</label>
              <input
                type="number"
                min={0}
                max={480}
                value={autoStart.autoFinishIdleMinutes}
                onChange={(e) =>
                  setAutoStart({ ...autoStart, autoFinishIdleMinutes: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
        ) : null}
      </PageSection>

      <PageSection title="Consent & data">
        <table className="trend-table">
          <tbody>
            <tr><td>Status</td><td>{consentLabel}</td></tr>
            <tr><td>Given at</td><td>{consent?.consentGivenAt ?? "—"}</td></tr>
          </tbody>
        </table>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => { setTab("welcome"); refresh(); }}>
            Review consent
          </button>
          {consent?.mode === "identified" && (
            <button type="button" className="btn btn-secondary" onClick={() => postMessage({ type: "SWITCH_TO_ANONYMOUS" })}>
              Switch to anonymous
            </button>
          )}
        </div>
      </PageSection>

      {isAdmin && (
        <PageSection title="Admin access" subtitle="Unlock insights, export, and team dashboards.">
          <div className="admin-unlock-active">
            <p className="admin-unlock-status admin-unlock-status--ok">
              Admin active
              {viewingAsDesigner ? " — designer view" : ""}
            </p>
            <div className="btn-row">
              {viewingAsDesigner ? (
                <button type="button" className="btn btn-primary" onClick={() => postMessage({ type: "SET_UI_VIEW_MODE", mode: "admin" })}>
                  Switch to admin view
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => postMessage({ type: "SET_UI_VIEW_MODE", mode: "designer" })}>
                  Switch to designer view
                </button>
              )}
            </div>
          </div>
        </PageSection>
      )}

      {!isAdmin && (
        <PageSection title="Admin access">
          <div className="form-group">
            <label htmlFor="admin-email">Admin email</label>
            <input id="admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="your.email@nykaa.com" />
          </div>
          <button type="button" className="btn btn-primary" onClick={unlockAdmin} disabled={unlockStatus === "loading"}>
            {unlockStatus === "loading" ? "Checking…" : "Unlock admin"}
          </button>
          {unlockMessage ? <p className="admin-unlock-status">{unlockMessage}</p> : null}
        </PageSection>
      )}

      <PageSection title="Plugin configuration">
        <div className="form-group">
          <label>LUMI library prefix</label>
          <input value={settings.lumiLibraryPrefix} onChange={(e) => setSettings({ ...settings, lumiLibraryPrefix: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Team</label>
          <select
            value={isNykaaDesignTeam(settings.teamName) ? settings.teamName : ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                teamName: (e.target.value || undefined) as NykaaDesignTeam | undefined,
              })
            }
          >
            <option value="">Select team…</option>
            {NYKAA_DESIGN_TEAMS.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.includeEmailInExport} onChange={(e) => setSettings({ ...settings, includeEmailInExport: e.target.checked })} />
          Include email in export
        </label>
        <button type="button" className="btn btn-primary" onClick={savePluginSettings}>Save configuration</button>
      </PageSection>

      <PageSection title="Your data">
        <div className="btn-row btn-row--grid">
          <button type="button" className="btn btn-secondary" onClick={() => postMessage({ type: "GET_EXPORT", exportType: "full-json", includeEmails: false })}>
            Export my data
          </button>
          <button type="button" className="btn btn-danger" onClick={() => {
            if (confirm("Delete all local LUMI data including consent?")) postMessage({ type: "DELETE_LOCAL_DATA" });
          }}>
            Delete local data
          </button>
        </div>
      </PageSection>

      {isAdmin && (
        <PageSection title="Developer mode">
          <label className="checkbox-label">
            <input type="checkbox" checked={devModeChecked} onChange={(e) => {
              setDevModeChecked(e.target.checked);
              postMessage({ type: "SET_DEV_MODE", enabled: e.target.checked });
            }} />
            Enable developer mode
          </label>
          {devMode && <DeveloperTools onReload={refresh} />}
          {devMode && (
            <table className="trend-table">
              <tbody>
                <tr><td>State loaded</td><td>{String(stateLoaded)}</td></tr>
                <tr><td>File</td><td>{bootData.fileName}</td></tr>
                <tr><td>Last error</td><td>{debug.lastError ?? "—"}</td></tr>
              </tbody>
            </table>
          )}
        </PageSection>
      )}
    </>
  );
}
