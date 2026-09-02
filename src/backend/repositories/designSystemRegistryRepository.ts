import type {
  ComponentReplacementMapping,
  DesignSystemBenchmarkFilters,
  DesignSystemBenchmarkSnapshot,
  DesignSystemComponent,
  DesignSystemLibrary,
  DesignSystemIndexRun,
  DesignSystemStyle,
  DesignSystemVariable,
} from "../types/designSystemRegistry";

export interface DesignSystemRegistryRepository {
  upsertLibrary(library: DesignSystemLibrary): Promise<void>;
  upsertComponents(components: DesignSystemComponent[]): Promise<void>;
  upsertStyles(styles: DesignSystemStyle[]): Promise<void>;
  upsertVariables(variables: DesignSystemVariable[]): Promise<void>;
  upsertReplacementMappings(mappings: ComponentReplacementMapping[]): Promise<void>;
  saveIndexRun(run: DesignSystemIndexRun): Promise<void>;

  getLibraries(): Promise<DesignSystemLibrary[]>;
  getLibraryBySlug(slug: string): Promise<DesignSystemLibrary | null>;
  findComponentByKey(componentKey: string): Promise<DesignSystemComponent | null>;
  findStyleByKey(styleKey: string): Promise<DesignSystemStyle | null>;
  getComponents(filters?: {
    libraryId?: string;
    status?: string;
    search?: string;
  }): Promise<DesignSystemComponent[]>;
  getReplacementMappings(): Promise<ComponentReplacementMapping[]>;

  saveBenchmarkSnapshot(snapshot: DesignSystemBenchmarkSnapshot): Promise<void>;
  getBenchmarkSnapshots(filters?: DesignSystemBenchmarkFilters): Promise<DesignSystemBenchmarkSnapshot[]>;
  saveScanPayload(payload: import("../types/designSystemRegistry").LumiAnalyticsScanPayload): Promise<void>;
  getScanPayloads(filters?: DesignSystemBenchmarkFilters): Promise<
    import("../types/designSystemRegistry").LumiAnalyticsScanPayload[]
  >;
}
