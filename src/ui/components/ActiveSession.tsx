import { useEffect, useState } from "react";
import type { PluginState, SessionAdjustmentReason, TabId } from "../../types";
import { SessionRestore } from "./SessionRestore";
import { postMessage, formatTime, KpiCard } from "../hooks";
import { sessionStatusLabel, computeLiveMinutes } from "../utils/sessionTimer";
import { takeFinishSessionIntent } from "../utils/sessionUiIntent";
import { SessionStopwatch, useSessionLiveMinutes } from "./SessionStopwatch";
import { SessionFinishModal } from "./SessionFinishModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { minimizePlugin } from "./MinimizedBar";

export function ActiveSession({ state, setTab }: { state: PluginState; setTab: (t: TabId) => void }) {
  const restoreSession = state.pendingRestoreSession ?? state.pendingClosedSessionPrompt;
  const session = state.activeSession ?? restoreSession;
  const liveMinutes = useSessionLiveMinutes(session);
  const [showFinish, setShowFinish] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const [actualMinutes, setActualMinutes] = useState(0);
  const [adjustReason, setAdjustReason] = useState<SessionAdjustmentReason>("none");
  const [runScan, setRunScan] = useState(true);
  const [restoreDismissed, setRestoreDismissed] = useState(false);

  useEffect(() => {
    const active = state.activeSession;
    if (!active || !takeFinishSessionIntent()) return;
    setActualMinutes(computeLiveMinutes(active));
    setShowFinish(true);
  }, [state.activeSession?.id]);

  if (!session) {
    const autoStartOn = state.settings.autoStart?.enabled !== false;
    return (
      <div className="session-empty-state">
        <div className="session-empty-card">
          <div className="session-empty-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16 9v7l4 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="session-empty-title">No active session</h3>
          <p className="session-empty-body">
            {autoStartOn
              ? "A session starts when you open LUMI, or start one manually below."
              : "Start a session to track time and run a LUMI scan when you finish."}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setTab("start-session")}>
            Start session
          </button>
        </div>
      </div>
    );
  }

  if (restoreSession && !restoreDismissed) {
    return (
      <SessionRestore
        session={restoreSession}
        onDismiss={() => {
          setRestoreDismissed(true);
          postMessage({ type: "DISMISS_RESTORE" });
        }}
      />
    );
  }

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

  const runHideOrMinimize = () => {
    const keepWhenHidden = state.settings.autoStart?.keepSessionWhenHidden !== false;
    if (keepWhenHidden) {
      setShowHideConfirm(true);
    } else {
      minimizePlugin();
    }
  };

  const confirmFullHide = () => {
    setShowHideConfirm(false);
    postMessage({ type: "RUN_IN_BACKGROUND", sessionId: session.id });
  };

  const isLong = liveMinutes > 480;
  const isDraft = session.autoStarted && session.status === "draft";
  const canHideCompletely = state.settings.autoStart?.keepSessionWhenHidden !== false;
  const status = sessionStatusLabel(session);

  return (
    <>
      <div className="card session-live">
        <div className="session-live-top">
          <div className="session-live-top-main">
            <span className={`session-status-pill session-status-pill--${status.tone}`}>
              {status.label}
            </span>
            {isDraft && (
              <div className="session-draft-cta session-draft-cta--inline">
                <p className="session-hero-note">
                  <strong>Draft session</strong> — add project, ticket, and flow on Work Sessions
                  before you finish for full reporting.
                </p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab("start-session")}>
                  Add ticket & flow
                </button>
              </div>
            )}
            {!isDraft && session.autoStarted && session.status === "active" && (
              <p className="session-hero-note">Session running — finish when done.</p>
            )}
          </div>
        </div>

        {isLong && (
          <div className="session-alert">Long session — confirm actual minutes when you finish.</div>
        )}

        <div className="session-live-body">
          <SessionStopwatch session={session} variant="block" />

          <div className="session-meta-grid">
            <KpiCard label="Designer" value={session.designerName} />
            <KpiCard label="Project" value={session.projectName ?? "—"} />
            <KpiCard label="Flow" value={session.flowName ?? "—"} />
            <KpiCard label="Ticket" value={session.jiraTicketId ?? "—"} />
            <KpiCard label="Work type" value={session.workType ?? "—"} />
            <KpiCard label="Complexity" value={session.complexity ?? "—"} />
            <KpiCard label="Started" value={formatTime(session.startedAt)} />
            <KpiCard
              label="Reporting"
              value={session.eligibleForReporting ? "Eligible" : "Needs metadata"}
            />
          </div>
        </div>

        <div className="session-live-actions">
          <div className="session-actions-row session-actions-row--primary">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => postMessage({ type: "PAUSE_SESSION", sessionId: session.id })}
              disabled={session.status === "paused"}
            >
              Pause
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => postMessage({ type: "RESUME_SESSION", sessionId: session.id })}
              disabled={session.status !== "paused"}
            >
              Resume
            </button>
            <button type="button" className="btn btn-primary" onClick={openFinish}>
              Finish session
            </button>
          </div>
          <div className="session-actions-row">
            <button type="button" className="btn btn-secondary" onClick={() => minimizePlugin()}>
              Minimize panel
            </button>
            {canHideCompletely && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={runHideOrMinimize}>
                Hide completely…
              </button>
            )}
            <button type="button" className="btn btn-danger" onClick={() => setShowDiscard(true)}>
              Discard
            </button>
          </div>
          <p className="session-footnote">
            <strong>Minimize</strong> shrinks this panel — timer keeps running.{" "}
            <strong>Hide completely</strong> uses Figma&apos;s bottom bar to reopen;{" "}
            <strong>Cancel</strong> on that bar stops LUMI.
          </p>
        </div>
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

      {showHideConfirm && (
        <ConfirmDialog
          title="Hide LUMI completely?"
          body="Your timer keeps running. Reopen via “Running LUMI Analytics” at the bottom of Figma. Do not click Cancel on that bar — it stops the plugin and session."
          confirmLabel="Hide & keep timer"
          onConfirm={confirmFullHide}
          onCancel={() => setShowHideConfirm(false)}
        />
      )}
    </>
  );
}
