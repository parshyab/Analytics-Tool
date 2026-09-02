// LUMI Analytics — shared type definitions

export const LUMI_CONSENT_VERSION = "v1" as const;
export const PLUGIN_NAMESPACE = "lumi.analytics";
/** @deprecated Invalid Figma namespace (hyphens not allowed). Do not use. */
export const PLUGIN_NAMESPACE_LEGACY = "lumi-analytics";

/** figma.clientStorage keys (versioned) */
export const STORAGE_KEYS = {
  consent: "lumi.consent.v1",
  consentLegacy: "lumi:consent",
  autoStart: "lumi.autostart.settings.v1",
  activeSession: "lumi.activeSession.v1",
  activeSessionLegacy: "lumi:activeSession",
  profile: "lumi:profile",
  sessions: "lumi:sessions",
  scans: "lumi:scans",
  /** @deprecated monolithic scan blob — migrated to per-session keys */
  scanIndex: "lumi:scan-index.v1",
  scanPrefix: "lumi:scan.v1:",
  productivity: "lumi:productivity",
  benchmarks: "lumi:benchmarks",
  dsBenchmarkSnapshots: "lumi.dsBenchmarkSnapshots.v1",
  settingsLegacy: "lumi:settings",
} as const;

// ─── Consent & Profile ───────────────────────────────────────────────────────

export type ConsentMode = "identified" | "anonymous" | "declined";

export type LumiConsent = {
  consentVersion: typeof LUMI_CONSENT_VERSION;
  consentGiven: boolean;
  mode: ConsentMode;
  userId?: string;
  name?: string;
  email?: string;
  teamName?: string;
  consentGivenAt?: string;
  updatedAt: string;
};

/** @deprecated use LumiConsent */
export type DesignerConsent = LumiConsent & { consentMode?: ConsentMode };

export type DesignerProfile = {
  userId: string;
  name: string;
  email?: string;
  teamName?: string;
  role?: string;
  anonymousLabel?: string;
  consentGiven: boolean;
  consentGivenAt?: string;
  updatedAt: string;
};

export function buildLumiConsent(
  mode: ConsentMode,
  opts: {
    userId: string;
    name?: string;
    email?: string;
    teamName?: string;
  }
): LumiConsent {
  const now = new Date().toISOString();
  return {
    consentVersion: LUMI_CONSENT_VERSION,
    consentGiven: mode !== "declined",
    mode,
    userId: opts.userId,
    name: mode === "anonymous" ? undefined : opts.name,
    email: mode === "identified" ? opts.email : undefined,
    teamName: opts.teamName,
    consentGivenAt: mode !== "declined" ? now : undefined,
    updatedAt: now,
  };
}

export function buildProfile(
  userId: string,
  name: string,
  opts: {
    email?: string;
    teamName?: string;
    role?: string;
    anonymous?: boolean;
    consentGiven: boolean;
  }
): DesignerProfile {
  const now = new Date().toISOString();
  const anonymousLabel = `Designer ${userId.slice(-4)}`;
  return {
    userId,
    name: opts.anonymous ? anonymousLabel : name,
    email: opts.anonymous ? undefined : opts.email,
    teamName: opts.teamName,
    role: opts.role,
    anonymousLabel: opts.anonymous ? anonymousLabel : undefined,
    consentGiven: opts.consentGiven,
    consentGivenAt: opts.consentGiven ? now : undefined,
    updatedAt: now,
  };
}

// ─── Session ─────────────────────────────────────────────────────────────────

export type WorkSessionStatus =
  | "draft"
  | "active"
  | "paused"
  | "finished"
  | "cancelled";

export type WorkType =
  | "new-flow"
  | "iteration"
  | "ux-improvement"
  | "visual-refinement"
  | "component-migration"
  | "design-qa-fix"
  | "experiment"
  | "production-support"
  | "other";

export type WorkComplexity = "low" | "medium" | "high" | "very-high";

export type ScanScope = "selected-frame" | "selected-section" | "current-page" | "whole-file";

/** @deprecated legacy scan scope values — use normalizeScanScope() */
export type LegacyScanScope = "selection" | "frame" | "section" | "page" | "file";

export function normalizeScanScope(scope: ScanScope | LegacyScanScope): ScanScope {
  switch (scope) {
    case "frame":
    case "selection":
      return "selected-frame";
    case "section":
      return "selected-section";
    case "page":
      return "current-page";
    case "file":
      return "whole-file";
    default:
      return scope;
  }
}

