import fs from "fs";
import path from "path";
import type {
  ComponentReplacementMapping,
  DesignSystemBenchmarkFilters,
  DesignSystemBenchmarkSnapshot,
  DesignSystemComponent,
  DesignSystemIndexRun,
  DesignSystemLibrary,
  DesignSystemRegistryCache,
  DesignSystemStyle,
  DesignSystemVariable,
  LumiAnalyticsScanPayload,
} from "../types/designSystemRegistry";
import type { DesignSystemRegistryRepository } from "./designSystemRegistryRepository";

type StoreShape = {
  libraries: DesignSystemLibrary[];
  components: DesignSystemComponent[];
  styles: DesignSystemStyle[];
  variables: DesignSystemVariable[];
  indexRuns: DesignSystemIndexRun[];
  benchmarkSnapshots: DesignSystemBenchmarkSnapshot[];
  scanPayloads: LumiAnalyticsScanPayload[];
  replacementMappings: ComponentReplacementMapping[];
};

const EMPTY_STORE: StoreShape = {
  libraries: [],
  components: [],
  styles: [],
  variables: [],
  indexRuns: [],
  benchmarkSnapshots: [],
  scanPayloads: [],
  replacementMappings: [],
};

function matchesDate(iso: string, filters?: DesignSystemBenchmarkFilters): boolean {
  if (filters?.month) {
    const m = iso.slice(0, 7);
    if (m !== filters.month) return false;
  }
  if (filters?.dateFrom && iso < filters.dateFrom) return false;
  if (filters?.dateTo && iso > filters.dateTo) return false;
  return true;
}

export class JsonDesignSystemRegistryRepository implements DesignSystemRegistryRepository {
  private storePath: string;
  private data: StoreShape;

  constructor(storePath?: string) {
    this.storePath =
      storePath ?? path.resolve(process.cwd(), "data/design-system-store.json");
    this.data = this.load();
  }

  private load(): StoreShape {
    try {
      if (!fs.existsSync(this.storePath)) return { ...EMPTY_STORE };
      const raw = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as Partial<StoreShape>;
      return {
        libraries: raw.libraries ?? [],
        components: raw.components ?? [],
        styles: raw.styles ?? [],
        variables: raw.variables ?? [],
        indexRuns: raw.indexRuns ?? [],
        benchmarkSnapshots: raw.benchmarkSnapshots ?? [],
        scanPayloads: raw.scanPayloads ?? [],
        replacementMappings: raw.replacementMappings ?? [],
      };
    } catch {
      return { ...EMPTY_STORE };
    }
  }

