import type { LumiAnalyticsScanPayload } from "../backend/types/designSystemRegistry";
import type { LumiScanSnapshot } from "../types";
import { STORAGE_KEYS } from "../types";

/** Max finished scans kept locally (oldest pruned). */
export const MAX_STORED_SCANS = 32;

/** Max LUMI components stored per scan. */
const MAX_COMPONENT_USAGE = 24;

/** Max zoom locations stored per component. */
const MAX_LOCATIONS_PER_COMPONENT = 2;

const SCAN_INDEX_KEY = STORAGE_KEYS.scanIndex;
const LEGACY_SCANS_KEY = STORAGE_KEYS.scans;

function scanKey(sessionId: string): string {
  return `${STORAGE_KEYS.scanPrefix}${sessionId}`;
}

function estimateJsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /quota|5\s*MB|client storage/i.test(message);
}

/** Strip bulky fields before persisting — metrics/UI only need aggregates. */
export function compactScanSnapshotForStorage(snapshot: LumiScanSnapshot): LumiScanSnapshot {
  const compactUsage = snapshot.lumiComponentUsage
    .slice()
    .sort((a, b) => b.instances - a.instances)
    .slice(0, MAX_COMPONENT_USAGE)
    .map((row) => ({
      ...row,
      locations: row.locations.slice(0, MAX_LOCATIONS_PER_COMPONENT),
    }));

  const compactKeys = compactUsage.map((row) => row.componentKey);

  let systemClassification: LumiAnalyticsScanPayload | undefined;
  if (snapshot.systemClassification) {
    const { componentBreakdown: _removed, ...rest } = snapshot.systemClassification;
    systemClassification = {
      ...rest,
      componentBreakdown: [],
    };
  }

  const raw = snapshot.figmaCalculationsRaw as
    | {
        textStylePercent?: { full: number; partial: number };
        fillStylePercent?: { full: number; partial: number };
        aggregates?: unknown;
      }
    | undefined;

  const compactSignals = aggregateQualitySignals(snapshot.qualitySignals);

  return {
    ...snapshot,
    lumiComponentKeys: compactKeys.length ? compactKeys : snapshot.lumiComponentKeys.slice(0, MAX_COMPONENT_USAGE),
    lumiComponentUsage: compactUsage,
    qualitySignals: compactSignals,
    figmaCalculationsRaw: raw
      ? {
          textStylePercent: raw.textStylePercent,
          fillStylePercent: raw.fillStylePercent,
        }
      : undefined,
    systemClassification,
  };
}

function aggregateQualitySignals(
  signals: LumiScanSnapshot["qualitySignals"]
): LumiScanSnapshot["qualitySignals"] {
  const byType = new Map<string, LumiScanSnapshot["qualitySignals"][number]>();

  for (const signal of signals) {
    const existing = byType.get(signal.type);
    if (!existing) {
      byType.set(signal.type, { ...signal });
      continue;
    }
    existing.count += signal.count;
    if (severityRank(signal.severity) > severityRank(existing.severity)) {
      existing.severity = signal.severity;
    }
  }

  return [...byType.values()].slice(0, 12);
}

function severityRank(severity: string): number {
  switch (severity) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await figma.clientStorage.getAsync(key);
  return (raw as T) ?? fallback;
}

async function setJson(key: string, value: unknown): Promise<void> {
  await figma.clientStorage.setAsync(key, value);
}

async function deleteKey(key: string): Promise<void> {
  await figma.clientStorage.deleteAsync(key);
}

export type ScanIndexEntry = {
  sessionId: string;
  scannedAt: string;
};

async function readScanIndex(): Promise<ScanIndexEntry[]> {
  return getJson<ScanIndexEntry[]>(SCAN_INDEX_KEY, []);
}

async function writeScanIndex(entries: ScanIndexEntry[]): Promise<void> {
  const sorted = entries
    .slice()
    .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
    .slice(0, MAX_STORED_SCANS);
  await setJson(SCAN_INDEX_KEY, sorted);
}

async function migrateLegacyScansIfNeeded(): Promise<void> {
  const legacy = await getJson<LumiScanSnapshot[] | null>(LEGACY_SCANS_KEY, null);
  if (!legacy?.length) return;

  // Drop the monolithic blob first — it is usually what exceeded the 5 MB quota.
  await deleteKey(LEGACY_SCANS_KEY);

  const sorted = legacy
    .slice()
    .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
    .slice(0, MAX_STORED_SCANS);

  const index: ScanIndexEntry[] = [];
  for (const snapshot of sorted) {
    if (!snapshot?.sessionId) continue;
    try {
      const compact = compactScanSnapshotForStorage(snapshot);
      await setJson(scanKey(snapshot.sessionId), compact);
      index.push({ sessionId: snapshot.sessionId, scannedAt: snapshot.scannedAt });
    } catch {
      // Best-effort per scan — continue with others
    }
  }

  try {
    await writeScanIndex(index);
  } catch {
    // Index write failed — scans may still be individually retrievable
  }
}

