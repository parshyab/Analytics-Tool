/**
 * @deprecated Import from ./jiraDataSource instead.
 */
export {
  createJiraDataSource,
  isJiraConnectionConfigured,
  isJiraAdminConfigured,
  mergeJiraConnectionConfig,
  mergeJiraAdminConfig,
  syncBoardTicketsFromSource,
  testJiraConnection,
  getIssueFromSource,
  DirectJiraDataSource,
  ProxyJiraDataSource,
  MockJiraDataSource,
  EnvCacheJiraDataSource,
  createJiraApiError,
  formatPluginError,
  buildIssueUrl,
  normalizeSiteUrl,
  NETWORK_BLOCKED_INSTRUCTIONS,
  NETWORK_BLOCKED_MESSAGE,
} from "./jiraDataSource";

export { jiraErrorMessage } from "./jiraErrors";

/** @deprecated Use createJiraApiError */
export class JiraApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "JiraApiError";
  }
}
