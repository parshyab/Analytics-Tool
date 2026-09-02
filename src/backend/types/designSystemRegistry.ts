/** Design System Registry & Benchmark types — shared by backend, scripts, and plugin main thread. */

export type DesignSystemLibraryType =
  | "lumi"
  | "nds-beauty"
  | "nds-fashion"
  | "legacy"
  | "local"
  | "custom"
  | "unknown";

export type DesignSystemLibraryStatus =
  | "active"
  | "legacy"
  | "deprecated"
  | "experimental"
  | "unknown";

export type DesignSystemLibrary = {
  id: string;
  name: string;
  slug: string;
  type: DesignSystemLibraryType;
  status: DesignSystemLibraryStatus;
  figmaFileKey?: string;
  figmaTeamId?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastIndexedAt?: string;
};

export type DesignSystemComponentCategory =
  | "button"
  | "input"
  | "navigation"
  | "modal"
  | "card"
  | "form"
  | "table"
  | "feedback"
  | "layout"
  | "icon"
  | "other";

export type DesignSystemComponentStatus =
  | "active"
  | "legacy"
  | "deprecated"
  | "experimental"
  | "unknown"
  | "missing";

export type DesignSystemComponent = {
  id: string;
  libraryId: string;
  figmaNodeId?: string;
  figmaKey: string;
  name: string;
  normalizedName: string;
  componentSetKey?: string;
  componentSetName?: string;
  variantName?: string;
  category?: DesignSystemComponentCategory;
  status: DesignSystemComponentStatus;
  replacementComponentKey?: string;
  replacementLibraryId?: string;
  createdAt: string;
  updatedAt: string;
};

export type DesignSystemStyleType = "text" | "paint" | "effect" | "grid" | "unknown";

export type DesignSystemStyle = {
  id: string;
  libraryId: string;
  figmaStyleKey?: string;
  figmaStyleId?: string;
  name: string;
  normalizedName: string;
  type: DesignSystemStyleType;
  status: "active" | "legacy" | "deprecated" | "unknown" | "missing";
  createdAt: string;
  updatedAt: string;
};

export type DesignSystemVariableType =
  | "color"
  | "spacing"
  | "typography"
  | "radius"
  | "shadow"
  | "number"
  | "string"
  | "boolean"
  | "unknown";

export type DesignSystemVariable = {
  id: string;
  libraryId: string;
  figmaVariableKey?: string;
  figmaVariableId?: string;
  name: string;
  normalizedName: string;
  collectionName?: string;
  type: DesignSystemVariableType;
  status: "active" | "legacy" | "deprecated" | "unknown" | "missing";
  createdAt: string;
  updatedAt: string;
};

export type DesignSystemIndexRun = {
  id: string;
  libraryId: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "success" | "failed";
  componentsIndexed: number;
  stylesIndexed: number;
  variablesIndexed: number;
  errorMessage?: string;
};

export type ComponentSystemClassification =
  | "lumi"
  | "nds-beauty"
  | "nds-fashion"
  | "legacy-other"
  | "local-component"
  | "detached-candidate"
  | "custom-ui"
  | "unknown";

export type ComponentClassificationResult = {
  nodeId: string;
  nodeName: string;
  componentKey?: string;
  componentName?: string;
  componentSetName?: string;
  variantName?: string;
  classification: ComponentSystemClassification;
  libraryId?: string;
  libraryName?: string;
  pageName?: string;
  sectionName?: string;
  frameName?: string;
  parentPath: string[];
};

export type LumiAnalyticsScanPayload = {
  scanId: string;
  scannedAt: string;
  fileKey?: string;
  fileName: string;
  pageName?: string;
  sectionName?: string;
  frameName?: string;
  scanScope: "selection" | "frame" | "section" | "page" | "file";
  jiraIssueKey?: string;
  jiraSummary?: string;
  jiraAssigneeName?: string;
  designerUserId?: string;
  designerName?: string;
  flowName?: string;
  teamName?: string;
  counts: {
    totalComponentInstances: number;
    lumiInstances: number;
    ndsBeautyInstances: number;
    ndsFashionInstances: number;
    legacyOtherInstances: number;
    detachedCandidates: number;
    customUiCandidates: number;
    unknownInstances: number;
    textStyleUses: number;
    lumiTextStyleUses: number;
    legacyTextStyleUses: number;
    paintStyleUses: number;
    lumiPaintStyleUses: number;
    legacyPaintStyleUses: number;
    variableTokenUses: number;
    lumiVariableTokenUses: number;
    legacyVariableTokenUses: number;
  };
  rates: {
    lumiAdoptionRate: number;
    legacyUsageRate: number;
    ndsBeautyUsageRate: number;
    ndsFashionUsageRate: number;
    detachmentRate: number;
    customUiRate: number;
    designDebtRate: number;
    migrationProgressRate: number;
    tokenAdoptionRate: number;
    styleAdoptionRate: number;
    qualityScore: number;
    lumiProductivityScore: number;
  };
  componentBreakdown: ComponentClassificationResult[];
};

