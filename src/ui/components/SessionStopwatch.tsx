import { useEffect, useState } from "react";
import type { WorkSession } from "../../types";
import {
  computeCurrentPauseSeconds,
  computeLiveElapsedSeconds,
  computePausedDurationSeconds,
  formatPausedDuration,
  formatStopwatch,
  sessionStatusLabel,
} from "../utils/sessionTimer";

type Variant = "gate" | "block" | "mini";

type Props = {
  session: WorkSession;
  variant?: Variant;
  showPausedBreakdown?: boolean;
};

export function SessionStopwatch({
  session,
  variant = "block",
  showPausedBreakdown = true,
}: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => computeLiveElapsedSeconds(session));
  const [pausedSeconds, setPausedSeconds] = useState(() => computePausedDurationSeconds(session));
  const [currentPauseSeconds, setCurrentPauseSeconds] = useState(() =>
    computeCurrentPauseSeconds(session)
  );
  const status = sessionStatusLabel(session);

  useEffect(() => {
    const tick = () => {
      setElapsedSeconds(computeLiveElapsedSeconds(session));
      setPausedSeconds(computePausedDurationSeconds(session));
      setCurrentPauseSeconds(computeCurrentPauseSeconds(session));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session]);

  if (variant === "mini") {
    return (
      <span className="session-stopwatch-mini" aria-live="polite">
        {formatStopwatch(elapsedSeconds)}
      </span>
    );
  }

  if (variant === "gate") {
    return (
      <div
        className={`session-gate__timer ${status.tone === "live" ? "session-gate__timer--live" : ""}`}
        aria-live="polite"
      >
        <span className="session-gate__timer-value">{formatStopwatch(elapsedSeconds)}</span>
        <span className="session-gate__timer-label">
          {status.tone === "paused" ? "Work elapsed (paused)" : "Elapsed time"}
        </span>
        {showPausedBreakdown && status.tone === "paused" && currentPauseSeconds > 0 && (
          <span className="session-gate__timer-paused">
            Paused for {formatPausedDuration(currentPauseSeconds)}
          </span>
        )}
        {showPausedBreakdown && pausedSeconds > 0 && status.tone !== "paused" && (
          <span className="session-gate__timer-paused">
            Paused total {formatPausedDuration(pausedSeconds)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="session-timer-block">
      <div className="session-timer session-timer--stopwatch">{formatStopwatch(elapsedSeconds)}</div>
      <p className="session-timer-caption">
        {status.tone === "paused" ? "Work elapsed (paused)" : "Elapsed"}
      </p>
      {showPausedBreakdown && status.tone === "paused" && currentPauseSeconds > 0 && (
        <p className="session-timer-caption session-timer-caption--muted">
          Paused for {formatPausedDuration(currentPauseSeconds)}
        </p>
      )}
      {showPausedBreakdown && pausedSeconds > 0 && (
        <p className="session-timer-caption session-timer-caption--muted">
          Total paused {formatPausedDuration(pausedSeconds)}
        </p>
      )}
    </div>
  );
}

export function useSessionLiveMinutes(session: WorkSession | null | undefined): number {
  const [minutes, setMinutes] = useState(0);
  useEffect(() => {
    if (!session) {
      setMinutes(0);
      return;
    }
    const tick = () => setMinutes(Math.round(computeLiveElapsedSeconds(session) / 60));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);
  return minutes;
}
