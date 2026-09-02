import { computeBenchmarkRates } from "../../backend/services/benchmarkFormulas";
import type {
  ComponentClassificationResult,
  DesignSystemRegistryCache,
  LumiAnalyticsScanPayload,
} from "../../backend/types/designSystemRegistry";
import { scanScopeToPayloadScope } from "../../backend/types/designSystemRegistry";
import type { LumiScanSnapshot, WorkSession } from "../../types";
import { countClassifications } from "../../scanner/componentClassifier";

export function buildLumiAnalyticsScanPayload(input: {
  snapshot: LumiScanSnapshot;
  session: WorkSession;
  componentBreakdown: ComponentClassificationResult[];
  registry: DesignSystemRegistryCache;
}): LumiAnalyticsScanPayload {
  const { snapshot, session, componentBreakdown } = input;
  const classCounts = countClassifications(componentBreakdown);

  const counts = {
    totalComponentInstances: classCounts.totalComponentInstances,
    lumiInstances: classCounts.lumiInstances,
    ndsBeautyInstances: classCounts.ndsBeautyInstances,
    ndsFashionInstances: classCounts.ndsFashionInstances,
    legacyOtherInstances: classCounts.legacyOtherInstances,
    detachedCandidates: classCounts.detachedCandidates,
    customUiCandidates: classCounts.customUiCandidates,
    unknownInstances: classCounts.unknownInstances,
    textStyleUses: snapshot.textStyleUses,
    lumiTextStyleUses: snapshot.lumiTextStyleUses,
    legacyTextStyleUses: Math.max(0, snapshot.textStyleUses - snapshot.lumiTextStyleUses),
    paintStyleUses: snapshot.paintStyleUses,
    lumiPaintStyleUses: snapshot.lumiPaintStyleUses,
    legacyPaintStyleUses: Math.max(0, snapshot.paintStyleUses - snapshot.lumiPaintStyleUses),
    variableTokenUses: snapshot.variableTokenUses,
    lumiVariableTokenUses: snapshot.variableTokenUses,
    legacyVariableTokenUses: 0,
  };

  const rates = computeBenchmarkRates({
    ...counts,
    qualityScore: snapshot.qualityScore,
  });

  return {
    scanId: snapshot.id,
    scannedAt: snapshot.scannedAt,
    fileKey: session.fileKey,
    fileName: snapshot.fileName,
    pageName: snapshot.pageName,
    sectionName: componentBreakdown[0]?.sectionName,
    frameName: componentBreakdown[0]?.frameName ?? snapshot.rootNodeName,
    scanScope: scanScopeToPayloadScope(snapshot.scanScope),
    jiraIssueKey: session.jiraIssueKey ?? session.jiraTicketId,
    jiraSummary: session.jiraSummary ?? session.ticketTitle,
    jiraAssigneeName: session.jiraAssigneeName,
    designerUserId: session.designerUserId,
    designerName: session.anonymous ? session.designerName : session.designerName,
    flowName: session.flowName,
    teamName: session.teamName,
    counts,
    rates,
    componentBreakdown,
  };
}
