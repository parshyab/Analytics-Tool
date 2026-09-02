import { useEffect, useState } from "react";
import type { JiraConnectionConfigUi } from "../../../types";
import { DEFAULT_JIRA_JQL, DEFAULT_JIRA_PROXY_URL } from "../../../integrations/jira/types";
import { coerceUiMessage } from "../../../integrations/jira/jiraErrors";
import { PageSection } from "../PageLayout";
import { postMessage, usePluginState } from "../../hooks";

export function JiraSettings() {
  const { jiraBoard } = usePluginState();
  const isOwner = jiraBoard.isOwner === true;

  if (!isOwner) {
    return null;
  }

  return <JiraOwnerSettings />;
}

function JiraOwnerSettings() {
  const { jiraBoard } = usePluginState();
  const [form, setForm] = useState<JiraConnectionConfigUi>({
    siteUrl: "https://nykmage.atlassian.net",
    projectKey: "UX",
    jql: DEFAULT_JIRA_JQL,
    dataSourceMode: "env-cache",
    proxyUrl: DEFAULT_JIRA_PROXY_URL,
    hasToken: false,
  });
  const [tokenInput, setTokenInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState<boolean | null>(null);
  const [devOwnerOverride, setDevOwnerOverride] = useState(false);

  useEffect(() => {
    if (jiraBoard.connectionConfigUi) {
      setForm(jiraBoard.connectionConfigUi);
    }
  }, [jiraBoard.connectionConfigUi]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage;
      if (msg?.type === "JIRA_TEST_RESULT") {
        setStatusMessage(coerceUiMessage(msg.message));
        setStatusOk(msg.ok === true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const save = () => {
    postMessage({
      type: "SAVE_JIRA_CONNECTION_CONFIG",
      config: {
        ...form,
        apiToken: tokenInput || undefined,
      },
    });
    setTokenInput("");
    setStatusMessage("Developer Jira settings saved.");
    setStatusOk(true);
  };

  const cache = jiraBoard.connectionConfigUi;
  const sync = jiraBoard.syncState;

  return (
    <PageSection title="Developer panel" subtitle="Owner-only Jira data source settings">
      <p className="start-session__hint">
        Recommended: keep <strong>env-cache</strong> mode. Run <code>npm run sync:jira</code> locally to
        refresh Jira tickets, then <code>npm run build</code> and re-import the plugin in Figma.
      </p>

      <div className="jira-sync-stats">
        <div>
          <strong>Data source mode</strong>
          <span>{cache?.dataSourceMode ?? "env-cache"}</span>
        </div>
        <div>
          <strong>Last synced</strong>
          <span>{sync?.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : "Never"}</span>
        </div>
        <div>
          <strong>Total tickets</strong>
          <span>{sync?.totalIssues ?? jiraBoard.issues.length}</span>
        </div>
        <div>
          <strong>Total assignees</strong>
          <span>{sync?.totalAssignees ?? cache?.cacheAssignees ?? 0}</span>
        </div>
        <div>
          <strong>Cache source</strong>
          <span>{cache?.cacheSource ?? sync?.cacheSource ?? "empty"}</span>
        </div>
        <div>
          <strong>JQL</strong>
          <span className="jira-owner-jql">{cache?.jql ?? form.jql}</span>
        </div>
      </div>

      <div className="form-group">
        <label>Data source mode</label>
        <select
          value={form.dataSourceMode}
          onChange={(e) =>
            setForm({
              ...form,
              dataSourceMode: e.target.value as JiraConnectionConfigUi["dataSourceMode"],
            })
          }
        >
          <option value="env-cache">Env cache (recommended)</option>
          <option value="direct">Direct (optional — may fail in Figma)</option>
          <option value="proxy">Proxy (future backend)</option>
          <option value="mock">Mock (local UI testing)</option>
        </select>
      </div>

      {(form.dataSourceMode === "direct" || form.dataSourceMode === "proxy") && (
        <>
          <div className="form-group">
            <label>Jira site URL</label>
            <input
              value={form.siteUrl}
              onChange={(e) => setForm({ ...form, siteUrl: e.target.value })}
              placeholder="https://nykmage.atlassian.net"
            />
          </div>
          {form.dataSourceMode === "direct" && (
            <>
              <div className="form-group">
                <label>Jira email (direct mode only)</label>
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@nykaa.com"
                />
              </div>
              <div className="form-group">
                <label>Jira API token (direct mode only — stored locally, never exported)</label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={form.hasToken ? "Token saved — enter to replace" : "Atlassian API token"}
                />
              </div>
            </>
          )}
          {form.dataSourceMode === "proxy" && (
            <div className="form-group">
              <label>Proxy URL</label>
              <input
                value={form.proxyUrl ?? ""}
                onChange={(e) => setForm({ ...form, proxyUrl: e.target.value })}
                placeholder="http://localhost:8787"
              />
            </div>
          )}
          <div className="form-group">
            <label>Project key</label>
            <input
              value={form.projectKey}
              onChange={(e) => setForm({ ...form, projectKey: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>JQL</label>
            <textarea
              rows={3}
              value={form.jql}
              onChange={(e) => setForm({ ...form, jql: e.target.value })}
            />
          </div>
        </>
      )}

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={devOwnerOverride}
          onChange={(e) => {
            setDevOwnerOverride(e.target.checked);
            postMessage({ type: "SET_DEV_OWNER_OVERRIDE", enabled: e.target.checked });
          }}
        />
        Treat me as owner on this machine (local development override)
      </label>

      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-sm" onClick={save}>
          Save developer settings
        </button>
        {(form.dataSourceMode === "direct" || form.dataSourceMode === "proxy") && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setStatusMessage("Testing Jira connection…");
              setStatusOk(null);
              postMessage({
                type: "TEST_JIRA_CONNECTION",
                config: {
                  ...form,
                  apiToken: tokenInput || undefined,
                },
              });
            }}
          >
            Test connection
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => postMessage({ type: "CLEAR_JIRA_CREDENTIALS" })}
        >
          Clear stored credentials
        </button>
      </div>
      {statusMessage && (
        <p className={statusOk === false ? "start-session__error" : "start-session__hint"}>
          {statusMessage}
        </p>
      )}
    </PageSection>
  );
}
