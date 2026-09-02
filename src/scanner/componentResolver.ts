/** Resolve instance main components without sync APIs (required for documentAccess: dynamic-page). */
export async function getInstanceMainComponent(
  node: InstanceNode
): Promise<ComponentNode | null> {
  try {
    return await node.getMainComponentAsync();
  } catch {
    return null;
  }
}
