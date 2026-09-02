export const PLUGIN_UI_SIZE = {
  defaultWidth: 1200,
  defaultHeight: 820,
  minWidth: 520,
  maxWidth: 1600,
  minHeight: 480,
  maxHeight: 1200,
  minimizedWidth: 320,
  minimizedHeight: 52,
} as const;

export type PluginUiSize = { width: number; height: number };

export function clampPluginUiSize(width: number, height: number): PluginUiSize {
  return {
    width: Math.round(
      Math.min(PLUGIN_UI_SIZE.maxWidth, Math.max(PLUGIN_UI_SIZE.minWidth, width))
    ),
    height: Math.round(
      Math.min(PLUGIN_UI_SIZE.maxHeight, Math.max(PLUGIN_UI_SIZE.minHeight, height))
    ),
  };
}

export const UI_SIZE_STORAGE_KEY = "lumi.ui.size.v1";
export const UI_MINIMIZED_STORAGE_KEY = "lumi.ui.minimized.v1";
