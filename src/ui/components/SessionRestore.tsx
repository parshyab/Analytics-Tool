import { useState } from "react";
import type { WorkSession } from "../../types";
import { postMessage, formatTime } from "../hooks";

const RESTORE_WARN_MINUTES = 30;

function minutesSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

export function SessionRestore({
  session,
  onDismiss,
}: {
  session: WorkSession;
  onDismiss?: () => void;
}) {
  const [manualMinutes, setManualMinutes] = useState<number | "">("");
  const [showEdit, setShowEdit] = useState(false);
  const gapMinutes = minutesSince(session.lastSeenAt);
  const showWarning = gapMinutes >= RESTORE_WARN_MINUTES;

  const restore = (action: "continue" | "pause" | "edit" | "finish" | "discard") => {
    if (action === "edit") {
      postMessage({
        type: "RESTORE_SESSION",
        sessionId: session.id,
        action: "edit",
        manualMinutes: typeof manualMinutes === "number" ? manualMinutes : undefined,
      });
    } else {
      postMessage({ type: "RESTORE_SESSION", sessionId: session.id, action });
    }
    onDismiss?.();
  };

  return (
    <div className="card restore-card">
      <h3>Restore your LUMI session</h3>
      <p>
        You had an active LUMI session from <strong>{formatTime(session.startedAt)}</strong>.
      </p>
      <p style={{ fontSize: 11, color: "var(--muted)" }}>
        Last saved: {formatTime(session.lastSeenAt)} ({gapMinutes} min ago)
      </p>

      {showWarning && (
        <p className="banner-error" style={{ marginTop: 12, borderRadius: 8 }}>
          This session may include time when you were not actively designing.
        </p>
      )}

      <p style={{ marginTop: 12, marginBottom: 12 }}>How should LUMI handle this session?</p>

      <button type="button" className="btn btn-primary" onClick={() => restore("continue")}>
        Continue session
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => restore("pause")}>
        Pause time since last seen
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(!showEdit)}>
        Edit actual minutes
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => restore("finish")}>
        Finish session
      </button>
      <button type="button" className="btn btn-danger" onClick={() => restore("discard")}>
        Discard session
      </button>

      {showEdit && (
        <div className="form-group" style={{ marginTop: 12 }}>
          <label>Actual minutes so far</label>
          <input
            type="number"
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value ? Number(e.target.value) : "")}
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => restore("edit")}
          >
            Save minutes
          </button>
        </div>
      )}
    </div>
  );
}
