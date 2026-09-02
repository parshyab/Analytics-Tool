import type {
  AutoStartSettings,
  DesignerProfile,
  PluginSettings,
  SessionMetadataSource,
  SessionTimeAdjustment,
  WorkSession,
  WorkSessionStatus,
} from "../types";
import { DEFAULT_SETTINGS, normalizeScanScope } from "../types";

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function computeElapsedMinutes(session: WorkSession, now = Date.now()): number {
  const start = new Date(session.startedAt).getTime();
  let pausedMs = 0;

  for (const interval of session.pauseIntervals) {
    const pStart = new Date(interval.pausedAt).getTime();
    const pEnd = interval.resumedAt ? new Date(interval.resumedAt).getTime() : now;
    pausedMs += pEnd - pStart;
  }

  if (session.status === "paused" && session.pausedAt) {
    pausedMs += now - new Date(session.pausedAt).getTime();
  }

  const rawMs = now - start - pausedMs;
  return Math.max(0, Math.round(rawMs / 60000));
}

export function computePauseMinutes(session: WorkSession): number {
  let total = 0;
  for (const interval of session.pauseIntervals) {
    if (interval.minutes !== undefined) {
      total += interval.minutes;
    } else if (interval.resumedAt) {
      total += Math.round(
        (new Date(interval.resumedAt).getTime() - new Date(interval.pausedAt).getTime()) / 60000
      );
    }
  }
  return total;
}

export function buildTimeAdjustment(session: WorkSession): SessionTimeAdjustment {
  const rawElapsedMinutes = computeElapsedMinutes(session);
  const pausedMinutes = computePauseMinutes(session);
  const suggestedActualMinutes = Math.max(0, rawElapsedMinutes);

  return {
    rawElapsedMinutes,
    pausedMinutes,
    suggestedActualMinutes,
    adjustedActualMinutes: session.adjustedActualMinutes ?? suggestedActualMinutes,
    adjustmentReason: session.adjustmentReason ?? "none",
    adjustmentNote: session.adjustmentNote,
  };
}

export function isMetadataComplete(session: WorkSession): boolean {
  return !!(session.flowName && session.scanScope && session.complexity && session.workType);
}

export function updateReportingEligibility(
  session: WorkSession,
  settings: PluginSettings
): WorkSession {
  const metadataComplete = isMetadataComplete(session);
  const eligible =
    metadataComplete &&
    session.status === "finished" &&
    (!settings.autoStart.requireMetadataBeforeReporting || metadataComplete);

  return { ...session, metadataComplete, eligibleForReporting: eligible };
}

export function createSession(
  profile: DesignerProfile,
  opts: Partial<WorkSession> & { scanScope: WorkSession["scanScope"] },
  autoStarted = false
): WorkSession {
  const now = new Date().toISOString();
  const scanScope = normalizeScanScope(opts.scanScope);
  const jiraTicketId = opts.jiraIssueKey ?? opts.jiraTicketId;
  const jiraTicketUrl = opts.jiraIssueUrl ?? opts.jiraTicketUrl;

  const session: WorkSession = {
    id: uid(),
    designerUserId: profile.userId,
    designerName: profile.name,
    designerEmail: profile.email,
    teamName: profile.teamName,
    anonymous: !!profile.anonymousLabel,
    fileName: figma.root.name,
    fileKey: figma.fileKey,
    pageName: figma.currentPage.name,
    scanScope,
    workType: opts.workType ?? "iteration",
    complexity: opts.complexity ?? "medium",
    status: autoStarted ? "draft" : "active",
    autoStarted,
    startedAt: now,
    lastSeenAt: now,
    pauseIntervals: [],
    metadataComplete: false,
    eligibleForReporting: false,
    metadataSource: opts.metadataSource ?? defaultMetadataSource(opts),
    createdAt: now,
    updatedAt: now,
    ...opts,
    jiraTicketId,
    jiraTicketUrl,
    jiraIssueKey: jiraTicketId,
    jiraIssueUrl: jiraTicketUrl,
  };

  const selection = figma.currentPage.selection[0];
  if (selection) {
    session.selectedNodeId = selection.id;
    session.selectedNodeName = selection.name;
    session.selectedNodeType = selection.type;
  }

  session.metadataComplete = isMetadataComplete(session);
  return session;
}

function defaultMetadataSource(opts: Partial<WorkSession>): SessionMetadataSource {
  const hasTicket = !!(opts.jiraIssueKey ?? opts.jiraTicketId);
  return {
    ticket: hasTicket ? "manual" : "none",
    flow: opts.flowName ? "manual" : "auto",
    complexity: opts.complexity ? "manual" : "none",
    scanScope: "auto",
  };
}