export type SessionMetadataSource = {
  ticket: "jira-auto" | "jira-suggested" | "manual" | "none";
  flow: "auto" | "manual";
  complexity: "jira-story-points" | "figma-analysis" | "manual" | "none";
  scanScope: "auto" | "manual";
};

export type Platform =
  | "ios"
  | "android"
  | "mobile-web"
  | "desktop-web"
  | "responsive-web"
  | "other";

export type PauseInterval = {
  pausedAt: string;
  resumedAt?: string;
  minutes?: number;
};

export type WorkSession = {
  id: string;
  designerUserId: string;
  designerName: string;
  designerEmail?: string;
  teamName?: string;
  anonymous: boolean;
  projectName?: string;
  jiraTicketId?: string;
  jiraTicketUrl?: string;
  /** Alias for jiraTicketId on new sessions */
  jiraIssueKey?: string;
  /** Alias for jiraTicketUrl on new sessions */
  jiraIssueUrl?: string;
  ticketTitle?: string;
  jiraSummary?: string;
  jiraStatus?: string;
  jiraPriority?: string;
  jiraProjectKey?: string;
  jiraStoryPoints?: number;
  jiraAssigneeName?: string;
  jiraAssigneeEmail?: string;
  jiraComponents?: string[];
  jiraLabels?: string[];
  flowName?: string;
  platform?: Platform;
  workType?: WorkType;
  complexity?: WorkComplexity;
  fileName: string;
  fileKey?: string;
  pageName?: string;
  selectedNodeId?: string;
  selectedNodeName?: string;
  selectedNodeType?: string;
  scanScope: ScanScope;
  status: WorkSessionStatus;
  autoStarted: boolean;
  startedAt: string;
  lastSeenAt: string;
  /** Last Figma selection / document activity (for idle auto-finish) */
  lastActivityAt?: string;
  pausedAt?: string;
  resumedAt?: string;
  finishedAt?: string;
  pauseIntervals: PauseInterval[];
  pluginHiddenAt?: string;
  pluginRestoredAt?: string;
  rawElapsedMinutes?: number;
  adjustedActualMinutes?: number;
  adjustmentReason?: SessionAdjustmentReason;
  adjustmentNote?: string;
  metadataComplete: boolean;
  eligibleForReporting: boolean;
  metadataSource?: SessionMetadataSource;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionAdjustmentReason =
  | "none"
  | "breaks"
  | "meeting-interruption"
  | "plugin-closed"
  | "partial-work-session"
  | "other";

export type SessionTimeAdjustment = {
  rawElapsedMinutes: number;
  pausedMinutes: number;
  suggestedActualMinutes: number;
  adjustedActualMinutes: number;
  adjustmentReason: SessionAdjustmentReason;
  adjustmentNote?: string;
};

// ─── Auto-start ──────────────────────────────────────────────────────────────

export type AutoStartSettings = {
  enabled: boolean;
  startAsDraft: boolean;
  requireMetadataBeforeReporting: boolean;
  keepSessionWhenHidden: boolean;
  /** Infer Jira ticket, flow, and work type when auto-starting */
  autoFillMetadata: boolean;
  /** Hide plugin UI after auto-start (timer keeps running) */
  autoHideOnStart: boolean;
  /** Finish + scan when the plugin closes */
  autoFinishOnClose: boolean;
  /** Auto-finish sessions idle 30+ min on reopen instead of restore prompt */
  autoFinishStaleSessions: boolean;
  /** Auto-finish while plugin is open after N min without Figma activity (0 = off) */
  autoFinishIdleMinutes: number;
  /** Run LUMI scan when auto-finishing */
  autoScanOnFinish: boolean;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_AUTOSTART_SETTINGS: AutoStartSettings = {
  enabled: true,
  startAsDraft: false,
  requireMetadataBeforeReporting: false,
  keepSessionWhenHidden: true,
  autoFillMetadata: true,
  autoHideOnStart: true,
  autoFinishOnClose: true,
  autoFinishStaleSessions: true,
  autoFinishIdleMinutes: 0,
  autoScanOnFinish: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export type PluginSettings = {
  autoStart: AutoStartSettings;
  lumiLibraryPrefix: string;
  includeEmailInExport: boolean;
  figmaApiToken?: string;
  figmaTeamIds?: string[];
  figmaLibraryFileIds?: string[];
  jiraBaseUrl?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
  manualName?: string;
  teamName?: string;
  updatedAt: string;
};

// ─── Scan ────────────────────────────────────────────────────────────────────

export type QualitySignalType =
  | "detached-candidate"
  | "custom-color"
  | "missing-text-style"
  | "heavy-override"
  | "deprecated-component"
  | "non-lumi-component";

export type QualitySignal = {
  type: QualitySignalType;
  count: number;
  severity: "low" | "medium" | "high";
  message: string;
};

export type ComponentUsageLocation = {
  nodeId: string;
  pageName: string;
  sectionName?: string;
  frameName?: string;
  parentPath: string;
};

export type ComponentUsageInSession = {
  componentKey: string;
  componentName: string;
  componentSetName?: string;
  variantName?: string;
  instances: number;
  locations: ComponentUsageLocation[];
};

export type LumiScanSnapshot = {
  id: string;
  sessionId: string;
  scannedAt: string;
  scanScope: ScanScope;
  fileName: string;
  pageName?: string;
  rootNodeId?: string;
  rootNodeName?: string;
  rootNodeType?: string;
  totalComponentInstances: number;
  lumiComponentInstances: number;
  nonLumiComponentInstances: number;
  lumiAdoptionRate: number;
  uniqueLumiComponents: number;
  lumiComponentKeys: string[];
  lumiComponentUsage: ComponentUsageInSession[];
  tokenAdoptionRate: number;
  styleAdoptionRate: number;
  textStyleAdoptionRate: number;
  colorStyleAdoptionRate: number;
  textStyleUses: number;
  lumiTextStyleUses: number;
  paintStyleUses: number;
  lumiPaintStyleUses: number;
  variableTokenUses: number;
  detachedCandidates: number;
  customColors: number;
  customTextStyles: number;
  heavyOverrides: number;
  qualityScore: number;
  qualitySignals: QualitySignal[];
  figmaCalculationsRaw?: Record<string, unknown>;
  scanWarnings: string[];
  /** LUMI vs legacy design system classification (benchmark layer). */
  systemClassification?: import("./backend/types/designSystemRegistry").LumiAnalyticsScanPayload;
};

// ─── Benchmarks ──────────────────────────────────────────────────────────────

export type BenchmarkKey = {
  projectName?: string;
  flowName?: string;
  workType?: WorkType;
  complexity?: WorkComplexity;
  platform?: string;
};

export type BenchmarkLevel =
  | "exact-match"
  | "flow-match"
  | "worktype-match"
  | "complexity-match"
  | "manual-baseline"
  | "unavailable";

export type ProductivityBenchmark = {
  id: string;
  key: BenchmarkKey;
  benchmarkLevel: BenchmarkLevel;
  sampleSize: number;
  medianMinutes: number;
  averageMinutes: number;
  p25Minutes?: number;
  p75Minutes?: number;
  source: "work-sessions" | "manual-baseline" | "imported-historical-data";
  confidence: "high" | "medium" | "low" | "unavailable";
  createdFromSessionIds: string[];
  sourceNote?: string;
  effectiveDate?: string;
  updatedAt: string;
};

// ─── Productivity ────────────────────────────────────────────────────────────

export type ProductivityConfidenceLabel =
  | "high"
  | "medium"
  | "low"
  | "directional"
  | "unavailable";

export type ProductivityConfidence = {
  label: ProductivityConfidenceLabel;
  score: number;
  reasons: string[];
};

export type ProductivityResult = {
  id: string;
  sessionId: string;
  designerUserId: string;
  designerName: string;
  teamName?: string;
  projectName?: string;
  jiraTicketId?: string;
  jiraTicketUrl?: string;
  flowName?: string;
  workType?: WorkType;
  complexity?: WorkComplexity;
  actualMinutes: number;
  benchmark?: ProductivityBenchmark;
  benchmarkMinutes?: number;
  observedMinutesSaved?: number;
  observedHoursSaved?: number;
  lumiAttributedHoursSaved?: number;
  rawTimeVarianceMinutes?: number;
  timeVariancePercent?: number;
  productivityLiftPercent?: number;
  lumiAdoptionRate: number;
  tokenAdoptionRate: number;
  styleAdoptionRate: number;
  lumiComponentInstances: number;
  uniqueLumiComponents: number;
  componentsReusedPerHour?: number;
  detachedCandidates: number;
  customColors: number;
  qualityScore: number;
  designSystemLeverageScore: number;
  confidence: ProductivityConfidence;
  confidenceNotes: string[];
  createdAt: string;
};

// ─── Jira ────────────────────────────────────────────────────────────────────

export type ParsedJiraTicket = {
  ticketId?: string;
  projectKey?: string;
  url?: string;
  valid: boolean;
};

export type JiraIssue = {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: string;
  statusCategory?: string;
  assigneeAccountId?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  reporterName?: string;
  priority?: string;
  projectKey?: string;
  projectName?: string;
  issueType?: string;
  labels: string[];
  components: string[];
  sprint?: string;
  epicKey?: string;
  storyPoints?: number;
  createdAt?: string;
  updatedAt: string;
  dueDate?: string;
  url: string;
};

export type JiraBoardSyncState = {
  lastSyncedAt?: string;
  totalIssues: number;
  totalAssignees: number;
  errors: string[];
  cacheSource?: "env-sync" | "direct-sync" | "proxy-sync" | "mock" | "empty";
  dataSourceMode?: "env-cache" | "direct" | "proxy" | "mock";
};

export type JiraDesignerWorkload = {
  designerName: string;
  designerEmail?: string;
  accountId?: string;
  totalTickets: number;
  activeTickets: number;
  doneTickets: number;
  blockedTickets: number;
  tickets: JiraIssue[];
};

export type FigmaToJiraUserMapping = {
  figmaUserId: string;
  figmaUserName: string;
  jiraAccountId?: string;
  jiraAssigneeName: string;
  jiraAssigneeEmail?: string;
  mappedAt: string;
};

export type JiraConnectionConfigUi = {
  siteUrl: string;
  email?: string;
  projectKey: string;
  jql: string;
  dataSourceMode: "env-cache" | "direct" | "proxy" | "mock";
  proxyUrl?: string;
  hasToken: boolean;
  lastSyncedAt?: string;
  cacheSource?: "env-sync" | "direct-sync" | "proxy-sync" | "mock" | "empty";
  cacheTotal?: number;
  cacheAssignees?: number;
};

/** @deprecated Use JiraConnectionConfigUi */
export type JiraAdminConfigUi = JiraConnectionConfigUi;

export type JiraBoardPayload = {
  syncState: JiraBoardSyncState;
  issues: JiraIssue[];
  workloads: JiraDesignerWorkload[];
  configured: boolean;
  connectionConfigUi?: JiraConnectionConfigUi | null;
  userMapping?: FigmaToJiraUserMapping | null;
  isOwner?: boolean;
  devModeEnabled?: boolean;
  ownerReason?: string;
};

export type JiraConfidence = "high" | "medium" | "low";

export type JiraTicketSuggestion = {
  issue: JiraIssue;
  confidence: JiraConfidence;
  score: number;
  reasons: string[];
  autoSelected: boolean;
};

export type FlowSuggestionSource =
  | "jira-summary"
  | "jira-label"
  | "jira-component"
  | "figma-page"
  | "figma-section"
  | "figma-frame"
  | "manual";

export type FlowSuggestion = {
  flowName: string;
  confidence: JiraConfidence;
  source: FlowSuggestionSource;
  reasons: string[];
};

export type ComplexitySuggestion = {
  complexity: WorkComplexity;
  source: "jira-story-points" | "figma-scope-analysis" | "manual";
  score?: number;
  reasons: string[];
};

export type FigmaContextNodeType =
  | "FRAME"
  | "SECTION"
  | "PAGE"
  | "GROUP"
  | "INSTANCE"
  | "COMPONENT"
  | "COMPONENT_SET"
  | "UNKNOWN";

export type FigmaScopeMetrics = {
  layerCount: number;
  frameCount: number;
  instanceCount: number;
  uniqueComponentCount: number;
  textNodeCount: number;
  variantCount: number;
  hasFormsModalsTables: boolean;
};

export type FigmaContextForJira = {
  fileName: string;
  fileKey?: string | null;
  pageName: string;
  selectedNodeId?: string;
  selectedNodeName?: string;
  selectedNodeType?: FigmaContextNodeType;
  parentPath: string[];
  nearestSectionName?: string;
  nearestFrameName?: string;
  flowName?: string;
  scopeMetrics?: FigmaScopeMetrics;
};

export type StartSessionContext = {
  designerUserId: string;
  designerName: string;
  designerEmail?: string;
  fileName: string;
  fileKey?: string | null;
  pageName: string;
  selectedNodeId?: string;
  selectedNodeName?: string;
  selectedNodeType?: FigmaContextNodeType;
  parentPath: string[];
  nearestSectionName?: string;
  nearestFrameName?: string;
  suggestedJiraTicket?: JiraTicketSuggestion;
  jiraSuggestions: JiraTicketSuggestion[];
  detectedFlow?: FlowSuggestion;
  suggestedScanScope: ScanScope;
  scanScopeLabel?: string;
  inferredProject?: string;
  inferredWorkType?: WorkType;
  inferredComplexity?: ComplexitySuggestion;
  jiraConfigured: boolean;
  jiraSynced: boolean;
  jiraFetchError?: string;
  jiraIssueCount?: number;
  jiraCacheSyncedAt?: string | null;
  jiraCacheSource?: "env-sync" | "direct-sync" | "proxy-sync" | "mock" | "empty";
  myAssigneeName?: string;
};

export type JiraTicketNodeLink = {
  issueKey: string;
  fileKey?: string | null;
  pageName?: string;
  nodeId?: string;
  nodeName?: string;
  linkedAt: string;
};

export type JiraSuggestionsPayload = {
  suggestions: JiraTicketSuggestion[];
  figmaContext: FigmaContextForJira;
  designerEmail?: string;
  fetchError?: string;
  configured: boolean;
};

// ─── Filters ─────────────────────────────────────────────────────────────────

export type WorkSessionFilters = {
  designerUserId?: string;
  status?: WorkSessionStatus[];
  fromDate?: string;
  toDate?: string;
  projectName?: string;
  flowName?: string;
};

export type ProductivityFilters = {
  designerUserId?: string;
  teamName?: string;
  fromDate?: string;
  toDate?: string;
  projectName?: string;
  flowName?: string;
  jiraAssigneeName?: string;
  jiraStatus?: string;
  jiraComponent?: string;
  confidence?: ProductivityConfidenceLabel[];
};

export type BenchmarkFilters = {
  projectName?: string;
  flowName?: string;
  workType?: WorkType;
  complexity?: WorkComplexity;
};

// ─── Dashboard aggregates ────────────────────────────────────────────────────

export type DesignerAggregate = {
  designerUserId: string;
  designerName: string;
  teamName?: string;
  sessions: number;
  tickets: number;
  actualHours: number;
  benchmarkHours: number;
  observedHoursSaved: number;
  lumiAttributedHoursSaved: number;
  productivityLiftPercent: number;
  lumiAdoptionRate: number;
  componentsReused: number;
  componentsReusedPerHour: number;
  tokenAdoptionRate: number;
  styleAdoptionRate: number;
  qualityScore: number;
  designSystemLeverageScore: number;
  confidence: ProductivityConfidenceLabel;
  lastSessionAt?: string;
};

export type TeamAggregate = {
  teamName: string;
  designers: number;
  sessions: number;
  tickets: number;
  actualHours: number;
  benchmarkHours: number;
  observedHoursSaved: number;
  lumiAttributedHoursSaved: number;
  productivityLiftPercent: number;
  lumiAdoptionRate: number;
  tokenAdoptionRate: number;
  styleAdoptionRate: number;
  qualityScore: number;
  confidence: ProductivityConfidenceLabel;
};

export type MonthlyAggregate = {
  month: string;
  designers: number;
  tickets: number;
  sessions: number;
  actualHours: number;
  benchmarkHours: number;
  observedHoursSaved: number;
  lumiAttributedHoursSaved: number;
  averageLumiAdoption: number;
  componentReuse: number;
  tokenAdoption: number;
  qualityScore: number;
};

// ─── Productivity trends ─────────────────────────────────────────────────────

export type TrendMetric =
  | "observedHoursSaved"
  | "lumiAttributedHoursSaved"
  | "productivityLiftPercent"
  | "actualHours"
  | "benchmarkHours"
  | "lumiAdoptionRate"
  | "componentReuse"
  | "componentsReusedPerHour"
  | "tokenAdoptionRate"
  | "lumiLeverageScore"
  | "qualityScore";

export type EnablementMetricDef = {
  key: string;
  label: string;
  meaning: string;
  source: "measured" | "benchmarked" | "calculated";
};

export const ENABLEMENT_METRICS: EnablementMetricDef[] = [
  { key: "actualHours", label: "Actual hours worked", meaning: "Measured from opt-in work sessions", source: "measured" },
  { key: "benchmarkHours", label: "Benchmark hours", meaning: "Historical expected time for similar work", source: "benchmarked" },
  { key: "observedHoursSaved", label: "Observed hours saved", meaning: "Benchmark hours minus actual hours", source: "calculated" },
  { key: "productivityLiftPercent", label: "Productivity lift %", meaning: "How much faster the work was completed vs benchmark", source: "calculated" },
  { key: "lumiAdoptionRate", label: "LUMI adoption %", meaning: "Share of component instances from the LUMI library", source: "measured" },
  { key: "componentsReusedPerHour", label: "Components reused/hour", meaning: "Reuse efficiency during measured sessions", source: "calculated" },
  { key: "lumiLeverageScore", label: "LUMI leverage score", meaning: "How strongly the designer used the design system", source: "calculated" },
  { key: "qualityScore", label: "Quality score", meaning: "How clean the design output is (0–100)", source: "measured" },
];

export const PRIMARY_TREND_CHARTS: { metric: TrendMetric; label: string; description: string }[] = [
  { metric: "observedHoursSaved", label: "Hours saved", description: "Observed hours saved over time" },
  { metric: "productivityLiftPercent", label: "Productivity lift", description: "Productivity lift from LUMI over time" },
  { metric: "lumiAdoptionRate", label: "LUMI adoption", description: "LUMI enablement trend — adoption %" },
  { metric: "componentReuse", label: "Component reuse", description: "LUMI component instances over time" },
  { metric: "tokenAdoptionRate", label: "Token adoption", description: "Design token usage over time" },
  { metric: "qualityScore", label: "Quality score", description: "Design quality over time" },
];

export type TrendGroupBy = "day" | "week" | "month";

export type TrendViewScope = "my-data" | "team-summary" | "full-designer-view";

export type DesignerTimeSeriesPoint = {
  date: string;
  month: string;
  periodKey: string;
  designerUserId: string;
  designerName: string;
  teamName?: string;
  sessions: number;
  tickets: number;
  actualMinutes: number;
  benchmarkMinutes: number;
  observedMinutesSaved: number;
  observedHoursSaved: number;
  lumiAttributedMinutesSaved: number;
  lumiAttributedHoursSaved: number;
  productivityLiftPercent: number | null;
  lumiAdoptionRate: number;
  tokenAdoptionRate: number;
  styleAdoptionRate: number;
  componentReuse: number;
  componentsReusedPerHour: number;
  lumiLeverageScore: number;
  qualityScore: number;
  confidenceScore: number;
  confidenceLabel: ProductivityConfidenceLabel;
  isLive?: boolean;
};

export type ProductivityTrendFilters = {
  designerUserIds: string[];
  designerNames: string[];
  teamNames: string[];
  dateFrom?: string;
  dateTo?: string;
  month?: string;
  projectNames: string[];
  jiraTicketIds: string[];
  jiraAssigneeNames: string[];
  jiraStatuses: string[];
  jiraComponents: string[];
  flowNames: string[];
  workTypes: string[];
  complexities: string[];
  confidenceLabels: ProductivityConfidenceLabel[];
  sessionStatuses: WorkSessionStatus[];
  groupBy: TrendGroupBy;
  metric: TrendMetric;
  viewScope: TrendViewScope;
};

export type DesignerTrendSeries = {
  designerUserId: string;
  designerName: string;
  teamName?: string;
  colorIndex: number;
  isTeamAverage?: boolean;
  isLive?: boolean;
  points: DesignerTimeSeriesPoint[];
};

export type TrendCardSummary = {
  designers: number;
  tickets: number;
  sessions: number;
  actualHours: number;
  benchmarkHours: number;
  observedHoursSaved: number;
  lumiAttributedHoursSaved: number;
  averageLumiAdoption: number;
  componentReuse: number;
  averageComponentsPerHour: number;
  averageTokenAdoption: number;
  averageLeverageScore: number;
  qualityScore: number;
  hasBenchmark: boolean;
  hasLiveSession: boolean;
};

// ─── UI / Messages ───────────────────────────────────────────────────────────

export type BootData = {
  pluginName: string;
  fileName: string;
  fileKey: string | null;
  currentPageName: string;
  user: { id: string; name: string; photoUrl?: string } | null;
  figmaContext?: FigmaContextForJira;
  designerEmail?: string;
  devModeEnabled?: boolean;
  uiBuildStamp?: string;
};

export type TabId =
  | "welcome"
  | "start-session"
  | "active-session"
  | "my-productivity"
  | "designer-productivity"
  | "team-dashboard"
  | "monthly-dashboard"
  | "lumi-adoption"
  | "jira-integration"
  | "privacy"
  | "settings"
  | "export";

export type PluginState = {
  consent: LumiConsent | null;
  profile: DesignerProfile | null;
  settings: PluginSettings;
  activeSession: WorkSession | null;
  sessions: WorkSession[];
  scans: LumiScanSnapshot[];
  productivityResults: ProductivityResult[];
  benchmarks: ProductivityBenchmark[];
  currentUser: { id: string; name: string; photoUrl?: string } | null;
  fileName: string;
  pendingRestoreSession?: WorkSession | null;
  /** @deprecated use pendingRestoreSession */
  pendingClosedSessionPrompt?: WorkSession | null;
  jiraBoardSyncState?: JiraBoardSyncState | null;
  jiraIssueCount?: number;
  jiraConfigured?: boolean;
  devModeEnabled?: boolean;
  dsRegistrySyncedAt?: string | null;
  lumiAccess?: {
    role: "admin" | "designer";
    canViewAdminInsights: boolean;
    reason?: string;
    /** Admin can temporarily use designer nav without losing unlock. */
    preferredView?: "admin" | "designer";
  };
  /** Stakeholder emails available in the Export report recipient dropdown (not auto-sent). */
  reportRecipientOptions?: string[];
};

export type UIMessage =
  | { type: "UI_READY" }
  | { type: "UI_BECAME_VISIBLE" }
  | { type: "RELOAD_UI" }
  | { type: "CLOSE_PLUGIN" }
  | { type: "INIT" }
  | { type: "SAVE_CONSENT"; consent: LumiConsent; profile: DesignerProfile }
  | { type: "SWITCH_TO_ANONYMOUS" }
  | { type: "SAVE_AUTOSTART"; autoStart: AutoStartSettings }
  | { type: "RUN_IN_BACKGROUND"; sessionId: string }
  | { type: "RESTORE_SESSION"; sessionId: string; action: "continue" | "pause" | "edit" | "finish" | "discard"; manualMinutes?: number }
  | { type: "DISMISS_RESTORE" }
  | { type: "START_SESSION"; session: Partial<WorkSession> }
  | { type: "UPDATE_SESSION"; session: WorkSession }
  | { type: "PAUSE_SESSION"; sessionId: string }
  | { type: "RESUME_SESSION"; sessionId: string }
  | { type: "FINISH_SESSION"; sessionId: string; adjustment: SessionTimeAdjustment; runScan: boolean }
  | { type: "DISCARD_SESSION"; sessionId: string }
  | { type: "HANDLE_CLOSED_TIME"; sessionId: string; action: "count" | "pause" | "manual" | "discard"; manualMinutes?: number }
  | { type: "RUN_SCAN"; sessionId: string }
  | { type: "SAVE_SETTINGS"; settings: PluginSettings }
  | { type: "DELETE_LOCAL_DATA" }
  | { type: "ZOOM_TO_NODE"; nodeId: string }
  | { type: "GET_EXPORT"; exportType: string; includeEmails: boolean }
  | { type: "GET_TREND_EXPORT"; filters: ProductivityTrendFilters }
  | { type: "FETCH_JIRA_SUGGESTIONS"; flowName?: string }
  | { type: "REFRESH_START_SESSION"; flowName?: string }
  | { type: "SAVE_JIRA_TICKET_LINK"; link: JiraTicketNodeLink }
  | { type: "SAVE_JIRA_CONNECTION_CONFIG"; config: Partial<JiraConnectionConfigUi> & { apiToken?: string } }
  | { type: "SAVE_JIRA_ADMIN_CONFIG"; config: Partial<JiraConnectionConfigUi> & { apiToken?: string } }
  | { type: "TEST_JIRA_CONNECTION"; config?: Partial<JiraConnectionConfigUi> & { apiToken?: string } }
  | { type: "SYNC_JIRA_BOARD"; config?: Partial<JiraConnectionConfigUi> & { apiToken?: string } }
  | { type: "CLEAR_JIRA_CREDENTIALS" }
  | { type: "LOAD_JIRA_BOARD" }
  | { type: "SAVE_JIRA_USER_MAPPING"; mapping: FigmaToJiraUserMapping }
  | { type: "SET_DEV_OWNER_OVERRIDE"; enabled: boolean }
  | { type: "SET_DEV_MODE"; enabled: boolean }
  | { type: "UNLOCK_ADMIN"; email: string }
  | { type: "SET_UI_VIEW_MODE"; mode: "admin" | "designer" }
  | {
      type: "SEND_LUMI_REPORT";
      period: "weekly" | "monthly" | "quarterly";
      recipients: string[];
      dryRun?: boolean;
    }
  | { type: "CHECK_ANALYTICS_API" }
  | { type: "MINIMIZE_PLUGIN" }
  | { type: "EXPAND_PLUGIN" }
  | { type: "RESIZE"; width: number; height: number };

export type MainMessage =
  | { type: "BOOT_DATA"; payload: BootData }
  | { type: "PLUGIN_ERROR"; payload: { message: string } }
  | { type: "STATE"; state: PluginState }
  | { type: "NAVIGATE"; tab: TabId }
  | { type: "ERROR"; message: string }
  | { type: "EXPORT_DATA"; filename: string; content: string; mimeType: string }
  | { type: "SCAN_COMPLETE"; snapshot: LumiScanSnapshot; result: ProductivityResult }
  | { type: "JIRA_SUGGESTIONS"; payload: JiraSuggestionsPayload }
  | { type: "START_SESSION_CONTEXT"; context: StartSessionContext }
  | { type: "JIRA_BOARD_DATA"; payload: JiraBoardPayload }
  | { type: "JIRA_TEST_RESULT"; ok: boolean; message: string; cause?: string; status?: number }
  | { type: "JIRA_SYNC_RESULT"; ok: boolean; message: string }
  | { type: "FIGMA_CONTEXT"; figmaContext: FigmaContextForJira }
  | { type: "DS_BENCHMARK_DATA"; payload: import("./backend/types/designSystemRegistry").DsBenchmarkDashboardPayload }
  | { type: "ADMIN_UNLOCK_RESULT"; ok: boolean; message: string }
  | {
      type: "LUMI_REPORT_SEND_RESULT";
      ok: boolean;
      message: string;
      mode?: "smtp" | "dry-run";
      outputPath?: string;
    }
  | { type: "ANALYTICS_API_STATUS"; ok: boolean; url: string; emailReady?: boolean; emailHint?: string }
  | { type: "PLUGIN_UI_MODE"; minimized: boolean };

// ─── Constants ───────────────────────────────────────────────────────────────

export const PROJECT_OPTIONS = [
  "Nykaa App",
  "Nykaa Web",
  "Nykaa Fashion",
  "Nykaa Beauty",
  "Checkout",
  "PDP",
  "Cart",
  "Search",
  "Account",
];

export const FLOW_OPTIONS = [
  "Checkout",
  "PDP",
  "Cart",
  "Search",
  "Login",
  "Address",
  "Payment",
  "Wishlist",
  "Order Tracking",
  "Brand Store",
  "PLP",
  "Home Page",
  "Other",
];

export const WORK_TYPE_OPTIONS: { value: WorkType; label: string }[] = [
  { value: "new-flow", label: "New flow" },
  { value: "iteration", label: "Iteration" },
  { value: "ux-improvement", label: "UX improvement" },
  { value: "visual-refinement", label: "Visual refinement" },
  { value: "component-migration", label: "Component migration" },
  { value: "design-qa-fix", label: "Design QA fix" },
  { value: "experiment", label: "Experiment" },
  { value: "production-support", label: "Production support" },
  { value: "other", label: "Other" },
];

export const COMPLEXITY_OPTIONS: WorkComplexity[] = [
  "low",
  "medium",
  "high",
  "very-high",
];

export const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
  { value: "mobile-web", label: "Mobile web" },
  { value: "desktop-web", label: "Desktop web" },
  { value: "responsive-web", label: "Responsive web" },
  { value: "other", label: "Other" },
];

export const SCAN_SCOPE_OPTIONS: { value: ScanScope; label: string; short: string }[] = [
  { value: "selected-frame", label: "Selected frame", short: "Frame" },
  { value: "selected-section", label: "Selected section", short: "Section" },
  { value: "current-page", label: "Current page", short: "Page" },
  { value: "whole-file", label: "Whole file", short: "File" },
];

export const DEFAULT_SETTINGS: PluginSettings = {
  autoStart: DEFAULT_AUTOSTART_SETTINGS,
  lumiLibraryPrefix: "LUMI",
  includeEmailInExport: false,
  jiraBaseUrl: "https://nykmage.atlassian.net",
  updatedAt: new Date().toISOString(),
};

export function shouldShowConsent(consent: LumiConsent | null): boolean {
  if (!consent) return true;
  if (consent.consentVersion !== LUMI_CONSENT_VERSION) return true;
  if (consent.mode === "declined") return true;
  if (!consent.consentGiven) return true;
  return false;
}

export const GLOBAL_DISCLAIMER =
  "LUMI Analytics measures design system adoption and estimated productivity benefit from opt-in work sessions. It should be used for design system improvement, planning, and enablement — not as the sole basis for performance review.";

export const ENABLEMENT_DISCLAIMER =
  "These metrics show LUMI adoption and productivity benefit from measured work sessions and benchmarks. They are for design system improvement and planning, not individual performance evaluation.";
