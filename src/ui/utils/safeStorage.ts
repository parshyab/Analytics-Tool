/** Figma plugin UI iframes may block sessionStorage (e.g. data: URLs). */
const memory = new Map<string, string>();

export function safeGetItem(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export function safeSetItem(key: string, value: string): void {
  memory.set(key, value);
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* in-memory fallback only */
  }
}
