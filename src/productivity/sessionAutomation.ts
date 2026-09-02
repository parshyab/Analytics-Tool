import type { StartSessionContext, WorkSession } from "../types";

/** Map inferred start context onto session fields for auto-start. */
export function sessionOptsFromContext(context: StartSessionContext): Partial<WorkSession> {
  const issue = context.suggestedJiraTicket?.issue;
  const flowName = context.detectedFlow?.flowName ?? issue?.components?.[0];

  return {
    projectName: context.inferredProject,
    flowName: flowName ?? undefined,
    workType: context.inferredWorkType,
    complexity: context.inferredComplexity?.level,
    scanScope: context.suggestedScanScope,
    pageName: context.pageName,
    fileName: context.fileName,
    fileKey: context.fileKey ?? undefined,
    selectedNodeId: context.selectedNodeId,
    selectedNodeName: context.selectedNodeName,
    selectedNodeType: context.selectedNodeType,
    nearestSectionName: context.nearestSectionName,
    nearestFrameName: context.nearestFrameName,
    jiraIssueKey: issue?.key,
    jiraTicketId: issue?.key,
    jiraIssueUrl: issue?.url,
    jiraTicketUrl: issue?.url,
    jiraSummary: issue?.summary,
    ticketTitle: issue?.summary,
    metadataSource: {
      ticket: issue ? "inferred" : "none",
      flow: flowName ? "inferred" : "auto",
      complexity: context.inferredComplexity ? "inferred" : "none",
      scanScope: "auto",
    },
  };
}

export function isMetadataCompleteFromOpts(opts: Partial<WorkSession>): boolean {
  return !!(opts.flowName && opts.scanScope && opts.complexity && opts.workType);
}

export function touchSessionActivity(session: WorkSession): WorkSession {
  const now = new Date().toISOString();
  return { ...session, lastActivityAt: now, lastSeenAt: now, updatedAt: now };
}

export function shouldAutoFinishIdleSession(
  session: WorkSession,
  idleMinutes: number
): boolean {
  if (idleMinutes <= 0) return false;
  const anchor = session.lastActivityAt ?? session.lastSeenAt;
  const gapMs = Date.now() - new Date(anchor).getTime();
  return gapMs >= idleMinutes * 60 * 1000;
}
