import { useEffect, useState } from "react";
import { coerceUiMessage } from "../../../integrations/jira/jiraErrors";
import { PageSection } from "../PageLayout";
import { postMessage, usePluginState } from "../../hooks";

export function JiraBoardSyncPanel() {
  const { jiraBoard } = usePluginState();
  const sync = jiraBoard.syncState;
  const isOwner = jiraBoard.isOwner === true;
  const hasTickets = jiraBoard.issues.length > 0;
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncOk, setSyncOk] = useState<boolean | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage;
      if (msg?.type === "JIRA_SYNC_RESULT") {
        setSyncMessage(coerceUiMessage(msg.message));
        setSyncOk(msg.ok === true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const mode = jiraBoard.connectionConfigUi?.dataSourceMode ?? "env-cache";

  return (
    <PageSection
      title="UX tickets"
      subtitle={
        hasTickets
          ? "UX tickets synced from Jira"
          : "Browse UX project tickets when the bundled cache is available"
      }
    >
      {hasTickets ? (
        <p className="start-session__hint">
          Tickets are loaded from the safe bundled Jira cache. Select a ticket when starting a work session.
        </p>
      ) : (
        <p className="start-session__hint start-session__hint--warn">
          Jira ticket cache is empty. Ask the LUMI owner to run <code>npm run sync:jira</code>.
        </p>
      )}

      <div className="jira-sync-stats">
        <div>
          <strong>Last synced</strong>
          <span>{sync?.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : "Never"}</span>
        </div>
        <div>
          <strong>Total tickets</strong>
          <span>{sync?.totalIssues ?? jiraBoard.issues.length}</span>
        </div>
        <div>
          <strong>Assignees</strong>
          <span>
            {sync?.totalAssignees ??
              jiraBoard.workloads.filter((w) => w.designerName !== "Unassigned").length}
          </span>
        </div>
        {isOwner && (
          <div>
            <strong>Cache source</strong>
            <span>{jiraBoard.connectionConfigUi?.cacheSource ?? sync?.cacheSource ?? "empty"}</span>
          </div>
        )}
      </div>

      {sync?.errors?.length ? (
        <p className="start-session__error">{sync.errors[0]}</p>
      ) : null}
      {syncMessage && (
        <p className={syncOk ? "start-session__hint" : "start-session__error"}>{syncMessage}</p>
      )}

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => postMessage({ type: "SYNC_JIRA_BOARD" })}
        >
          {mode === "env-cache" ? "Reload bundled cache" : "Sync UX tickets"}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => postMessage({ type: "LOAD_JIRA_BOARD" })}
        >
          Refresh
        </button>
      </div>

      {isOwner && mode === "env-cache" && (
        <p className="start-session__hint">
          Run <code>npm run sync:jira</code> locally to refresh Jira tickets, then <code>npm run build</code>{" "}
          and re-import the plugin.
        </p>
      )}
    </PageSection>
  );
}
