import { useEffect, useState } from "react";
import type { AutoStartSettings, MainMessage, PluginState } from "../../types";
import { DEFAULT_AUTOSTART_SETTINGS } from "../../types";
import { PageSection } from "./PageLayout";
import { postMessage, usePluginState } from "../hooks";

export function Privacy({ state }: { state: PluginState }) {
  const { refresh, setTab } = usePluginState();
  const [autoStart, setAutoStart] = useState<AutoStartSettings>(
    state.settings.autoStart ?? DEFAULT_AUTOSTART_SETTINGS
  );
  const [adminEmail, setAdminEmail] = useState(
    state.profile?.email ?? state.consent?.email ?? ""
  );
  const [unlockStatus, setUnlockStatus] = useState<"idle" | "loading" | "error" | "success">(
    state.lumiAccess?.role === "admin" ? "success" : "idle"
  );
  const [unlockMessage, setUnlockMessage] = useState(
    state.lumiAccess?.role === "admin"
      ? "Admin access is active."
      : ""
  );

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

  const switchToDesignerView = () => {
    postMessage({ type: "SET_UI_VIEW_MODE", mode: "designer" });
  };

  const switchToAdminView = () => {
    postMessage({ type: "SET_UI_VIEW_MODE", mode: "admin" });
  };

  return (
    <>
      <PageSection
        title="Consent & data use"
        subtitle="LUMI runs while the plugin is open or hidden — not before you open it or after you close it."
      >
        <table className="trend-table">
          <tbody>
            <tr><td>Status</td><td>{consentLabel}</td></tr>
            <tr><td>Given at</td><td>{consent?.consentGivenAt ?? "—"}</td></tr>
            <tr><td>Version</td><td>{consent?.consentVersion ?? "—"}</td></tr>
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

      <PageSection
        title="Admin access"
        subtitle="Enter an authorized LUMI admin email to unlock Trends, Designers, Teams, LUMI Adoption, Settings, and Export."
      >
        {isAdmin ? (
          <div className="admin-unlock-active">
            <p className="admin-unlock-status admin-unlock-status--ok">
              Admin access is active
              {(state.profile?.email || state.consent?.email) && (
                <> for <strong>{state.profile?.email ?? state.consent?.email}</strong></>
              )}
              {viewingAsDesigner ? " — currently using designer view." : "."}
            </p>
            <div className="btn-row">
              {viewingAsDesigner ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={switchToAdminView}
                  disabled={!state.consent?.consentGiven}
                >
                  Switch to admin view
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={switchToDesignerView}
                  disabled={!state.consent?.consentGiven}
                >
                  Go to designer view
                </button>
              )}
              {!viewingAsDesigner && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setTab("lumi-adoption")}
                    disabled={!state.consent?.consentGiven}
                  >
                    Open LUMI Adoption
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setTab("monthly-dashboard")}
                    disabled={!state.consent?.consentGiven}
                  >
                    Open Trends &amp; Monthly
                  </button>
                </>
              )}
              {viewingAsDesigner && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTab("start-session")}
                  disabled={!state.consent?.consentGiven}
                >
                  Open Work Sessions
                </button>
              )}
            </div>
            {!state.consent?.consentGiven && (
              <p className="section-footnote">Complete consent first to open admin insights.</p>
            )}
            {viewingAsDesigner && state.consent?.consentGiven && (
              <p className="section-footnote">
                Designer nav is active (Work Sessions, My Productivity). Return here anytime to switch back to admin.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="admin-email">Admin email</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                placeholder="your.email@nykaa.com"
                value={adminEmail}
                onChange={(e) => {
                  setAdminEmail(e.target.value);
                  if (unlockStatus !== "idle" && unlockStatus !== "loading") {
                    setUnlockStatus("idle");
                    setUnlockMessage("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") unlockAdmin();
                }}
              />
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={unlockAdmin}
                disabled={unlockStatus === "loading"}
              >
                {unlockStatus === "loading" ? "Checking…" : "Unlock admin view"}
              </button>
            </div>
            {unlockMessage && (
              <p
                className={`admin-unlock-status ${
                  unlockStatus === "error"
                    ? "admin-unlock-status--error"
                    : unlockStatus === "success"
                      ? "admin-unlock-status--ok"
                      : ""
                }`}
              >
                {unlockMessage}
              </p>
            )}
          </>
        )}
      </PageSection>

      <PageSection title="Automation (recommended)">
        <p className="start-session__hint" style={{ marginBottom: 12 }}>
          With automation on, designers open LUMI once — timer starts, UI hides, metadata is inferred
          from Jira/file context, and sessions finish when they close the file.
        </p>
        <label style={{ display: "block", marginBottom: 10 }}>
          <input type="checkbox" checked={autoStart.enabled} onChange={(e) => setAutoStart({ ...autoStart, enabled: e.target.checked })} />
          {" "}Auto-start session when plugin opens
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <input type="checkbox" checked={autoStart.autoFillMetadata} onChange={(e) => setAutoStart({ ...autoStart, autoFillMetadata: e.target.checked })} />
          {" "}Auto-fill ticket, flow, and work type from Jira + file context
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <input type="checkbox" checked={autoStart.autoHideOnStart} onChange={(e) => setAutoStart({ ...autoStart, autoHideOnStart: e.target.checked })} />
          {" "}Hide UI after auto-start (track in background)
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <input type="checkbox" checked={autoStart.autoFinishOnClose} onChange={(e) => setAutoStart({ ...autoStart, autoFinishOnClose: e.target.checked })} />
          {" "}Auto-finish + scan when plugin closes
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <input type="checkbox" checked={autoStart.autoFinishStaleSessions} onChange={(e) => setAutoStart({ ...autoStart, autoFinishStaleSessions: e.target.checked })} />
          {" "}Auto-finish stale sessions on reopen (30+ min away)
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <input type="checkbox" checked={autoStart.autoScanOnFinish} onChange={(e) => setAutoStart({ ...autoStart, autoScanOnFinish: e.target.checked })} />
          {" "}Run LUMI scan when auto-finishing
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <input type="checkbox" checked={autoStart.startAsDraft} onChange={(e) => setAutoStart({ ...autoStart, startAsDraft: e.target.checked })} />
          {" "}Start as draft (manual metadata before reporting)
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <input type="checkbox" checked={autoStart.keepSessionWhenHidden} onChange={(e) => setAutoStart({ ...autoStart, keepSessionWhenHidden: e.target.checked })} />
          {" "}Allow hiding UI completely (Figma bottom bar)
        </label>
        <button type="button" className="btn btn-primary" onClick={saveAutoStart}>Save privacy settings</button>
      </PageSection>

      <PageSection title="Your data">
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => postMessage({ type: "GET_EXPORT", exportType: "full-json", includeEmails: false })}>
            Export my data
          </button>
          <button type="button" className="btn btn-danger" onClick={() => {
            if (confirm("Delete all local LUMI data including consent? You will see the consent screen again.")) {
              postMessage({ type: "DELETE_LOCAL_DATA" });
            }
          }}>
            Delete my local data
          </button>
        </div>
      </PageSection>
    </>
  );
}
