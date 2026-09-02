import fs from "fs";
import path from "path";
import type { ProductivityResult, WorkSession } from "../../types";

export type ProductivityStoreShape = {
  results: ProductivityResult[];
  sessions: WorkSession[];
};

const EMPTY: ProductivityStoreShape = {
  results: [],
  sessions: [],
};

export type ProductivityDateFilters = {
  dateFrom?: string;
  dateTo?: string;
};

function inDateRange(iso: string, filters?: ProductivityDateFilters): boolean {
  if (filters?.dateFrom && iso < filters.dateFrom) return false;
  if (filters?.dateTo && iso > filters.dateTo) return false;
  return true;
}

export class JsonProductivityStore {
  private storePath: string;
  private data: ProductivityStoreShape;

  constructor(storePath?: string) {
    this.storePath =
      storePath ?? path.resolve(process.cwd(), "data/productivity-store.json");
    this.data = this.load();
  }

  private load(): ProductivityStoreShape {
    try {
      if (!fs.existsSync(this.storePath)) return { ...EMPTY, results: [], sessions: [] };
      const raw = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as Partial<ProductivityStoreShape>;
      return {
        results: raw.results ?? [],
        sessions: raw.sessions ?? [],
      };
    } catch {
      return { ...EMPTY, results: [], sessions: [] };
    }
  }

  private persist(): void {
    const dir = path.dirname(this.storePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
  }

  async upsertProductivityResult(result: ProductivityResult): Promise<void> {
    const idx = this.data.results.findIndex((r) => r.id === result.id || r.sessionId === result.sessionId);
    if (idx >= 0) this.data.results[idx] = result;
    else this.data.results.push(result);
    this.persist();
  }

  async upsertSession(session: WorkSession): Promise<void> {
    const idx = this.data.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) this.data.sessions[idx] = session;
    else this.data.sessions.push(session);
    this.persist();
  }

  async getResults(filters?: ProductivityDateFilters): Promise<ProductivityResult[]> {
    return this.data.results.filter((r) => inDateRange(r.createdAt, filters));
  }

  async getSessions(filters?: ProductivityDateFilters): Promise<WorkSession[]> {
    return this.data.sessions.filter((s) => {
      const ts = s.finishedAt ?? s.lastSeenAt ?? s.startedAt;
      return inDateRange(ts, filters);
    });
  }
}

export function createDefaultProductivityStore(): JsonProductivityStore {
  return new JsonProductivityStore();
}
