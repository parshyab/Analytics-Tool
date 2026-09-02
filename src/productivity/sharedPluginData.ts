import { PLUGIN_NAMESPACE } from "../types";

/**
 * Safe read/write for figma.root shared plugin data.
 * Namespace must be alphanumeric, `_`, or `.` only.
 */
export function getSharedPluginDataSafe(key: string): string {
  try {
    return figma.root.getSharedPluginData(PLUGIN_NAMESPACE, key);
  } catch {
    return "";
  }
}

export function setSharedPluginDataSafe(key: string, value: string): void {
  try {
    figma.root.setSharedPluginData(PLUGIN_NAMESPACE, key, value);
  } catch {
    // Figma 100 kB limit or invalid args — skip without crashing plugin
  }
}

export function clearSharedPluginDataSafe(keys: string[]): void {
  for (const key of keys) {
    setSharedPluginDataSafe(key, "");
  }
}
