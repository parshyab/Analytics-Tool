import type { WorkSession } from "../../types";
import { postMessage } from "../hooks";
import { SessionStopwatch } from "./SessionStopwatch";

type Props = {
  pluginName: string;
  session?: WorkSession | null;
  onExpand: () => void;
};

export function MinimizedBar({ pluginName, session, onExpand }: Props) {
  const handleExpand = () => {
    expandPlugin();
    onExpand();
  };

  return (
    <div className="plugin-mini-bar-wrap">
      <div className="plugin-mini-bar">
        <div className="plugin-mini-bar__brand">
          <span className="plugin-mini-bar__title">{pluginName}</span>
          {session && (
            <span className="plugin-mini-bar__session">
              <SessionStopwatch session={session} variant="mini" />
              <span className="plugin-mini-bar__session-label">
                {session.status === "paused" ? "paused" : session.status === "draft" ? "draft" : "live"}
              </span>
            </span>
          )}
        </div>
        <div className="plugin-mini-bar__actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={handleExpand}>
            Expand
          </button>
        </div>
      </div>
      <p className="plugin-mini-bar__hint">
        Timer keeps running while minimized. Use Expand to finish or pause.
      </p>
    </div>
  );
}

export function minimizePlugin(): void {
  postMessage({ type: "MINIMIZE_PLUGIN" });
}

export function expandPlugin(): void {
  postMessage({ type: "EXPAND_PLUGIN" });
}