export type DesignSystemBenchmarkSnapshot = {
  id: string;
  scanId: string;
  createdAt: string;
  month: string;
  fileKey?: string;
  fileName: string;
  flowName?: string;
  teamName?: string;
  jiraIssueKey?: string;
  totalComponentInstances: number;
  lumiInstances: number;
  ndsBeautyInstances: number;
  ndsFashionInstances: number;
  legacyOtherInstances: number;
  detachedCandidates: number;
  customUiCandidates: number;
  lumiAdoptionRate: number;
  legacyUsageRate: number;
  ndsBeautyUsageRate: number;
  ndsFashionUsageRate: number;
  detachmentRate: number;
  customUiRate: number;
  designDebtRate: number;
  migrationProgressRate: number;
  tokenAdoptionRate: number;
  styleAdoptionRate: number;
  qualityScore: number;
  lumiProductivityScore: number;
};

export type ComponentReplacementMapping = {
  id: string;
  sourceLibraryId: string;
  sourceComponentKey: string;
  sourceComponentName: string;
  targetLibraryId: string;
  targetComponentKey: string;
  targetComponentName: string;
  confidence: "confirmed" | "suggested" | "manual";
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type DesignSystemBenchmarkFilters = {
  dateFrom?: string;
  dateTo?: string;
  month?: string;
  fileKey?: string;
  flowName?: string;
  teamName?: string;
  jiraIssueKey?: string;
  designerName?: string;
};

export type LumiVsLegacySummary = {
  period: { from?: string; to?: string; month?: string };
  totals: {
    scans: number;
    totalComponentInstances: number;
    lumiInstances: number;
    ndsBeautyInstances: number;
    ndsFashionInstances: number;
    legacyOtherInstances: number;
    detachedCandidates: number;
    customUiCandidates: number;
  };
  rates: {
    lumiAdoptionRate: number;
    legacyUsageRate: number;
    ndsBeautyUsageRate: number;
    ndsFashionUsageRate: number;
    detachmentRate: number;
    customUiRate: number;
    designDebtRate: number;
    migrationProgressRate: number;
    lumiProductivityScore: number;
  };
  insightSummary: string[];
};

export type DsBenchmarkDashboardPayload = {
  summary: LumiVsLegacySummary;
  trends: Array<{ month: string; rates: LumiVsLegacySummary["rates"]; totals: LumiVsLegacySummary["totals"] }>;
  byFlow: Array<{ flowName: string } & LumiVsLegacySummary>;
  byTeam: Array<{ teamName: string } & LumiVsLegacySummary>;
  opportunities: Array<{
    sourceComponentKey: string;
    sourceComponentName: string;
    classification: ComponentSystemClassification;
    usageCount: number;
    lumiReplacementKey?: string;
    lumiReplacementName?: string;
    confidence: string;
    migrationPriority: string;
  }>;
  registrySyncedAt: string | null;
};

/** Bundled plugin cache (no secrets). */
export type DesignSystemRegistryCache = {
  syncedAt: string | null;
  source: "env-sync" | "empty";
  libraries: DesignSystemLibrary[];
  componentKeyIndex: Record<
    string,
    {
      libraryId: string;
      librarySlug: string;
      libraryType: DesignSystemLibraryType;
      libraryName: string;
      componentName: string;
      normalizedName: string;
      status: DesignSystemComponentStatus;
    }
  >;
  styleKeyIndex: Record<
    string,
    {
      libraryId: string;
      librarySlug: string;
      libraryType: DesignSystemLibraryType;
      libraryName: string;
      styleName: string;
      normalizedName: string;
      type: DesignSystemStyleType;
    }
  >;
  normalizedNameIndex: Record<string, string[]>;
  replacementMappings: ComponentReplacementMapping[];
};

export function normalizeDesignSystemName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s/\-]/g, "")
    .replace(/\s*\/\s*/g, " / ");
}

export function uid(prefix = "ds"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function scanScopeToPayloadScope(
  scope: import("../../types").ScanScope
): LumiAnalyticsScanPayload["scanScope"] {
  switch (scope) {
    case "selected-frame":
      return "frame";
    case "selected-section":
      return "section";
    case "current-page":
      return "page";
    case "whole-file":
      return "file";
    default:
      return "page";
  }
}
