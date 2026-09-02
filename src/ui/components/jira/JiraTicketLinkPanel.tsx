import type { JiraIssue } from "../../../types";
import { PageSection } from "../PageLayout";
import { postMessage } from "../../hooks";

type Props = {
  issue?: JiraIssue | null;
  pageName?: string;
  nodeName?: string;
};

export function JiraTicketLinkPanel({ issue, pageName, nodeName }: Props) {
  if (!issue) return null;

  return (
    <PageSection title="Link ticket to Figma" subtitle="Optional mapping stored in shared plugin data for this file.">
      <p className="start-session__hint">
        Link <strong>{issue.key}</strong> to {nodeName ? `“${nodeName}”` : pageName ?? "current selection"}.
      </p>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            postMessage({
              type: "SAVE_JIRA_TICKET_LINK",
              link: {
                issueKey: issue.key,
                fileKey: null,
                pageName,
                nodeName,
                linkedAt: new Date().toISOString(),
              },
            })
          }
        >
          Link to selected frame
        </button>
        <a className="btn btn-ghost btn-sm" href={issue.url} target="_blank" rel="noreferrer">
          Open in Jira
        </a>
      </div>
    </PageSection>
  );
}
