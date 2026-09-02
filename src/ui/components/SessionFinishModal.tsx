import type { SessionAdjustmentReason, WorkSession } from "../../types";
import { formatMinutes, formatTime } from "../hooks";

type Props = {
  session: WorkSession;
  liveMinutes: number;
  actualMinutes: number;
  adjustReason: SessionAdjustmentReason;
  runScan: boolean;
  onActualMinutesChange: (n: number) => void;
  onAdjustReasonChange: (r: SessionAdjustmentReason) => void;
  onRunScanChange: (v: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SessionFinishModal({
  session,
  liveMinutes,
  actualMinutes,
  adjustReason,
  runScan,
  onActualMinutesChange,
  onAdjustReasonChange,
  onRunScanChange,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="section-title">Confirm actual work time</h3>
        <p className="section-subtitle">
          Start: {formatTime(session.startedAt)} · End: now · Raw elapsed: {formatMinutes(liveMinutes)}
        </p>
        <div className="form-group">
          <label>Actual minutes</label>
          <input
            type="number"
            value={actualMinutes}
            onChange={(e) => onActualMinutesChange(Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>Adjustment reason</label>
          <select
            value={adjustReason}
            onChange={(e) => onAdjustReasonChange(e.target.value as SessionAdjustmentReason)}
          >
            <option value="none">No adjustment</option>
            <option value="breaks">Breaks</option>
            <option value="meeting-interruption">Meeting interruption</option>
            <option value="plugin-closed">Plugin was closed</option>
            <option value="partial-work-session">Partial work session</option>
            <option value="other">Other</option>
          </select>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={runScan} onChange={(e) => onRunScanChange(e.target.checked)} />
          Run LUMI scan now
        </label>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Confirm & finish
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
