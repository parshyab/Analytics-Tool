import type {
  LumiConsent,
  ProductivityResult,
  ProductivityTrendFilters,
  DesignerTrendSeries,
  WorkSession,
} from "../types";
import {
  buildTrendSeries,
  filterResultsForTrend,
} from "./productivityTrendAggregator";
import { getSharedPluginDataSafe, setSharedPluginDataSafe } from "./sharedPluginData";

export interface RealtimeProductivityStore {
  subscribeToProductivityResults(
    filters: ProductivityTrendFilters,
    callback: (results: ProductivityResult[]) => void
  ): () => void;

  publishSessionHeartbeat(session: WorkSession): Promise<void>;
  publishFinishedSession(result: ProductivityResult): Promise<void>;
  getTrendData(
    filters: ProductivityTrendFilters,
    opts?: {
      results: ProductivityResult[];
      sessions: WorkSession[];
      consent?: LumiConsent | null;
      currentUserId?: string;
      teamName?: string;
    }
  ): Promise<DesignerTrendSeries[]>;
}

type Listener = (results: ProductivityResult[]) => void;

/** In-memory store for UI-side live updates (no figma dependency). */
export class InMemoryRealtimeProductivityStore implements RealtimeProductivityStore {
  private results: ProductivityResult[] = [];
  private listeners = new Map<string, Set<Listener>>();

  setResults(results: ProductivityResult[]): void {
    this.results = results;
    this.notifyAll();
  }

  private notifyAll(): void {
    for (const [, set] of this.listeners) {
      for (const cb of set) cb(this.results);
    }
  }

  subscribeToProductivityResults(
    _filters: ProductivityTrendFilters,
    callback: (results: ProductivityResult[]) => void
  ): () => void {
    const key = "default";
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(callback);
    callback(this.results);
    return () => this.listeners.get(key)?.delete(callback);
  }

  async publishSessionHeartbeat(_session: WorkSession): Promise<void> {
    this.notifyAll();
  }

  async publishFinishedSession(result: ProductivityResult): Promise<void> {
    const idx = this.results.findIndex((r) => r.sessionId === result.sessionId);
    if (idx >= 0) this.results[idx] = result;
    else this.results.push(result);
    this.notifyAll();
  }

  async getTrendData(
    filters: ProductivityTrendFilters,
    opts?: {
      results: ProductivityResult[];
      sessions: WorkSession[];
      consent?: LumiConsent | null;
      currentUserId?: string;
      teamName?: string;
    }
  ): Promise<DesignerTrendSeries[]> {
    const results = opts?.results ?? this.results;
    const sessions = opts?.sessions ?? [];
    return buildTrendSeries(results, sessions, filters, {
      consent: opts?.consent,
      currentUserId: opts?.currentUserId,
      teamName: opts?.teamName,
    });
  }
}

/** Reads from figma.clientStorage in plugin main thread. */
export class LocalRealtimeProductivityStore implements RealtimeProductivityStore {
  private listeners = new Map<string, Set<Listener>>();

  constructor(
    private getResults: () => Promise<ProductivityResult[]>,
    private getSessions: () => Promise<WorkSession[]>,
    private onHeartbeat?: (session: WorkSession) => Promise<void>
  ) {}

  subscribeToProductivityResults(
    filters: ProductivityTrendFilters,
    callback: (results: ProductivityResult[]) => void
  ): () => void {
    const key = JSON.stringify(filters);
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(callback);

    this.getResults().then((results) => {
      const { results: filtered } = filterResultsForTrend(results, [], filters);
      callback(filtered);
    });

    return () => this.listeners.get(key)?.delete(callback);
  }

  async publishSessionHeartbeat(session: WorkSession): Promise<void> {
    await this.onHeartbeat?.(session);
    await this.notifyListeners();
  }

  async publishFinishedSession(_result: ProductivityResult): Promise<void> {
    await this.notifyListeners();
  }

  async getTrendData(
    filters: ProductivityTrendFilters,
    opts?: {
      results: ProductivityResult[];
      sessions: WorkSession[];
      consent?: LumiConsent | null;
      currentUserId?: string;
      teamName?: string;
    }
  ): Promise<DesignerTrendSeries[]> {
    const results = opts?.results ?? (await this.getResults());
    const sessions = opts?.sessions ?? (await this.getSessions());
    return buildTrendSeries(results, sessions, filters, opts);
  }

