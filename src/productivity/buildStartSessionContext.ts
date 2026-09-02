import type { DesignerProfile, StartSessionContext } from "../types";
import { getCurrentFigmaContext } from "./figmaContext";
import {
  detectFlow,
  inferComplexity,
  inferProject,
  inferWorkType,
  scanScopeContextLabel,
  suggestScanScope,
} from "./startSessionInference";
import { getBundledJiraCache } from "../integrations/jira/jiraCacheLoader";
import { isJiraConnectionConfigured } from "../integrations/jira/jiraDataSource";
import {
  loadFigmaToJiraUserMapping,
  loadJiraConnectionConfig,
  loadSyncedJiraIssues,
} from "../integrations/jira/jiraStore";
import { suggestJiraTicketForCurrentContext } from "../integrations/jira/jiraTicketSuggestion";

function resolveMyAssigneeName(input: {
  figmaUserName?: string;
  mapping?: { jiraAssigneeName: string } | null;
}): string | undefined {
  if (input.mapping?.jiraAssigneeName) return input.mapping.jiraAssigneeName;
  return input.figmaUserName;
}

function namesLooselyMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  return na === nb || na.includes(nb) || nb.includes(na);
}

export async function buildStartSessionContext(input: {
  userId: string;
  profile: DesignerProfile | null;
  flowName?: string;
  selectedJiraKey?: string;
}): Promise<StartSessionContext> {
  const figmaContext = await getCurrentFigmaContext(input.flowName);
  const suggestedScanScope = suggestScanScope(figmaContext);
  const connectionConfig = (await loadJiraConnectionConfig()) ?? undefined;
  const cache = getBundledJiraCache();
  const jiraConfigured = isJiraConnectionConfigured(connectionConfig ?? {});
  const syncedIssues = await loadSyncedJiraIssues();
  const jiraSynced = syncedIssues.length > 0;
  const userMapping = await loadFigmaToJiraUserMapping(input.userId);
  const myAssigneeName = resolveMyAssigneeName({
    figmaUserName: input.profile?.name ?? figma.currentUser?.name,
    mapping: userMapping,
  });

  let jiraFetchError: string | undefined;
  if (!jiraSynced) {
    jiraFetchError = "Select a manual ticket or continue without Jira.";
  }

  const detectedFlow = detectFlow({ figmaContext, jiraIssue: undefined });
  const jiraSuggestions = jiraSynced
    ? suggestJiraTicketForCurrentContext({
        issues: syncedIssues,
        figmaContext,
        detectedFlow: detectedFlow?.flowName,
        myAssigneeName,
      })
    : [];

  const selectedSuggestion =
    (input.selectedJiraKey
      ? jiraSuggestions.find((s) => s.issue.key === input.selectedJiraKey)
      : undefined) ??
    jiraSuggestions.find((s) => s.autoSelected) ??
    jiraSuggestions[0];

  const jiraIssue = selectedSuggestion?.issue;
  const flowFromIssue = detectFlow({ figmaContext, jiraIssue });
  const inferredComplexity = inferComplexity({
    storyPoints: jiraIssue?.storyPoints,
    metrics: figmaContext.scopeMetrics,
  });

  return {
    designerUserId: input.userId,
    designerName: input.profile?.name ?? figma.currentUser?.name ?? "Designer",
    fileName: figmaContext.fileName,
    fileKey: figmaContext.fileKey,
    pageName: figmaContext.pageName,
    selectedNodeId: figmaContext.selectedNodeId,
    selectedNodeName: figmaContext.selectedNodeName,
    selectedNodeType: figmaContext.selectedNodeType,
    parentPath: figmaContext.parentPath,
    nearestSectionName: figmaContext.nearestSectionName,
    nearestFrameName: figmaContext.nearestFrameName,
    suggestedJiraTicket: selectedSuggestion,
    jiraSuggestions,
    detectedFlow: flowFromIssue ?? detectedFlow,
    suggestedScanScope,
    scanScopeLabel: scanScopeContextLabel(suggestedScanScope, figmaContext),
    inferredProject: inferProject({ jiraIssue, fileName: figmaContext.fileName }),
    inferredWorkType: inferWorkType(jiraIssue),
    inferredComplexity,
    jiraConfigured,
    jiraSynced,
    jiraFetchError,
    jiraIssueCount: syncedIssues.length,
    jiraCacheSyncedAt: cache.syncedAt ?? undefined,
    jiraCacheSource: cache.source,
    myAssigneeName: namesLooselyMatch(myAssigneeName, figma.currentUser?.name)
      ? myAssigneeName
      : userMapping?.jiraAssigneeName ?? myAssigneeName,
  };
}
