/** @deprecated use integrations/jira/jiraTicketMapper */
export {
  suggestJiraTicketForCurrentContext,
  scoreIssueForContext,
  groupIssuesByAssignee,
  filterMyTickets,
  searchIssues,
  issueToSessionFields,
} from "../integrations/jira/jiraTicketMapper";
import type { JiraTicketSuggestion } from "../types";

export function getTopJiraSuggestion(
  suggestions: JiraTicketSuggestion[]
): JiraTicketSuggestion | null {
  return suggestions.length > 0 ? suggestions[0] : null;
}
