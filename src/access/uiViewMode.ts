const UI_VIEW_MODE_STORAGE_KEY = "lumi.uiViewMode.v1";

export async function loadUiViewMode(): Promise<"admin" | "designer"> {
  const stored = await figma.clientStorage.getAsync(UI_VIEW_MODE_STORAGE_KEY);
  return stored === "designer" ? "designer" : "admin";
}

export async function saveUiViewMode(mode: "admin" | "designer"): Promise<void> {
  await figma.clientStorage.setAsync(UI_VIEW_MODE_STORAGE_KEY, mode);
}
