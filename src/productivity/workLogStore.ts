import type {
  BenchmarkFilters,
  DesignerProfile,
  LumiScanSnapshot,
  ProductivityBenchmark,
  ProductivityFilters,
  ProductivityResult,
  WorkSession,
  WorkSessionFilters,
} from "../types";
import { STORAGE_KEYS } from "../types";
import {
  getSharedPluginDataSafe,
  setSharedPluginDataSafe,
  clearSharedPluginDataSafe,
} from "./sharedPluginData";
import {
  deleteAllScanStorage,
  getScanSnapshotFromStorage,
  getAllScanSnapshotsFromStorage,
  saveScanSnapshotToStorage,
} from "./scanStorage";
import { getActiveSessionFromStorage } from "./sessionHeartbeat";

export interface WorkLogStore {
  saveDesignerProfile(profile: DesignerProfile): Promise<void>;
  getDesignerProfile(userId: string): Promise<DesignerProfile | null>;

  saveSession(session: WorkSession): Promise<void>;
  updateSession(session: WorkSession): Promise<void>;
  getActiveSession(userId: string): Promise<WorkSession | null>;
  getSessions(filters?: WorkSessionFilters): Promise<WorkSession[]>;

  saveScanSnapshot(snapshot: LumiScanSnapshot): Promise<void>;
  getScanSnapshot(sessionId: string): Promise<LumiScanSnapshot | null>;

  saveProductivityResult(result: ProductivityResult): Promise<void>;
  getProductivityResults(filters?: ProductivityFilters): Promise<ProductivityResult[]>;

  saveBenchmark(benchmark: ProductivityBenchmark): Promise<void>;
  getBenchmarks(filters?: BenchmarkFilters): Promise<ProductivityBenchmark[]>;
  deleteBenchmark(benchmarkId: string): Promise<void>;

  deleteAllLocalData(): Promise<void>;
}

async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await figma.clientStorage.getAsync(key);
  return (raw as T) ?? fallback;
}

async function setJson(key: string, value: unknown): Promise<void> {
  await figma.clientStorage.setAsync(key, value);
}

export class LocalWorkLogStore implements WorkLogStore {
  async saveDesignerProfile(profile: DesignerProfile): Promise<void> {
    await setJson(STORAGE_KEYS.profile, profile);
  }

  async getDesignerProfile(_userId: string): Promise<DesignerProfile | null> {
    return getJson<DesignerProfile | null>(STORAGE_KEYS.profile, null);
  }

