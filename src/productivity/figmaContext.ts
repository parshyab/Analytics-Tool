import type { FigmaContextForJira, FigmaContextNodeType, FigmaScopeMetrics } from "../types";
import { getInstanceMainComponent } from "../scanner/componentResolver";
import { safeWalkSceneNodes } from "../scanner/safeNodeTraversal";

const MAX_PARENT_DEPTH = 12;
const SCOPE_METRICS_NODE_LIMIT = 6000;

function toContextNodeType(type?: string): FigmaContextNodeType {
  switch (type) {
    case "FRAME":
    case "SECTION":
    case "PAGE":
    case "GROUP":
    case "INSTANCE":
    case "COMPONENT":
    case "COMPONENT_SET":
      return type;
    default:
      return "UNKNOWN";
  }
}

function findNearestNamedAncestor(
  node: SceneNode | null,
  targetTypes: SceneNode["type"][]
): SceneNode | null {
  let current: BaseNode | null = node?.parent ?? null;
  while (current && current.type !== "DOCUMENT") {
    if ("type" in current && targetTypes.includes(current.type as SceneNode["type"])) {
      return current as SceneNode;
    }
    current = current.parent;
  }
  return null;
}

function collectScopeMetricsFromNode(
  node: SceneNode,
  metrics: {
    layerCount: number;
    frameCount: number;
    instanceCount: number;
    textNodeCount: number;
    variantCount: number;
    hasFormsModalsTables: boolean;
  }
): void {
  metrics.layerCount += 1;
  const name = node.name.toLowerCase();
  const keywordPattern = /form|modal|dialog|drawer|table|sheet|checkout|payment|address/i;
  if (keywordPattern.test(name)) metrics.hasFormsModalsTables = true;

  if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    metrics.frameCount += 1;
  }

  if (node.type === "INSTANCE") metrics.instanceCount += 1;
  if (node.type === "TEXT") metrics.textNodeCount += 1;

  if (node.type === "COMPONENT_SET") {
    try {
      metrics.variantCount += node.children.length;
    } catch {
      // skip inaccessible children
    }
  }
}

export async function analyzeFigmaScopeMetrics(root: BaseNode): Promise<FigmaScopeMetrics> {
  const metrics = {
    layerCount: 0,
    frameCount: 0,
    instanceCount: 0,
    textNodeCount: 0,
    variantCount: 0,
    hasFormsModalsTables: false,
  };

  const instanceNodes: InstanceNode[] = [];

  safeWalkSceneNodes(
    root,
    (node) => {
      collectScopeMetricsFromNode(node, metrics);
      if (node.type === "INSTANCE") instanceNodes.push(node);
    },
    { maxNodes: SCOPE_METRICS_NODE_LIMIT }
  );

  const componentKeys = new Set<string>();
  for (const instance of instanceNodes) {
    try {
      const mainComponent = await getInstanceMainComponent(instance);
      if (mainComponent) componentKeys.add(mainComponent.key);
    } catch {
      // skip
    }
  }

  return {
    layerCount: metrics.layerCount,
    frameCount: metrics.frameCount,
    instanceCount: metrics.instanceCount,
    uniqueComponentCount: componentKeys.size,
    textNodeCount: metrics.textNodeCount,
    variantCount: metrics.variantCount,
    hasFormsModalsTables: metrics.hasFormsModalsTables,
  };
}

function resolveScopeRoot(context: FigmaContextForJira): BaseNode | null {
  const page = figma.currentPage;
  const selection = page.selection[0];

  if (context.selectedNodeType === "SECTION" && selection) return selection;
  if (
    context.selectedNodeType === "FRAME" ||
    context.selectedNodeType === "COMPONENT" ||
    context.selectedNodeType === "COMPONENT_SET"
  ) {
    return selection ?? null;
  }

  const section = selection
    ? findNearestNamedAncestor(selection, ["SECTION"])
    : null;
  if (section) return section;

  const frame = selection
    ? findNearestNamedAncestor(selection, ["FRAME", "COMPONENT", "COMPONENT_SET"])
    : null;
  if (frame) return frame;

  if (selection) return selection;
  return page;
}

export async function getCurrentFigmaContext(flowName?: string): Promise<FigmaContextForJira> {
  const fileName = figma.root?.name ?? "Untitled";
  const fileKey = figma.fileKey ?? null;
  const page = figma.currentPage;
  const pageName = page?.name ?? "Page";
  const selection = page?.selection?.[0];

  if (!selection) {
    return {
      fileName,
      fileKey,
      pageName,
      parentPath: [pageName],
      flowName,
      scopeMetrics: {
        layerCount: 0,
        frameCount: 0,
        instanceCount: 0,
        uniqueComponentCount: 0,
        textNodeCount: 0,
        variantCount: 0,
        hasFormsModalsTables: false,
      },
    };
  }

  const parentPath: string[] = [];
  let node: BaseNode | null = selection.parent;

  while (node && node.type !== "DOCUMENT" && parentPath.length < MAX_PARENT_DEPTH) {
    if ("name" in node && node.name) {
      parentPath.unshift(node.name);
    }
    node = node.parent;
  }

  parentPath.unshift(pageName);

  const nearestSection = findNearestNamedAncestor(selection, ["SECTION"]);
  const nearestFrame = findNearestNamedAncestor(selection, [
    "FRAME",
    "COMPONENT",
    "COMPONENT_SET",
  ]);

  const baseContext: FigmaContextForJira = {
    fileName,
    fileKey,
    pageName,
    selectedNodeId: selection.id,
    selectedNodeName: selection.name,
    selectedNodeType: toContextNodeType(selection.type),
    parentPath,
    nearestSectionName: nearestSection?.name,
    nearestFrameName: nearestFrame?.name,
    flowName,
  };

  const scopeRoot = resolveScopeRoot(baseContext);
  return {
    ...baseContext,
    scopeMetrics: scopeRoot ? await analyzeFigmaScopeMetrics(scopeRoot) : undefined,
  };
}

/** @deprecated use getCurrentFigmaContext */
export async function readFigmaContextForJira(flowName?: string): Promise<FigmaContextForJira> {
  return getCurrentFigmaContext(flowName);
}
