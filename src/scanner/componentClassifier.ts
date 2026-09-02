import type {
  ComponentClassificationResult,
  ComponentSystemClassification,
  DesignSystemRegistryCache,
} from "../backend/types/designSystemRegistry";
import { normalizeDesignSystemName } from "../backend/types/designSystemRegistry";
import { getInstanceMainComponent } from "./componentResolver";
import type { TraversalContext } from "./sectionTraversal";

const UI_LIKE_TYPES = new Set(["FRAME", "GROUP", "COMPONENT", "COMPONENT_SET"]);
const UI_NAME_PATTERN =
  /button|input|field|modal|dialog|drawer|card|nav|header|footer|form|table|chip|badge|tab|list|sheet|banner|toast|checkout|payment|pdp|cart/i;

function libraryTypeToClassification(
  libraryType: string
): ComponentSystemClassification {
  switch (libraryType) {
    case "lumi":
      return "lumi";
    case "nds-beauty":
      return "nds-beauty";
    case "nds-fashion":
      return "nds-fashion";
    case "legacy":
      return "legacy-other";
    case "local":
      return "local-component";
    default:
      return "legacy-other";
  }
}

function looksLikeUiFrame(node: SceneNode): boolean {
  if (!UI_LIKE_TYPES.has(node.type)) return false;
  return UI_NAME_PATTERN.test(node.name);
}

function matchDetachedByName(
  node: SceneNode,
  registry: DesignSystemRegistryCache
): ComponentClassificationResult | null {
  if (!looksLikeUiFrame(node)) return null;
  const normalized = normalizeDesignSystemName(node.name);
  const keys = registry.normalizedNameIndex[normalized];
  if (!keys?.length) return null;

  const hit = registry.componentKeyIndex[keys[0]!];
  if (!hit) return null;

  return {
    nodeId: node.id,
    nodeName: node.name,
    componentKey: keys[0],
    componentName: hit.componentName,
    classification: "detached-candidate",
    libraryId: hit.libraryId,
    libraryName: hit.libraryName,
    parentPath: [],
  };
}

export async function classifyInstanceNode(
  node: InstanceNode,
  context: TraversalContext,
  registry: DesignSystemRegistryCache
): Promise<ComponentClassificationResult> {
  const base = {
    nodeId: node.id,
    nodeName: node.name,
    pageName: context.pageName,
    sectionName: context.sectionName,
    frameName: context.frameName,
    parentPath: context.parentPath.split(" / ").filter(Boolean),
  };

  try {
    const main = await getInstanceMainComponent(node);
    if (!main) {
      return { ...base, classification: "detached-candidate" };
    }

    const registryHit = registry.componentKeyIndex[main.key];
    if (registryHit) {
      return {
        ...base,
        componentKey: main.key,
        componentName: main.name,
        componentSetName: main.parent?.type === "COMPONENT_SET" ? main.parent.name : undefined,
        variantName: main.name.includes("/") ? main.name.split("/").slice(1).join(" / ") : undefined,
        classification: libraryTypeToClassification(registryHit.libraryType),
        libraryId: registryHit.libraryId,
        libraryName: registryHit.libraryName,
      };
    }

    if (main.remote) {
      return {
        ...base,
        componentKey: main.key,
        componentName: main.name,
        classification: "legacy-other",
      };
    }

    return {
      ...base,
      componentKey: main.key,
      componentName: main.name,
      classification: "local-component",
    };
  } catch {
    return { ...base, classification: "unknown" };
  }
}

export function classifyNonInstanceNode(
  node: SceneNode,
  context: TraversalContext,
  registry: DesignSystemRegistryCache
): ComponentClassificationResult | null {
  if (node.type === "INSTANCE") return null;

  const detached = matchDetachedByName(node, registry);
  if (detached) {
    return {
      ...detached,
      pageName: context.pageName,
      sectionName: context.sectionName,
      frameName: context.frameName,
      parentPath: context.parentPath.split(" / ").filter(Boolean),
    };
  }

  if (looksLikeUiFrame(node)) {
    return {
      nodeId: node.id,
      nodeName: node.name,
      classification: "custom-ui",
      pageName: context.pageName,
      sectionName: context.sectionName,
      frameName: context.frameName,
      parentPath: context.parentPath.split(" / ").filter(Boolean),
    };
  }

  return null;
}

export function classifyStyleKey(
  styleKey: string | typeof figma.mixed | undefined,
  registry: DesignSystemRegistryCache
): "lumi" | "legacy" | "unknown" {
  if (!styleKey || styleKey === figma.mixed) return "unknown";
  const hit = registry.styleKeyIndex[styleKey];
  if (!hit) return "unknown";
  return hit.libraryType === "lumi" ? "lumi" : "legacy";
}

export function countClassifications(rows: ComponentClassificationResult[]) {
  const counts = {
    lumiInstances: 0,
    ndsBeautyInstances: 0,
    ndsFashionInstances: 0,
    legacyOtherInstances: 0,
    localComponentInstances: 0,
    detachedCandidates: 0,
    customUiCandidates: 0,
    unknownInstances: 0,
    totalComponentInstances: 0,
  };

  for (const row of rows) {
    switch (row.classification) {
      case "lumi":
        counts.lumiInstances += 1;
        counts.totalComponentInstances += 1;
        break;
      case "nds-beauty":
        counts.ndsBeautyInstances += 1;
        counts.totalComponentInstances += 1;
        break;
      case "nds-fashion":
        counts.ndsFashionInstances += 1;
        counts.totalComponentInstances += 1;
        break;
      case "legacy-other":
        counts.legacyOtherInstances += 1;
        counts.totalComponentInstances += 1;
        break;
      case "local-component":
        counts.localComponentInstances += 1;
        counts.totalComponentInstances += 1;
        break;
      case "detached-candidate":
        counts.detachedCandidates += 1;
        break;
      case "custom-ui":
        counts.customUiCandidates += 1;
        break;
      case "unknown":
        counts.unknownInstances += 1;
        counts.totalComponentInstances += 1;
        break;
    }
  }

  return counts;
}