  private persist(): void {
    const dir = path.dirname(this.storePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
  }

  async upsertLibrary(library: DesignSystemLibrary): Promise<void> {
    const idx = this.data.libraries.findIndex((l) => l.id === library.id || l.slug === library.slug);
    if (idx >= 0) this.data.libraries[idx] = library;
    else this.data.libraries.push(library);
    this.persist();
  }

  async upsertComponents(components: DesignSystemComponent[]): Promise<void> {
    for (const c of components) {
      const idx = this.data.components.findIndex(
        (x) => x.figmaKey === c.figmaKey && x.libraryId === c.libraryId
      );
      if (idx >= 0) this.data.components[idx] = c;
      else this.data.components.push(c);
    }
    this.persist();
  }

  async upsertStyles(styles: DesignSystemStyle[]): Promise<void> {
    for (const s of styles) {
      const key = s.figmaStyleKey ?? s.figmaStyleId ?? s.id;
      const idx = this.data.styles.findIndex(
        (x) => (x.figmaStyleKey ?? x.figmaStyleId) === key && x.libraryId === s.libraryId
      );
      if (idx >= 0) this.data.styles[idx] = s;
      else this.data.styles.push(s);
    }
    this.persist();
  }

  async upsertVariables(variables: DesignSystemVariable[]): Promise<void> {
    for (const v of variables) {
      const key = v.figmaVariableKey ?? v.figmaVariableId ?? v.id;
      const idx = this.data.variables.findIndex(
        (x) => (x.figmaVariableKey ?? x.figmaVariableId) === key && x.libraryId === v.libraryId
      );
      if (idx >= 0) this.data.variables[idx] = v;
      else this.data.variables.push(v);
    }
    this.persist();
  }

  async upsertReplacementMappings(mappings: ComponentReplacementMapping[]): Promise<void> {
    for (const m of mappings) {
      const idx = this.data.replacementMappings.findIndex(
        (x) =>
          x.sourceComponentKey === m.sourceComponentKey &&
          x.targetComponentKey === m.targetComponentKey
      );
      if (idx >= 0) this.data.replacementMappings[idx] = m;
      else this.data.replacementMappings.push(m);
    }
    this.persist();
  }

  async saveIndexRun(run: DesignSystemIndexRun): Promise<void> {
    const idx = this.data.indexRuns.findIndex((r) => r.id === run.id);
    if (idx >= 0) this.data.indexRuns[idx] = run;
    else this.data.indexRuns.push(run);
    this.persist();
  }

  async getLibraries(): Promise<DesignSystemLibrary[]> {
    return [...this.data.libraries];
  }

  async getLibraryBySlug(slug: string): Promise<DesignSystemLibrary | null> {
    return this.data.libraries.find((l) => l.slug === slug) ?? null;
  }

  async findComponentByKey(componentKey: string): Promise<DesignSystemComponent | null> {
    return this.data.components.find((c) => c.figmaKey === componentKey) ?? null;
  }

  async findStyleByKey(styleKey: string): Promise<DesignSystemStyle | null> {
    return (
      this.data.styles.find((s) => s.figmaStyleKey === styleKey || s.figmaStyleId === styleKey) ??
      null
    );
  }

  async getComponents(filters?: {
    libraryId?: string;
    status?: string;
    search?: string;
  }): Promise<DesignSystemComponent[]> {
    let rows = [...this.data.components];
    if (filters?.libraryId) rows = rows.filter((c) => c.libraryId === filters.libraryId);
    if (filters?.status) rows = rows.filter((c) => c.status === filters.status);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.normalizedName.toLowerCase().includes(q)
      );
    }
    return rows;
  }

  async getReplacementMappings(): Promise<ComponentReplacementMapping[]> {
    return [...this.data.replacementMappings];
  }

  async saveBenchmarkSnapshot(snapshot: DesignSystemBenchmarkSnapshot): Promise<void> {
    const idx = this.data.benchmarkSnapshots.findIndex((s) => s.id === snapshot.id);
    if (idx >= 0) this.data.benchmarkSnapshots[idx] = snapshot;
    else this.data.benchmarkSnapshots.push(snapshot);
    this.persist();
  }

  async getBenchmarkSnapshots(
    filters?: DesignSystemBenchmarkFilters
  ): Promise<DesignSystemBenchmarkSnapshot[]> {
    return this.data.benchmarkSnapshots.filter((s) => {
      if (filters?.fileKey && s.fileKey !== filters.fileKey) return false;
      if (filters?.flowName && s.flowName !== filters.flowName) return false;
      if (filters?.teamName && s.teamName !== filters.teamName) return false;
      if (filters?.jiraIssueKey && s.jiraIssueKey !== filters.jiraIssueKey) return false;
      if (filters?.month && s.month !== filters.month) return false;
      if (!matchesDate(s.createdAt, filters)) return false;
      return true;
    });
  }

  async saveScanPayload(payload: LumiAnalyticsScanPayload): Promise<void> {
    const idx = this.data.scanPayloads.findIndex((p) => p.scanId === payload.scanId);
    if (idx >= 0) this.data.scanPayloads[idx] = payload;
    else this.data.scanPayloads.push(payload);
    this.persist();
  }

  async getScanPayloads(
    filters?: DesignSystemBenchmarkFilters
  ): Promise<LumiAnalyticsScanPayload[]> {
    return this.data.scanPayloads.filter((p) => {
      if (filters?.fileKey && p.fileKey !== filters.fileKey) return false;
      if (filters?.flowName && p.flowName !== filters.flowName) return false;
      if (filters?.teamName && p.teamName !== filters.teamName) return false;
      if (filters?.jiraIssueKey && p.jiraIssueKey !== filters.jiraIssueKey) return false;
      if (filters?.designerName && p.designerName !== filters.designerName) return false;
      if (!matchesDate(p.scannedAt, filters)) return false;
      return true;
    });
  }

  exportRegistryCache(): DesignSystemRegistryCache {
    const componentKeyIndex: DesignSystemRegistryCache["componentKeyIndex"] = {};
    const styleKeyIndex: DesignSystemRegistryCache["styleKeyIndex"] = {};
    const normalizedNameIndex: Record<string, string[]> = {};

    for (const c of this.data.components) {
      const lib = this.data.libraries.find((l) => l.id === c.libraryId);
      if (!lib || c.status === "missing") continue;
      componentKeyIndex[c.figmaKey] = {
        libraryId: c.libraryId,
        librarySlug: lib.slug,
        libraryType: lib.type,
        libraryName: lib.name,
        componentName: c.name,
        normalizedName: c.normalizedName,
        status: c.status,
      };
      const names = normalizedNameIndex[c.normalizedName] ?? [];
      if (!names.includes(c.figmaKey)) names.push(c.figmaKey);
      normalizedNameIndex[c.normalizedName] = names;
    }

    for (const s of this.data.styles) {
      const lib = this.data.libraries.find((l) => l.id === s.libraryId);
      const key = s.figmaStyleKey ?? s.figmaStyleId;
      if (!lib || !key || s.status === "missing") continue;
      styleKeyIndex[key] = {
        libraryId: s.libraryId,
        librarySlug: lib.slug,
        libraryType: lib.type,
        libraryName: lib.name,
        styleName: s.name,
        normalizedName: s.normalizedName,
        type: s.type,
      };
    }

    return {
      syncedAt: new Date().toISOString(),
      source: this.data.libraries.length > 0 ? "env-sync" : "empty",
      libraries: this.data.libraries,
      componentKeyIndex,
      styleKeyIndex,
      normalizedNameIndex,
      replacementMappings: this.data.replacementMappings,
    };
  }
}

export function createDefaultRepository(): JsonDesignSystemRegistryRepository {
  return new JsonDesignSystemRegistryRepository();
}
