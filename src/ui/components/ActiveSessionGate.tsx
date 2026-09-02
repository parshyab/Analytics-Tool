import { useState } from "react";
import type {
  SessionAdjustmentReason,
  WorkSession,
} from "../../types";
import { formatTime, postMessage } from "../hooks";
import { sessionStatusLabel, formatScanScopeLabel } from "../utils/sessionTimer";
import { SessionStopwatch, useSessionLiveMinutes } from "./SessionStopwatch";
import { SessionFinishModal } from "./SessionFinishModal";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = {
  session: WorkSession;
  recentSessions?: WorkSession[];
  onOpenSession: () => void;
};

export function ActiveSessionGate({ session, recentSessions = [], onOpenSession }: Props) {
  const status = sessionStatusLabel(session);
  const liveMinutes = useSessionLiveMinutes(session);
  const isLong = liveMinutes > 480;
  const isDraft = session.autoStarted && session.status === "draft";

  const [showFinish, setShowFinish] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [actualMinutes, setActualMinutes] = useState(0);
  const [adjustReason, setAdjustReason] = useState<SessionAdjustmentReason>("none");
  const [runScan, setRunScan] = useState(true);
  const [projectName, setProjectName] = useState(session.projectName ?? "");
  const [flowName, setFlowName] = useState(session.flowName ?? "");
  const [ticketId, setTicketId] = useState(session.jiraTicketId ?? "");

  const meta = [
    { label: "Project", value: session.projectName ?? "—" },
    {
      label: "Ticket",
      value: session.jiraTicketId
        ? session.ticketTitle ?? session.jiraSummary
          ? `${session.jiraTicketId} · ${session.ticketTitle ?? session.jiraSummary}`
          : session.jiraTicketId
        : "—",
    },
    { label: "Flow", value: session.flowName ?? "—" },
    { label: "Work type", value: session.workType ?? "—" },
    { label: "Scan scope", value: formatScanScopeLabel(session.scanScope) },
    { label: "Started", value: formatTime(session.startedAt) },
  ];

  const finishedRecent = recentSessions
    .filter((s) => s.status === "finished" && s.id !== session.id)
    .slice(0, 3);

  const openFinish = () => {
    setActualMinutes(liveMinutes);
    setShowFinish(true);
  };

  const confirmFinish = () => {
    postMessage({
      type: "FINISH_SESSION",
      sessionId: session.id,
      runScan,
      adjustment: {
        rawElapsedMinutes: liveMinutes,
        pausedMinutes: 0,
        suggestedActualMinutes: liveMinutes,
        adjustedActualMinutes: actualMinutes,
        adjustmentReason: adjustReason,
      },
    });
    setShowFinish(false);
  };

  const saveQuickEdit = () => {
    postMessage({
      type: "UPDATE_SESSION",
      session: {
        ...session,
        projectName: projectName.trim() || undefined,
        flowName: flowName.trim() || undefined,
        jiraTicketId: ticketId.trim() || undefined,
        jiraIssueKey: ticketId.trim() || undefined,
        updatedAt: new Date().toISOString(),
      },
    });
    setShowEdit(false);
  };

  return (
    <>
      <div className="session-gate card">
        {isDraft && (
          <div className="session-draft-cta">
            <strong>Draft session — add ticket & flow</strong>
            <p>Required for benchmark matching and reporting when you finish.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEdit(true)}>
              Add details now
            </button>
          </div>
        )}

        <div className="session-gate__head">
          <div>
            <span className={`session-status-pill session-status-pill--${status.tone}`}>
              {status.label}
            </span>
            <p className="session-gate__lead">
              Finish or discard this session before starting another. Your timer keeps running while
              you work in Figma.
            </p>
          </div>
        </div>

        {isLong && (
          <div className="session-alert">Long session — confirm actual minutes when you finish.</div>
        )}

        <div className="session-gate__body">
          <SessionStopwatch session={session} variant="gate" />

          <dl className="session-gate__meta">
            {meta.map((row) => (
              <div key={row.label} className="session-gate__meta-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {showEdit && (
          <div className="session-gate__quick-edit">
            <h4 className="session-gate__quick-edit-title">Edit session details</h4>
            <div className="form-group">
              <label>Project</label>
              <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Flow</label>
              <input value={flowName} onChange={(e) => setFlowName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Jira ticket</label>
              <input value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="UX-123" />
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={saveQuickEdit}>
                Save details
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEdit(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="session-gate__actions">
          <button type="button" className="btn btn-primary" onClick={onOpenSession}>
            Continue session
          </button>
          <button type="button" className="btn btn-secondary" onClick={openFinish}>
            Finish session
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEdit((v) => !v)}>
            {showEdit ? "Hide details" : "Edit details"}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setShowDiscard(true)}>
            Discard
          </button>
        </div>
      </div>

      <div className="session-gate-footer card card-flush">
        <h4 className="session-gate-footer__title">When you finish</h4>
        <ul className="session-gate-footer__list">
          <li>Confirm how long you actually worked</li>
          <li>Optionally run a LUMI scan on your selected scope</li>
          <li>Productivity and adoption metrics are saved locally</li>
        </ul>
        {finishedRecent.length > 0 && (
          <div className="session-gate-footer__recent">
            <span className="session-gate-footer__recent-label">Recent sessions</span>
            {finishedRecent.map((s) => (
              <div key={s.id} className="session-gate-footer__recent-row">
                <span>{s.startedAt.slice(0, 10)}</span>
                <span>{s.flowName ?? "—"}</span>
                <span>{s.jiraTicketId ?? "No ticket"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showFinish && (
        <SessionFinishModal
          session={session}
          liveMinutes={liveMinutes}
          actualMinutes={actualMinutes}
          adjustReason={adjustReason}
          runScan={runScan}
          onActualMinutesChange={setActualMinutes}
          onAdjustReasonChange={setAdjustReason}
          onRunScanChange={setRunScan}
          onConfirm={confirmFinish}
          onCancel={() => setShowFinish(false)}
        />
      )}

      {showDiscard && (
        <ConfirmDialog
          title="Discard session?"
          body="This removes the active session and elapsed time will not be saved."
          confirmLabel="Discard session"
          danger
          onConfirm={() => {
            postMessage({ type: "DISCARD_SESSION", sessionId: session.id });
            setShowDiscard(false);
          }}
          onCancel={() => setShowDiscard(false)}
        />
      )}
    </>
  );
}
