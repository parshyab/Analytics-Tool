import { normalizeScanScope, type LegacyScanScope, type ScanScope } from "../types";
import { safeWalkSceneNodes } from "./safeNodeTraversal";

export type TraversalContext = {
  pageName: string;
  sectionName?: string;
  frameName?: string;
  parentPath: string;
};

export type TraversedNode = {
  node: SceneNode;
  context: TraversalContext;
};

/** Collect ancestor section and frame names for location tracking. */
export function getNodeLocation(node: SceneNode): TraversalContext {
  let sectionName: string | undefined;
  let frameName: string | undefined;
  const pathParts: string[] = [];
  let current: BaseNode | null = node;

  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    pathParts.unshift(current.name);
    if (current.type === "SECTION" && !sectionName) {
      sectionName = current.name;
    }
    if (
      (current.type === "FRAME" ||
        current.type === "COMPONENT" ||
        current.type === "COMPONENT_SET") &&
      !frameName
    ) {
      frameName = current.name;
    }
    current = current.parent;
  }

  const page = getPageForNode(node);
  return {
    pageName: page?.name ?? "Unknown",
    sectionName,
    frameName,
    parentPath: pathParts.join(" / "),
  };
}

export function getPageForNode(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === "PAGE") return current as PageNode;
    current = current.parent;
  }
  return null;
}

/** Walk subtree including frames inside SECTION containers. */
export function traverseSubtree(root: BaseNode): TraversedNode[] {
  const results: TraversedNode[] = [];

  safeWalkSceneNodes(root, (node) => {
    const page = getPageForNode(node);
    const inherited = getNodeLocation(node);
    const context: TraversalContext = {
      pageName: page?.name ?? inherited.pageName ?? "Unknown",
      sectionName: node.type === "SECTION" ? node.name : inherited.sectionName,
      frameName:
        node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET"
          ? node.name
          : inherited.frameName,
      parentPath: buildPath(node),
    };
    results.push({ node, context });
  });

  return results;
}

function buildPath(node: SceneNode): string {
  const parts: string[] = [];
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    parts.unshift(current.name);
    current = current.parent;
  }
  return parts.join(" / ");
}

/** Resolve scan root from scope and current selection. */
export async function resolveScanRoot(
  scopeInput: ScanScope | LegacyScanScope
): Promise<{ root: BaseNode; warnings: string[] }> {
  const scope = normalizeScanScope(scopeInput);
  const warnings: string[] = [];
  const selection = figma.currentPage.selection;

  switch (scope) {
    case "selected-frame": {
      const selected = selection[0];
      if (
        selected &&
        (selected.type === "FRAME" ||
          selected.type === "COMPONENT" ||
          selected.type === "COMPONENT_SET")
      ) {
        return { root: selected, warnings };
      }
      const frame = selection.find(
        (n) =>
          n.type === "FRAME" ||
          n.type === "COMPONENT" ||
          n.type === "COMPONENT_SET"
      );
      if (!frame) {
        let node: BaseNode | null = selected ?? null;
        while (node && node.type !== "PAGE" && node.type !== "DOCUMENT") {
          if (
            node.type === "FRAME" ||
            node.type === "COMPONENT" ||
            node.type === "COMPONENT_SET"
          ) {
            return { root: node, warnings };
          }
          node = node.parent;
        }
        throw new Error("Select a frame, component, or component set.");
      }
      return { root: frame, warnings };
    }
    case "selected-section": {
      const selected = selection[0];
      if (selected?.type === "SECTION") {
        return { root: selected, warnings };
      }
      const section = selection.find((n) => n.type === "SECTION");
      if (!section) {
        let node: BaseNode | null = selected ?? null;
        while (node && node.type !== "PAGE" && node.type !== "DOCUMENT") {
          if (node.type === "SECTION") {
            return { root: node, warnings };
          }
          node = node.parent;
        }
        throw new Error("Select a section to scan.");
      }
      return { root: section, warnings };
    }
    case "current-page":
      return { root: figma.currentPage, warnings };
    case "whole-file": {
      await figma.loadAllPagesAsync();
      return { root: figma.root, warnings };
    }
    default:
      return { root: figma.currentPage, warnings };
  }
}