  async saveSession(session: WorkSession): Promise<void> {
    const sessions = await this.getSessions();
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) sessions[idx] = session;
    else sessions.push(session);
    await setJson(STORAGE_KEYS.sessions, sessions);
    if (["draft", "active", "paused"].includes(session.status)) {
      await setJson(STORAGE_KEYS.activeSession, session);
    }
    await this.writeCompactSummary(session);
  }

  async updateSession(session: WorkSession): Promise<void> {
    await this.saveSession(session);
    if (session.status === "finished" || session.status === "cancelled") {
      await setJson(STORAGE_KEYS.activeSession, null);
    }
  }

  async getActiveSession(userId: string): Promise<WorkSession | null> {
    const active = await getActiveSessionFromStorage(userId);
    if (active) return active;
    const sessions = await this.getSessions({ designerUserId: userId });
    return (
      sessions.find((s) => ["draft", "active", "paused"].includes(s.status)) ?? null
    );
  }

  async getSessions(filters?: WorkSessionFilters): Promise<WorkSession[]> {
    let sessions = await getJson<WorkSession[]>(STORAGE_KEYS.sessions, []);
    if (filters?.designerUserId) {
      sessions = sessions.filter((s) => s.designerUserId === filters.designerUserId);
    }
    if (filters?.status?.length) {
      sessions = sessions.filter((s) => filters.status!.includes(s.status));
    }
    if (filters?.fromDate) {
      sessions = sessions.filter((s) => s.startedAt >= filters.fromDate!);
    }
    if (filters?.toDate) {
      sessions = sessions.filter((s) => s.startedAt <= filters.toDate!);
    }
    if (filters?.projectName) {
      sessions = sessions.filter((s) => s.projectName === filters.projectName);
    }
    if (filters?.flowName) {
      sessions = sessions.filter((s) => s.flowName === filters.flowName);
    }
    return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async saveScanSnapshot(snapshot: LumiScanSnapshot): Promise<void> {
    await saveScanSnapshotToStorage(snapshot);
  }

  async getScanSnapshot(sessionId: string): Promise<LumiScanSnapshot | null> {
    return getScanSnapshotFromStorage(sessionId);
  }

  async saveProductivityResult(result: ProductivityResult): Promise<void> {
    const results = await getJson<ProductivityResult[]>(STORAGE_KEYS.productivity, []);
    const idx = results.findIndex((r) => r.sessionId === result.sessionId);
    if (idx >= 0) results[idx] = result;
    else results.push(result);
    await setJson(STORAGE_KEYS.productivity, results);
    await this.writeCompactProductivity(result);
  }

  async getProductivityResults(filters?: ProductivityFilters): Promise<ProductivityResult[]> {
    let results = await getJson<ProductivityResult[]>(STORAGE_KEYS.productivity, []);
    if (filters?.designerUserId) {
      results = results.filter((r) => r.designerUserId === filters.designerUserId);
    }
    if (filters?.teamName) {
      results = results.filter((r) => r.teamName === filters.teamName);
    }
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveBenchmark(benchmark: ProductivityBenchmark): Promise<void> {
    const benchmarks = await getJson<ProductivityBenchmark[]>(STORAGE_KEYS.benchmarks, []);
    benchmarks.push(benchmark);
    await setJson(STORAGE_KEYS.benchmarks, benchmarks);
  }

  async getBenchmarks(filters?: BenchmarkFilters): Promise<ProductivityBenchmark[]> {
    let benchmarks = await getJson<ProductivityBenchmark[]>(STORAGE_KEYS.benchmarks, []);
    if (filters?.projectName) {
      benchmarks = benchmarks.filter((b) => b.key.projectName === filters.projectName);
    }
    if (filters?.flowName) {
      benchmarks = benchmarks.filter((b) => b.key.flowName === filters.flowName);
    }
    return benchmarks;
  }

  async deleteBenchmark(benchmarkId: string): Promise<void> {
    const benchmarks = await getJson<ProductivityBenchmark[]>(STORAGE_KEYS.benchmarks, []);
    await setJson(
      STORAGE_KEYS.benchmarks,
      benchmarks.filter((b) => b.id !== benchmarkId)
    );
  }

  async deleteAllLocalData(): Promise<void> {
    await deleteAllScanStorage();
    for (const key of Object.values(STORAGE_KEYS)) {
      if (
        key === STORAGE_KEYS.scans ||
        key === STORAGE_KEYS.scanIndex ||
        key === STORAGE_KEYS.scanPrefix
      ) {
        continue;
      }
      await figma.clientStorage.setAsync(key, null);
    }
    clearSharedPluginDataSafe(["summaries", "productivity", "productivityTrend"]);
  }

  private async writeCompactSummary(session: WorkSession): Promise<void> {
    if (session.status !== "finished") return;
    try {
      const existing = getSharedPluginDataSafe("summaries");
      const summaries = existing ? JSON.parse(existing) : [];
      summaries.push({
        id: session.id,
        designer: session.designerName,
        project: session.projectName,
        minutes: session.adjustedActualMinutes,
        finishedAt: session.finishedAt,
      });
      const compact = summaries.slice(-50);
      setSharedPluginDataSafe("summaries", JSON.stringify(compact));
    } catch {
      // shared plugin data limit — skip
    }
  }

  private async writeCompactProductivity(result: ProductivityResult): Promise<void> {
    try {
      const existing = getSharedPluginDataSafe("productivity");
      const rows = existing ? JSON.parse(existing) : [];
      rows.push({
        sessionId: result.sessionId,
        lumiAdoption: result.lumiAdoptionRate,
        hoursSaved: result.observedHoursSaved,
        confidence: result.confidence.label,
      });
      setSharedPluginDataSafe("productivity", JSON.stringify(rows.slice(-50)));
    } catch {
      // skip
    }
  }
}

/** Stub for future cloud backend sync. */
export class StubRemoteWorkLogStore implements WorkLogStore {
  private local = new LocalWorkLogStore();

  saveDesignerProfile = (p: DesignerProfile) => this.local.saveDesignerProfile(p);
  getDesignerProfile = (id: string) => this.local.getDesignerProfile(id);
  saveSession = (s: WorkSession) => this.local.saveSession(s);
  updateSession = (s: WorkSession) => this.local.updateSession(s);
  getActiveSession = (id: string) => this.local.getActiveSession(id);
  getSessions = (f?: WorkSessionFilters) => this.local.getSessions(f);
  saveScanSnapshot = (s: LumiScanSnapshot) => this.local.saveScanSnapshot(s);
  getScanSnapshot = (id: string) => this.local.getScanSnapshot(id);
  saveProductivityResult = (r: ProductivityResult) => this.local.saveProductivityResult(r);
  getProductivityResults = (f?: ProductivityFilters) => this.local.getProductivityResults(f);
  saveBenchmark = (b: ProductivityBenchmark) => this.local.saveBenchmark(b);
  getBenchmarks = (f?: BenchmarkFilters) => this.local.getBenchmarks(f);
  deleteBenchmark = (id: string) => this.local.deleteBenchmark(id);
  deleteAllLocalData = () => this.local.deleteAllLocalData();
}

export const workLogStore: WorkLogStore = new LocalWorkLogStore();

export async function loadSettings<T>(fallback: T): Promise<T> {
  return getJson(STORAGE_KEYS.settingsLegacy, fallback);
}

export async function saveSettings(settings: unknown) {
  await setJson(STORAGE_KEYS.settingsLegacy, settings);
}
