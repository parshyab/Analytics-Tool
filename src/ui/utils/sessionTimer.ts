import type { ScanScope, WorkSession } from "../../types";
import { SCAN_SCOPE_OPTIONS } from "../../types";

export function computeLiveElapsedSeconds(session: WorkSession): number {
  const start = new Date(session.startedAt).getTime();
  let pausedMs = 0;

  for (const p of session.pauseIntervals) {
    if (p.minutes) {
      pausedMs += p.minutes * 60_000;
    } else if (p.resumedAt && p.pausedAt) {
      pausedMs += new Date(p.resumedAt).getTime() - new Date(p.pausedAt).getTime();
    }
  }

  if (session.status === "paused" && session.pausedAt) {
    pausedMs += Date.now() - new Date(session.pausedAt).getTime();
  }

  return Math.max(0, Math.floor((Date.now() - start - pausedMs) / 1000));
}

export function computeLiveMinutes(session: WorkSession): number {
  return Math.round(computeLiveElapsedSeconds(session) / 60);
}

export function formatStopwatch(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${m}:${ss}`;
}

export function sessionStatusLabel(
  session: WorkSession
): { label: string; tone: "live" | "paused" | "draft" } {
  if (session.status === "paused") return { label: "Paused", tone: "paused" };
  if (session.autoStarted && session.status === "draft") return { label: "Draft", tone: "draft" };
  return { label: "Live", tone: "live" };
}

/** Total paused time in seconds (completed intervals + current pause if paused). */
export function computePausedDurationSeconds(session: WorkSession): number {
  let pausedMs = 0;
  for (const p of session.pauseIntervals) {
    if (p.minutes) {
      pausedMs += p.minutes * 60_000;
    } else if (p.resumedAt && p.pausedAt) {
      pausedMs += new Date(p.resumedAt).getTime() - new Date(p.pausedAt).getTime();
    }
  }
  if (session.status === "paused" && session.pausedAt) {
    pausedMs += Date.now() - new Date(session.pausedAt).getTime();
  }
  return Math.max(0, Math.floor(pausedMs / 1000));
}

/** Duration of the current pause only (when status is paused). */
export function computeCurrentPauseSeconds(session: WorkSession): number {
  if (session.status !== "paused" || !session.pausedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(session.pausedAt).getTime()) / 1000));
}

export function formatPausedDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export function formatScanScopeLabel(scope?: ScanScope): string {
  if (!scope) return "—";
  const opt = SCAN_SCOPE_OPTIONS.find((o) => o.value === scope);
  return opt?.label ?? scope;
}
