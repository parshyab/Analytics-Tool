import { JiraBoardSyncPanel } from "./JiraBoardSyncPanel";
import { JiraDesignerWorkloadView } from "./JiraDesignerWorkload";
import { JiraIdentityMapping } from "./JiraTicketPicker";
import { JiraSettings } from "./JiraSettings";
import { PageLayout } from "../PageLayout";
import { usePluginState } from "../../hooks";

export function JiraIntegrationPage() {
  const { jiraBoard } = usePluginState();
  const hasTickets = jiraBoard.issues.length > 0;

  return (
    <PageLayout
      title="Jira integration"
      subtitle={
        hasTickets
          ? "UX tickets synced from Jira. Pick work by assignee when starting a session."
          : "Manual ticket entry is available until the LUMI owner syncs Jira tickets."
      }
      eyebrow="Jira"
    >
      <JiraBoardSyncPanel />
      {hasTickets && <JiraIdentityMapping />}
      {hasTickets && <JiraDesignerWorkloadView workloads={jiraBoard.workloads} />}
      <JiraSettings />
    </PageLayout>
  );
}
