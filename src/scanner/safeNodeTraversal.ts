/** Scene node types we can safely traverse without triggering Figma findAll bugs. */
const TRAVERSABLE_TYPES = new Set([
  "FRAME",
  "GROUP",
  "COMPONENT",
  "COMPONENT_SET",
  "INSTANCE",
  "SECTION",
  "BOOLEAN_OPERATION",
  "VECTOR",
  "STAR",
  "LINE",
  "ELLIPSE",
  "POLYGON",
  "RECTANGLE",
  "TEXT",
  "SLICE",
  "STICKY",
  "CONNECTOR",
  "SHAPE_WITH_TEXT",
  "CODE_BLOCK",
  "WIDGET",
  "EMBED",
  "LINK_UNFURL",
  "MEDIA",
  "TABLE",
  "TABLE_CELL",
]);

function isTraversableNode(node: BaseNode): node is SceneNode {
  return "type" in node && TRAVERSABLE_TYPES.has(node.type);
}

function readChildren(node: BaseNode): readonly SceneNode[] {
  if (!("children" in node) || !Array.isArray(node.children)) return [];
  return node.children as readonly SceneNode[];
}

/**
 * Walk a subtree without using Figma's native findAll (which can throw on newer node types).
 * Skips children that throw when accessed.
 */
export function safeWalkSceneNodes(
  root: BaseNode,
  visitor: (node: SceneNode) => void | boolean,
  options?: { maxNodes?: number }
): { visited: number; truncated: boolean } {
  const maxNodes = options?.maxNodes ?? 8000;
  let visited = 0;
  let truncated = false;

  const walk = (node: BaseNode) => {
    if (visited >= maxNodes) {
      truncated = true;
      return;
    }

    if (!isTraversableNode(node)) return;

    visited += 1;
    const stop = visitor(node);
    if (stop === true) return;

    let children: readonly SceneNode[];
    try {
      children = readChildren(node);
    } catch {
      return;
    }

    for (const child of children) {
      if (visited >= maxNodes) {
        truncated = true;
        return;
      }
      try {
        walk(child);
      } catch {
        // Skip nodes Figma cannot expose (unknown / stale types).
      }
    }
  };

  if (root.type === "PAGE" || root.type === "DOCUMENT") {
    let children: readonly SceneNode[];
    try {
      children = readChildren(root);
    } catch {
      return { visited: 0, truncated: false };
    }
    for (const child of children) {
      if (visited >= maxNodes) {
        truncated = true;
        break;
      }
      try {
        walk(child);
      } catch {
        // skip
      }
    }
  } else {
    try {
      walk(root);
    } catch {
      // skip
    }
  }

  return { visited, truncated };
}

/** Collect instance nodes without native findAll. */
export function safeFindInstances(root: BaseNode, maxNodes = 12000): InstanceNode[] {
  const instances: InstanceNode[] = [];
  safeWalkSceneNodes(
    root,
    (node) => {
      if (node.type === "INSTANCE") instances.push(node);
    },
    { maxNodes }
  );
  return instances;
}

/**
 * Prefer findAllWithCriteria when available; fall back to safe manual walk.
 * Never throws — returns partial results on Figma internal errors.
 */
export function safeFindInstancesFast(root: BaseNode): InstanceNode[] {
  if (!("findAllWithCriteria" in root) || typeof root.findAllWithCriteria !== "function") {
    return safeFindInstances(root);
  }

  try {
    return (root as ChildrenMixin).findAllWithCriteria({ types: ["INSTANCE"] });
  } catch {
    return safeFindInstances(root);
  }
}
