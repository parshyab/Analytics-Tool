import type { BootData, PluginState } from "../types";
import { DEFAULT_SETTINGS } from "../types";

export const DEFAULT_BOOT_DATA: BootData = {
  pluginName: "LUMI Analytics",
  fileName: "Current Figma file",
  fileKey: null,
  currentPageName: "Current page",
  user: null,
};

export function createDefaultPluginState(boot: BootData = DEFAULT_BOOT_DATA): PluginState {
  return {
    consent: null,
    profile: null,
    settings: DEFAULT_SETTINGS,
    activeSession: null,
    sessions: [],
    scans: [],
    productivityResults: [],
    benchmarks: [],
    currentUser: boot.user,
    fileName: boot.fileName,
    pendingRestoreSession: undefined,
    pendingClosedSessionPrompt: undefined,
  };
}
