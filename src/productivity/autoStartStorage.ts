import type { AutoStartSettings } from "../types";
import { DEFAULT_AUTOSTART_SETTINGS, STORAGE_KEYS } from "../types";

async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await figma.clientStorage.getAsync(key);
  return (raw as T) ?? fallback;
}

async function setJson(key: string, value: unknown): Promise<void> {
  await figma.clientStorage.setAsync(key, value);
}

export async function loadAutoStartSettings(): Promise<AutoStartSettings> {
  const stored = await getJson<AutoStartSettings | null>(STORAGE_KEYS.autoStart, null);
  if (stored) {
    return { ...DEFAULT_AUTOSTART_SETTINGS, ...stored };
  }

  const legacy = await getJson<{ autoStart?: AutoStartSettings } | null>(STORAGE_KEYS.settingsLegacy, null);
  if (legacy?.autoStart) {
    const merged = { ...DEFAULT_AUTOSTART_SETTINGS, ...legacy.autoStart };
    await saveAutoStartSettings(merged);
    return merged;
  }

  return { ...DEFAULT_AUTOSTART_SETTINGS };
}

export async function saveAutoStartSettings(settings: AutoStartSettings): Promise<void> {
  await setJson(STORAGE_KEYS.autoStart, {
    ...settings,
    updatedAt: new Date().toISOString(),
  });
}