export function pauseSession(session: WorkSession): WorkSession {
  const now = new Date().toISOString();
  return {
    ...session,
    status: "paused",
    pausedAt: now,
    lastSeenAt: now,
    updatedAt: now,
  };
}

export function resumeSession(session: WorkSession): WorkSession {
  const now = new Date().toISOString();
  const intervals = [...session.pauseIntervals];
  if (session.pausedAt) {
    intervals.push({ pausedAt: session.pausedAt, resumedAt: now });
  }
  return {
    ...session,
    status: "active",
    pausedAt: undefined,
    resumedAt: now,
    pauseIntervals: intervals,
    lastSeenAt: now,
    updatedAt: now,
  };
}

export function finishSession(
  session: WorkSession,
  adjustment: SessionTimeAdjustment
): WorkSession {
  const now = new Date().toISOString();
  return {
    ...session,
    status: "finished",
    finishedAt: now,
    rawElapsedMinutes: adjustment.rawElapsedMinutes,
    adjustedActualMinutes: adjustment.adjustedActualMinutes,
    adjustmentReason: adjustment.adjustmentReason,
    adjustmentNote: adjustment.adjustmentNote,
    lastSeenAt: now,
    updatedAt: now,
    metadataComplete: isMetadataComplete(session),
    eligibleForReporting: isMetadataComplete(session),
  };
}

export function handlePluginClose(
  session: WorkSession,
  keepWhenHidden: boolean
): WorkSession {
  const now = new Date().toISOString();
  if (!keepWhenHidden && session.status === "active") {
    return pauseSession({ ...session, lastSeenAt: now });
  }
  return { ...session, lastSeenAt: now, updatedAt: now };
}

export function handleRestoreSession(
  session: WorkSession,
  action: "continue" | "pause" | "edit" | "finish" | "discard",
  manualMinutes?: number
): WorkSession | null | "finish" {
  const now = new Date().toISOString();
  const gapMinutes = Math.round(
    (Date.now() - new Date(session.lastSeenAt).getTime()) / 60000
  );

  switch (action) {
    case "continue":
      return {
        ...session,
        status: session.status === "paused" ? "active" : session.status,
        pluginRestoredAt: now,
        lastSeenAt: now,
        updatedAt: now,
        pausedAt: undefined,
      };
    case "pause": {
      const intervals = [
        ...session.pauseIntervals,
        { pausedAt: session.lastSeenAt, resumedAt: now, minutes: gapMinutes },
      ];
      return {
        ...session,
        status: "active",
        pauseIntervals: intervals,
        pluginRestoredAt: now,
        lastSeenAt: now,
        updatedAt: now,
      };
    }
    case "edit":
      return {
        ...session,
        adjustedActualMinutes: manualMinutes ?? session.adjustedActualMinutes,
        adjustmentReason: "plugin-closed",
        pluginRestoredAt: now,
        lastSeenAt: now,
        updatedAt: now,
      };
    case "finish":
      return "finish";
    case "discard":
      return null;
    default:
      return session;
  }
}

export function enterBackgroundMode(session: WorkSession): WorkSession {
  const now = new Date().toISOString();
  return {
    ...session,
    pluginHiddenAt: now,
    lastSeenAt: now,
    updatedAt: now,
  };
}

export function markPluginRestored(session: WorkSession): WorkSession {
  const now = new Date().toISOString();
  return {
    ...session,
    pluginRestoredAt: now,
    lastSeenAt: now,
    updatedAt: now,
  };
}

export function handleClosedTimeChoice(
  session: WorkSession,
  action: "count" | "pause" | "manual" | "discard",
  manualMinutes?: number
): WorkSession | null {
  const gapStart = new Date(session.lastSeenAt).getTime();
  const gapEnd = Date.now();
  const gapMinutes = Math.round((gapEnd - gapStart) / 60000);

  switch (action) {
    case "count":
      return { ...session, lastSeenAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    case "pause": {
      const intervals = [
        ...session.pauseIntervals,
        { pausedAt: session.lastSeenAt, resumedAt: new Date().toISOString(), minutes: gapMinutes },
      ];
      return {
        ...session,
        pauseIntervals: intervals,
        lastSeenAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    case "manual":
      return {
        ...session,
        adjustedActualMinutes: manualMinutes ?? session.adjustedActualMinutes,
        adjustmentReason: "plugin-closed",
        lastSeenAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    case "discard":
      return null;
    default:
      return session;
  }
}

export function isUnusuallyLongSession(session: WorkSession): boolean {
  return computeElapsedMinutes(session) > 480;
}

export function getActiveStatuses(): WorkSessionStatus[] {
  return ["draft", "active", "paused"];
}
