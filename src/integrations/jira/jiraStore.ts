import type {
  FigmaToJiraUserMapping,
  JiraBoardSyncState,
  JiraConnectionConfig,
  JiraIssue,
  JiraSharedIssueSummary,
} from "./types";
import { DEFAULT_JIRA_CONNECTION_CONFIG } from "./types";
import { getBundledJiraCache } from "./jiraCacheLoader";
import { toSharedIssueSummaries } from "./jiraBoardSync";
import { getSharedPluginDataSafe, setSharedPluginDataSafe } from "../../productivity/sharedPluginData";

const STORAGE = {
  connectionConfig: "lumi.jira.connectionConfig.v1",
  legacyAdminConfig: "lumi.jira.adminConfig.v1",
  syncedIssues: "lumi.jira.syncedIssues.v1",
  syncState: "lumi.jira.syncState.v1",
  userMapping: "lumi.jira.userMapping.v1",
} as const;

const SHARED_SUMMARY_KEY = "jira.board.summary.v1";

function isDataSourceMode(value: unknown): value is JiraConnectionConfig["dataSourceMode"] {
  return (
    value === "env-cache" ||
    value === "direct" ||
    value === "proxy" ||
    value === "mock"
  );
}

function normalizeConnectionConfig(raw: unknown): JiraConnectionConfig {
  const legacy = raw as Record<string, unknown>;
  const mode = isDataSourceMode(legacy.dataSourceMode) ? legacy.dataSourceMode : "env-cache";

  return {
    siteUrl:
      typeof legacy.siteUrl === "string"
        ? legacy.siteUrl
        : DEFAULT_JIRA_CONNECTION_CONFIG.siteUrl,
    email: typeof legacy.email === "string" ? legacy.email : undefined,
    apiToken: typeof legacy.apiToken === "string" ? legacy.apiToken : undefined,
    projectKey:
      typeof legacy.projectKey === "string" ? legacy.projectKey : "UX",
    jql:
      typeof legacy.jql === "string" ? legacy.jql : DEFAULT_JIRA_CONNECTION_CONFIG.jql,
    dataSourceMode: mode,
    proxyUrl: typeof legacy.proxyUrl === "string" ? legacy.proxyUrl : undefined,
    savedAt:
      typeof legacy.savedAt === "string"
        ? legacy.savedAt
        : new Date().toISOString(),
    lastSyncedAt:
      typeof legacy.lastSyncedAt === "string" ? legacy.lastSyncedAt : undefined,
  };
}

async function migrateLegacyConnectionConfig(): Promise<JiraConnectionConfig | null> {
  const legacy = await figma.clientStorage.getAsync(STORAGE.legacyAdminConfig);
  if (!legacy || typeof legacy !== "object") return null;
  const migrated = normalizeConnectionConfig(legacy);
  await figma.clientStorage.setAsync(STORAGE.connectionConfig, migrated);
  await figma.clientStorage.deleteAsync(STORAGE.legacyAdminConfig);
  return migrated;
}

export async function loadJiraConnectionConfig(): Promise<JiraConnectionConfig | null> {
  const raw = await figma.clientStorage.getAsync(STORAGE.connectionConfig);
  if (raw && typeof raw === "object") {
    return normalizeConnectionConfig(raw);
  }
  return migrateLegacyConnectionConfig();
}

export async function saveJiraConnectionConfig(config: JiraConnectionConfig): Promise<void> {
  await figma.clientStorage.setAsync(STORAGE.connectionConfig, config);
}

export async function clearJiraConnectionConfig(): Promise<void> {
  await figma.clientStorage.deleteAsync(STORAGE.connectionConfig);
  await figma.clientStorage.deleteAsync(STORAGE.legacyAdminConfig);
}

/** @deprecated Use loadJiraConnectionConfig */
export const loadJiraAdminConfig = loadJiraConnectionConfig;

/** @deprecated Use saveJiraConnectionConfig */
export const saveJiraAdminConfig = saveJiraConnectionConfig;

/** @deprecated Use clearJiraConnectionConfig */
export const clearJiraAdminConfig = clearJiraConnectionConfig;

export async function resolveEffectiveJiraIssues(
  config?: JiraConnectionConfig | null
): Promise<JiraIssue[]> {
  const mode = config?.dataSourceMode ?? "env-cache";
  if (mode === "env-cache" || mode === "mock") {
    const cache = getBundledJiraCache();
    if (cache.issues.length > 0) return cache.issues;
  }

  const stored = await figma.clientStorage.getAsync(STORAGE.syncedIssues);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored as JiraIssue[];
  }

  return getBundledJiraCache().issues;
}

export async function loadSyncedJiraIssues(): Promise<JiraIssue[]> {
  return resolveEffectiveJiraIssues(await loadJiraConnectionConfig());
}

export async function saveSyncedJiraIssues(issues: JiraIssue[]): Promise<void> {
  await figma.clientStorage.setAsync(STORAGE.syncedIssues, issues);
  setSharedPluginDataSafe(SHARED_SUMMARY_KEY, JSON.stringify(toSharedIssueSummaries(issues)));
}

export async function loadJiraBoardSyncState(): Promise<JiraBoardSyncState | null> {
  const config = await loadJiraConnectionConfig();
  const mode = config?.dataSourceMode ?? "env-cache";
  const cache = getBundledJiraCache();

  if (mode === "env-cache" || mode === "mock") {
    const issues = cache.issues;
    return {
      lastSyncedAt: cache.syncedAt ?? undefined,
      totalIssues: issues.length,
      totalAssignees: cache.assignees.length,
      errors: [],
      cacheSource: cache.source,
      dataSourceMode: mode,
    };
  }

  const raw = await figma.clientStorage.getAsync(STORAGE.syncState);
  if (!raw || typeof raw !== "object") {
    const issues = await resolveEffectiveJiraIssues(config);
    return {
      lastSyncedAt: config?.lastSyncedAt,
      totalIssues: issues.length,
      totalAssignees: 0,
      errors: [],
      dataSourceMode: mode,
    };
  }
  return raw as JiraBoardSyncState;
}

