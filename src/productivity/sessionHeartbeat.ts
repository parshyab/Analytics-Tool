import type { WorkSession } from "../types";
import { STORAGE_KEYS } from "../types";
import { getActiveStatuses } from "./sessionTracker";

/** Show restore UI only after this idle gap (30 minutes). */
export const RESTORE_PROMPT_GAP_MS = 30 * 60 * 1000;

async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await figma.clientStorage.getAsync(key);
  return (raw as T) ?? fallback;
}

async function setJson(key: string, value: unknown): Promise<void> {
  await figma.clientStorage.setAsync(key, value);
}

export async function saveActiveSessionHeartbeat(session: WorkSession): Promise<void> {
  const now = new Date().toISOString();
  const updated: WorkSession = {
    ...session,
    lastSeenAt: now,
    updatedAt: now,
  };
  await setJson(STORAGE_KEYS.activeSession, updated);
  return;
}

export async function getActiveSessionFromStorage(userId: string): Promise<WorkSession | null> {
  const active = await getJson<WorkSession | null>(STORAGE_KEYS.activeSession, null);
  if (active && active.designerUserId === userId) return active;

  const legacy = await getJson<WorkSession | null>(STORAGE_KEYS.activeSessionLegacy, null);
  if (legacy && legacy.designerUserId === userId) {
    await setJson(STORAGE_KEYS.activeSession, legacy);
    return legacy;
  }

  return null;
}

export function sessionIdleGapMs(session: WorkSession): number {
  return Date.now() - new Date(session.lastSeenAt).getTime();
}

/**
 * True when the designer was away long enough that we should ask how to handle the gap.
 * Default threshold: 30 minutes (short reopen → auto-continue).
 */
export function needsRestorePrompt(
  session: WorkSession,
  minGapMs: number = RESTORE_PROMPT_GAP_MS
): boolean {
  if (!getActiveStatuses().includes(session.status)) return false;
  return sessionIdleGapMs(session) > minGapMs;
}

/** Short gap — quietly resume without the restore wall. */
export function shouldAutoContinueSession(
  session: WorkSession,
  maxGapMs: number = RESTORE_PROMPT_GAP_MS
): boolean {
  if (!getActiveStatuses().includes(session.status)) return false;
  return sessionIdleGapMs(session) <= maxGapMs;
}

export function minutesSinceLastSeen(session: WorkSession): number {
  return Math.round(sessionIdleGapMs(session) / 60000);
}

export async function saveHeartbeat(session: WorkSession): Promise<WorkSession> {
  const now = new Date().toISOString();
  const updated = { ...session, lastSeenAt: now, updatedAt: now };
  await setJson(STORAGE_KEYS.activeSession, updated);
  return updated;
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startSessionHeartbeat(
  getSession: () => Promise<WorkSession | null>,
  persist: (session: WorkSession) => Promise<void>
): void {
  stopSessionHeartbeat();
  heartbeatTimer = setInterval(async () => {
    try {
      const session = await getSession();
      if (!session || !getActiveStatuses().includes(session.status)) return;
      const updated = await saveHeartbeat(session);
      await persist(updated);
    } catch {
      // heartbeat must not crash plugin
    }
  }, 30000);
}

export function stopSessionHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