  private async notifyListeners(): Promise<void> {
    const results = await this.getResults();
    for (const [key, set] of this.listeners) {
      const filters = JSON.parse(key) as ProductivityTrendFilters;
      const { results: filtered } = filterResultsForTrend(results, [], filters);
      for (const cb of set) cb(filtered);
    }
  }
}

type CompactProductivityRow = {
  sessionId: string;
  designerUserId: string;
  designerName: string;
  teamName?: string;
  lumiAdoption: number;
  hoursSaved?: number;
  actualMinutes?: number;
  confidence: string;
  createdAt: string;
};

/** Reads compact summaries from shared plugin data on the file. */
export class SharedFileRealtimeProductivityStore implements RealtimeProductivityStore {
  subscribeToProductivityResults(
    _filters: ProductivityTrendFilters,
    callback: (results: ProductivityResult[]) => void
  ): () => void {
    callback(this.readCompactAsResults());
    return () => {};
  }

  async publishSessionHeartbeat(_session: WorkSession): Promise<void> {}

  async publishFinishedSession(result: ProductivityResult): Promise<void> {
    const rows = this.readCompactRows();
    rows.push({
      sessionId: result.sessionId,
      designerUserId: result.designerUserId,
      designerName: result.designerName,
      teamName: result.teamName,
      lumiAdoption: result.lumiAdoptionRate,
      hoursSaved: result.observedHoursSaved,
      actualMinutes: result.actualMinutes,
      confidence: result.confidence.label,
      createdAt: result.createdAt,
    });
    setSharedPluginDataSafe("productivityTrend", JSON.stringify(rows.slice(-100)));
  }

  async getTrendData(
    filters: ProductivityTrendFilters,
    opts?: {
      results: ProductivityResult[];
      sessions: WorkSession[];
      consent?: LumiConsent | null;
      currentUserId?: string;
      teamName?: string;
    }
  ): Promise<DesignerTrendSeries[]> {
    const merged = [
      ...this.readCompactAsResults(),
      ...(opts?.results ?? []),
    ];
    const unique = new Map<string, ProductivityResult>();
    for (const r of merged) unique.set(r.sessionId, r);

    return buildTrendSeries(
      [...unique.values()],
      opts?.sessions ?? [],
      filters,
      opts
    );
  }

  private readCompactRows(): CompactProductivityRow[] {
    const raw = getSharedPluginDataSafe("productivityTrend");
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CompactProductivityRow[];
    } catch {
      return [];
    }
  }

  private readCompactAsResults(): ProductivityResult[] {
    return this.readCompactRows().map((row, i) => ({
      id: `compact-${i}`,
      sessionId: row.sessionId,
      designerUserId: row.designerUserId,
      designerName: row.designerName,
      teamName: row.teamName,
      actualMinutes: row.actualMinutes ?? 0,
      observedHoursSaved: row.hoursSaved,
      lumiAdoptionRate: row.lumiAdoption,
      tokenAdoptionRate: 0,
      styleAdoptionRate: 0,
      lumiComponentInstances: 0,
      uniqueLumiComponents: 0,
      detachedCandidates: 0,
      customColors: 0,
      qualityScore: 0,
      designSystemLeverageScore: 0,
      confidence: {
        label: row.confidence as ProductivityResult["confidence"]["label"],
        score: 0,
        reasons: [],
      },
      confidenceNotes: [],
      createdAt: row.createdAt,
    }));
  }
}

/** Placeholder for Supabase / Firebase / custom API — does not block local mode. */
export class StubRemoteRealtimeProductivityStore implements RealtimeProductivityStore {
  subscribeToProductivityResults(
    _filters: ProductivityTrendFilters,
    callback: (results: ProductivityResult[]) => void
  ): () => void {
    callback([]);
    return () => {};
  }

  async publishSessionHeartbeat(_session: WorkSession): Promise<void> {}

  async publishFinishedSession(_result: ProductivityResult): Promise<void> {}

  async getTrendData(
    _filters: ProductivityTrendFilters,
    opts?: {
      results: ProductivityResult[];
      sessions: WorkSession[];
      consent?: LumiConsent | null;
      currentUserId?: string;
      teamName?: string;
    }
  ): Promise<DesignerTrendSeries[]> {
    if (!opts?.results) return [];
    return buildTrendSeries(opts.results, opts.sessions ?? [], _filters, opts);
  }
}

export const uiTrendStore = new InMemoryRealtimeProductivityStore();
