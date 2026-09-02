import type { PluginState, WorkSession } from "../../types";
import { SessionStopwatch } from "./SessionStopwatch";
import { sessionStatusLabel, formatScanScopeLabel } from "../utils/sessionTimer";

export function SessionContextStrip({
  state,
  session,
}: {
  state: PluginState;
  session: WorkSession | null | undefined;
}) {
  const status = session ? sessionStatusLabel(session) : null;
  const ticket = session?.jiraTicketId ?? session?.jiraIssueKey;
  const flow = session?.flowName;
  const scan = session ? formatScanScopeLabel(session.scanScope) : null;

  return (
    <div className="context-strip">
      <div className="context-strip__primary">
        {session ? (
          <>
            <span className={`context-strip__pill context-strip__pill--${status?.tone ?? "live"}`}>
              {status?.label ?? "Live"}
            </span>
            <SessionStopwatch session={session} variant="mini" />
          </>
        ) : (
          <span className="context-strip__idle">No active session</span>
        )}
      </div>
      <div className="context-strip__meta">
        <span className="context-strip__file">{state.fileName}</span>
        {ticket ? <span className="context-strip__chip">{ticket}</span> : null}
        {flow ? <span className="context-strip__chip">{flow}</span> : null}
        {scan && scan !== "—" ? <span className="context-strip__chip context-strip__chip--muted">{scan}</span> : null}
      </div>
    </div>
  );
}
