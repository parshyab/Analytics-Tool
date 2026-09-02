import { useState } from "react";
import type { PluginState } from "../../types";
import { buildLumiConsent, buildProfile } from "../../types";
import {
  isNykaaDesignTeam,
  NYKAA_DESIGN_TEAMS,
  type NykaaDesignTeam,
} from "../../productivity/nykaaTeams";
import { postMessage } from "../hooks";

function initialTeam(state: PluginState): NykaaDesignTeam | "" {
  const raw = state.settings.teamName ?? state.consent?.teamName ?? state.profile?.teamName;
  return isNykaaDesignTeam(raw) ? raw : "";
}

export function WelcomeConsent({ state, onDone }: { state: PluginState; onDone: () => void }) {
  const [manualName, setManualName] = useState(state.settings.manualName ?? state.consent?.name ?? "");
  const [teamName, setTeamName] = useState<NykaaDesignTeam | "">(initialTeam(state));

  const userId = state.currentUser?.id ?? state.consent?.userId ?? `local-${Date.now()}`;

  const save = (mode: "identified" | "anonymous" | "declined") => {
    const name = (state.currentUser?.name ?? manualName) || "Designer";
    const selectedTeam = isNykaaDesignTeam(teamName) ? teamName : undefined;
    const consent = buildLumiConsent(mode, {
      userId,
      name: mode === "anonymous" ? undefined : name,
      teamName: selectedTeam,
    });
    const profile = buildProfile(userId, name, {
      teamName: selectedTeam,
      anonymous: mode === "anonymous",
      consentGiven: mode !== "declined",
    });
    postMessage({ type: "SAVE_CONSENT", consent, profile });
    if (mode !== "declined") onDone();
  };

  const canContinueIdentified = !!teamName;

  return (
    <div className="consent-page">
      <div className="card consent-card">
        <span className="page-eyebrow">Welcome</span>
        <h2 className="page-title">Welcome to LUMI Analytics</h2>
        <p className="consent-note">
          Allow LUMI to track your work sessions for design system productivity insights?
        </p>

        <p className="consent-note"><strong>We collect:</strong></p>
        <ul className="consent-list">
          <li>Designer name and Figma user ID</li>
          <li>Team, session start/end time, project, ticket, and flow</li>
          <li>LUMI component, token, and style usage</li>
          <li>Quality signals from opt-in scans</li>
        </ul>
        <p className="consent-note">
          We do not track every click. We do not monitor Figma unless this plugin is opened.
          You can delete your local data anytime.
        </p>

        {!state.currentUser && (
          <div className="form-group">
            <label>Your name</label>
            <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Your name" />
          </div>
        )}

        <div className="form-group">
          <label>Your team</label>
          <select
            value={teamName}
            onChange={(e) => setTeamName(e.target.value as NykaaDesignTeam | "")}
          >
            <option value="">Select team…</option>
            {NYKAA_DESIGN_TEAMS.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
          <p className="section-footnote">
            Beauty, Man, and Fashion teams only see their own designers in team views.
          </p>
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => save("identified")}
            disabled={!canContinueIdentified}
          >
            Allow and continue
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => save("anonymous")}>
            Continue anonymously
          </button>
          <button type="button" className="btn btn-danger" onClick={() => save("declined")}>
            Decline
          </button>
        </div>

        {state.consent?.mode === "declined" && (
          <p className="error">Tracking declined. Visit Privacy to change your choice.</p>
        )}
      </div>
    </div>
  );
}
