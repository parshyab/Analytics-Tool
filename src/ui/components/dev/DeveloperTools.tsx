import { PageSection } from "../PageLayout";
import { usePluginState } from "../../hooks";

type Props = {
  onReload?: () => void;
};

export function DeveloperTools({ onReload }: Props) {
  const { jiraBoard } = usePluginState();
  const sync = jiraBoard.syncState;
  const cache = jiraBoard.connectionConfigUi;

  return (
    <PageSection title="Developer tools" subtitle="Local cache status — no credentials shown.">
      <div className="dev-tools-grid">
        <div>
          <span className="dev-tools-label">Cache source</span>
          <strong>{cache?.cacheSource ?? sync?.cacheSource ?? "empty"}</strong>
        </div>
        <div>
          <span className="dev-tools-label">Last synced</span>
          <strong>{sync?.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : "Never"}</strong>
        </div>
        <div>
          <span className="dev-tools-label">Total tickets</span>
          <strong>{sync?.totalIssues ?? jiraBoard.issues.length}</strong>
        </div>
        <div>
          <span className="dev-tools-label">Total assignees</span>
          <strong>{sync?.totalAssignees ?? cache?.cacheAssignees ?? 0}</strong>
        </div>
        <div>
          <span className="dev-tools-label">Project</span>
          <strong>{cache?.projectKey ?? "UX"}</strong>
        </div>
        <div>
          <span className="dev-tools-label">Cache valid</span>
          <strong>{jiraBoard.issues.length > 0 ? "Yes" : "Empty"}</strong>
        </div>
      </div>
      {cache?.jql && (
        <p className="start-session__hint dev-tools-jql">
          <strong>JQL:</strong> {cache.jql}
        </p>
      )}
      <div className="btn-row">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReload}>
          Reload cache summary
        </button>
      </div>
    </PageSection>
  );
}