export async function saveJiraBoardSyncState(state: JiraBoardSyncState): Promise<void> {
  await figma.clientStorage.setAsync(STORAGE.syncState, state);
}

export async function loadSharedJiraSummaries(): Promise<JiraSharedIssueSummary[]> {
  const raw = getSharedPluginDataSafe(SHARED_SUMMARY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as JiraSharedIssueSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function loadFigmaToJiraUserMapping(
  figmaUserId: string
): Promise<FigmaToJiraUserMapping | null> {
  const raw = await figma.clientStorage.getAsync(STORAGE.userMapping);
  if (!raw || typeof raw !== "object") return null;
  const map = raw as Record<string, FigmaToJiraUserMapping>;
  return map[figmaUserId] ?? null;
}

export async function saveFigmaToJiraUserMapping(mapping: FigmaToJiraUserMapping): Promise<void> {
  const raw = await figma.clientStorage.getAsync(STORAGE.userMapping);
  const map =
    raw && typeof raw === "object" ? (raw as Record<string, FigmaToJiraUserMapping>) : {};
  map[mapping.figmaUserId] = mapping;
  await figma.clientStorage.setAsync(STORAGE.userMapping, map);
}

export function getDefaultJiraConnectionConfig(): JiraConnectionConfig {
  return {
    ...DEFAULT_JIRA_CONNECTION_CONFIG,
    savedAt: new Date().toISOString(),
  };
}

/** @deprecated Use getDefaultJiraConnectionConfig */
export const getDefaultJiraAdminConfig = getDefaultJiraConnectionConfig;

export async function clearAllJiraData(): Promise<void> {
  await clearJiraConnectionConfig();
  await figma.clientStorage.deleteAsync(STORAGE.syncedIssues);
  await figma.clientStorage.deleteAsync(STORAGE.syncState);
  setSharedPluginDataSafe(SHARED_SUMMARY_KEY, "[]");
}

export async function loadJiraConnectionConfigForUi(input?: {
  isOwner?: boolean;
}): Promise<(import("../../types").JiraConnectionConfigUi) | null> {
  const config = (await loadJiraConnectionConfig()) ?? getDefaultJiraConnectionConfig();
  const cache = getBundledJiraCache();

  return {
    siteUrl: config.siteUrl,
    projectKey: config.projectKey,
    jql: cache.jql || config.jql,
    dataSourceMode: config.dataSourceMode,
    proxyUrl: config.proxyUrl,
    hasToken: !!config.apiToken,
    lastSyncedAt: cache.syncedAt ?? config.lastSyncedAt,
    cacheSource: cache.source,
    cacheTotal: cache.total,
    cacheAssignees: cache.assignees.length,
    email: input?.isOwner ? config.email : undefined,
  };
}

/** @deprecated Use loadJiraConnectionConfigForUi */
export const loadJiraAdminConfigForUi = loadJiraConnectionConfigForUi;

export async function saveJiraConnectionConfigFromUi(
  partial: Partial<import("../../types").JiraConnectionConfigUi> & {
    apiToken?: string;
    lastSyncedAt?: string;
  }
): Promise<JiraConnectionConfig> {
  const existing = await loadJiraConnectionConfig();
  const next: JiraConnectionConfig = {
    ...buildMergedConnectionConfig(existing, partial),
    savedAt: new Date().toISOString(),
    lastSyncedAt: partial.lastSyncedAt ?? existing?.lastSyncedAt,
  };
  await saveJiraConnectionConfig(next);
  return next;
}

/** Merge saved settings with current form values (does not persist). */
export async function resolveJiraConnectionConfig(
  partial?: Partial<import("../../types").JiraConnectionConfigUi> & { apiToken?: string }
): Promise<JiraConnectionConfig | null> {
  const existing = await loadJiraConnectionConfig();
  if (!partial) return existing ?? getDefaultJiraConnectionConfig();
  return buildMergedConnectionConfig(existing, partial);
}

function buildMergedConnectionConfig(
  existing: JiraConnectionConfig | null,
  partial: Partial<import("../../types").JiraConnectionConfigUi> & { apiToken?: string }
): JiraConnectionConfig {
  const defaults = getDefaultJiraConnectionConfig();
  return {
    ...(existing ?? defaults),
    siteUrl: partial.siteUrl ?? existing?.siteUrl ?? defaults.siteUrl,
    email: partial.email ?? existing?.email,
    projectKey: partial.projectKey ?? existing?.projectKey ?? "UX",
    jql: partial.jql ?? existing?.jql ?? defaults.jql,
    dataSourceMode: partial.dataSourceMode ?? existing?.dataSourceMode ?? "env-cache",
    proxyUrl: partial.proxyUrl ?? existing?.proxyUrl,
    apiToken: partial.apiToken?.trim() ? partial.apiToken.trim() : existing?.apiToken,
    savedAt: existing?.savedAt ?? defaults.savedAt,
    lastSyncedAt: existing?.lastSyncedAt,
  };
}

/** @deprecated Use saveJiraConnectionConfigFromUi */
export const saveJiraAdminConfigFromUi = saveJiraConnectionConfigFromUi;