let migrationPromise: Promise<void> | null = null;

export async function ensureScanStorageMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateLegacyScansIfNeeded().catch(() => {
      migrationPromise = null;
    });
  }
  await migrationPromise;
}

async function pruneOldestScans(count: number): Promise<number> {
  const index = await readScanIndex();
  if (index.length === 0) return 0;

  const sorted = index.slice().sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
  const toRemove = sorted.slice(0, Math.min(count, sorted.length));

  for (const entry of toRemove) {
    await deleteKey(scanKey(entry.sessionId));
  }

  const remaining = index.filter((e) => !toRemove.some((r) => r.sessionId === e.sessionId));
  await writeScanIndex(remaining);
  return toRemove.length;
}

async function persistScanSnapshot(compact: LumiScanSnapshot): Promise<void> {
  await setJson(scanKey(compact.sessionId), compact);

  const index = await readScanIndex();
  const without = index.filter((e) => e.sessionId !== compact.sessionId);
  without.unshift({ sessionId: compact.sessionId, scannedAt: compact.scannedAt });
  await writeScanIndex(without);
}

export async function saveScanSnapshotToStorage(snapshot: LumiScanSnapshot): Promise<void> {
  await ensureScanStorageMigrated();

  let compact = compactScanSnapshotForStorage(snapshot);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await persistScanSnapshot(compact);
      return;
    } catch (error) {
      if (!isQuotaError(error)) throw error;

      const pruned = await pruneOldestScans(Math.max(3, attempt * 4 + 3));
      if (pruned === 0 && attempt >= 2) {
        compact = ultraCompactScanSnapshot(compact);
      }
    }
  }

  throw new Error(
    "Could not save scan — local storage is full. Export your data from Settings, then use Privacy → Delete local data to free space."
  );
}

function ultraCompactScanSnapshot(snapshot: LumiScanSnapshot): LumiScanSnapshot {
  return {
    ...snapshot,
    lumiComponentKeys: [],
    lumiComponentUsage: [],
    qualitySignals: snapshot.qualitySignals.slice(0, 6),
    figmaCalculationsRaw: undefined,
    scanWarnings: snapshot.scanWarnings.slice(0, 5),
    systemClassification: snapshot.systemClassification
      ? {
          ...snapshot.systemClassification,
          componentBreakdown: [],
        }
      : undefined,
  };
}

export async function getScanSnapshotFromStorage(
  sessionId: string
): Promise<LumiScanSnapshot | null> {
  await ensureScanStorageMigrated();
  return getJson<LumiScanSnapshot | null>(scanKey(sessionId), null);
}

export async function getAllScanSnapshotsFromStorage(): Promise<LumiScanSnapshot[]> {
  await ensureScanStorageMigrated();
  const index = await readScanIndex();
  const snapshots = await Promise.all(
    index.map((entry) => getScanSnapshotFromStorage(entry.sessionId))
  );
  return snapshots.filter((s): s is LumiScanSnapshot => s !== null);
}

export async function deleteAllScanStorage(): Promise<void> {
  const index = await readScanIndex();
  await Promise.all(index.map((entry) => deleteKey(scanKey(entry.sessionId))));
  await deleteKey(SCAN_INDEX_KEY);
  await deleteKey(LEGACY_SCANS_KEY);
}

/** One-time compaction for existing installs that already hit quota. */
export async function compactExistingScanStorage(): Promise<{ compacted: number; freedEstimate: number }> {
  await ensureScanStorageMigrated();

  const index = await readScanIndex();
  let compacted = 0;
  let before = 0;
  let after = 0;

  for (const entry of index) {
    const key = scanKey(entry.sessionId);
    const existing = await getJson<LumiScanSnapshot | null>(key, null);
    if (!existing) continue;

    before += estimateJsonBytes(existing);
    const compact = compactScanSnapshotForStorage(existing);
    after += estimateJsonBytes(compact);

    if (estimateJsonBytes(compact) < estimateJsonBytes(existing)) {
      await setJson(key, compact);
      compacted += 1;
    }
  }

  return { compacted, freedEstimate: Math.max(0, before - after) };
}

export function formatScanStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
