import registryJson from "../../generated/design-system-registry.json";
import type { DesignSystemRegistryCache } from "../../backend/types/designSystemRegistry";

export function getBundledDesignSystemRegistry(): DesignSystemRegistryCache {
  const cache = registryJson as DesignSystemRegistryCache;
  return {
    syncedAt: cache.syncedAt ?? null,
    source: cache.source ?? "empty",
    libraries: Array.isArray(cache.libraries) ? cache.libraries : [],
    componentKeyIndex: cache.componentKeyIndex ?? {},
    styleKeyIndex: cache.styleKeyIndex ?? {},
    normalizedNameIndex: cache.normalizedNameIndex ?? {},
    replacementMappings: Array.isArray(cache.replacementMappings)
      ? cache.replacementMappings
      : [],
  };
}

export function hasDesignSystemRegistry(): boolean {
  const cache = getBundledDesignSystemRegistry();
  return Object.keys(cache.componentKeyIndex).length > 0;
}
