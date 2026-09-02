import { useEffect, useState } from "react";
import type { PluginState } from "../../types";
import { DEFAULT_SETTINGS } from "../../types";
import { isNykaaDesignTeam, NYKAA_DESIGN_TEAMS, type NykaaDesignTeam } from "../../productivity/nykaaTeams";
import { PageSection } from "./PageLayout";
import { DeveloperTools } from "./dev/DeveloperTools";
import { postMessage, usePluginState } from "../hooks";

export function Settings({ state }: { state: PluginState }) {
  const [settings, setSettings] = useState(state.settings ?? DEFAULT_SETTINGS);
  const { bootData, debug, stateLoaded, refresh } = usePluginState();
  const devMode = state.devModeEnabled === true;
  const [devModeChecked, setDevModeChecked] = useState(devMode);

  useEffect(() => {
    setDevModeChecked(devMode);
  }, [devMode]);

  const save = () => {
    postMessage({
      type: "SAVE_SETTINGS",
      settings: { ...settings, updatedAt: new Date().toISOString() },
    });
  };

  return (
    <>
      <PageSection title="Plugin configuration" subtitle="Consent and auto-start are in the Privacy tab.">
        <div className="form-group">
          <label>LUMI library name prefix</label>
          <input
            value={settings.lumiLibraryPrefix}
            onChange={(e) => setSettings({ ...settings, lumiLibraryPrefix: e.target.value })}
          />
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
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.includeEmailInExport}
            onChange={(e) => setSettings({ ...settings, includeEmailInExport: e.target.checked })}
          />
          Include email in export
        </label>

        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={save}>
            Save settings
          </button>
        </div>
      </PageSection>

      <PageSection title="Optional cloud scanning" subtitle="Future feature — not required for local sessions.">
        <div className="form-group">
          <label>Figma API token</label>
          <input
            type="password"
            value={settings.figmaApiToken ?? ""}
            onChange={(e) => setSettings({ ...settings, figmaApiToken: e.target.value })}
            placeholder="Optional"
          />
        </div>
        <div className="form-group">
          <label>Team IDs (comma-separated)</label>
          <input
            value={settings.figmaTeamIds?.join(",") ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                figmaTeamIds: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </PageSection>

      <PageSection title="Developer mode" subtitle="Enable local developer tools on this machine only.">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={devModeChecked}
            onChange={(e) => {
              setDevModeChecked(e.target.checked);
              postMessage({ type: "SET_DEV_MODE", enabled: e.target.checked });
            }}
          />
          Enable developer mode
        </label>
        <p className="start-session__hint">
          Shows cache status tools for plugin owners. Never exposes Jira credentials.
        </p>
      </PageSection>

      {devMode && <DeveloperTools onReload={refresh} />}

      {devMode && (
        <PageSection title="Debug panel">
          <table className="trend-table">
            <tbody>
              <tr><td>UI mounted</td><td>true</td></tr>
              <tr><td>BOOT_DATA received</td><td>{String(debug.bootDataReceived)}</td></tr>
              <tr><td>Full state loaded</td><td>{String(stateLoaded)}</td></tr>
              <tr><td>Current file</td><td>{bootData.fileName}</td></tr>
              <tr><td>Current page</td><td>{bootData.currentPageName}</td></tr>
              <tr><td>User available</td><td>{String(!!bootData.user)}</td></tr>
              <tr><td>Active session</td><td>{String(!!state.activeSession)}</td></tr>
              <tr><td>Last plugin message</td><td>{debug.lastPluginMessage || "—"}</td></tr>
              <tr><td>Last error</td><td>{debug.lastError ?? "—"}</td></tr>
            </tbody>
          </table>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={() => postMessage({ type: "RELOAD_UI" })}>
              Reload UI
            </button>
            <button type="button" className="btn btn-secondary" onClick={refresh}>
              Refresh state
            </button>
          </div>
        </PageSection>
      )}
    </>
  );
}
