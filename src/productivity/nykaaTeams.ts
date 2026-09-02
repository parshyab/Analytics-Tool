import type { PluginState, ProductivityResult, WorkSession } from "../types";

export const NYKAA_DESIGN_TEAMS = ["Beauty", "Man", "Fashion"] as const;
export type NykaaDesignTeam = (typeof NYKAA_DESIGN_TEAMS)[number];

export function isNykaaDesignTeam(value?: string | null): value is NykaaDesignTeam {
  return !!value && (NYKAA_DESIGN_TEAMS as readonly string[]).includes(value);
}

export function resolvePluginTeamName(
  state: Pick<PluginState, "profile" | "consent" | "settings">
): NykaaDesignTeam | undefined {
  const raw =
    state.profile?.teamName ?? state.consent?.teamName ?? state.settings?.teamName ?? undefined;
  return isNykaaDesignTeam(raw) ? raw : undefined;
}

export function resolveDesignerTeamName(
  designerUserId: string,
  designerName: string,
  sessions: WorkSession[],
  results: ProductivityResult[]
): string | undefined {
  const fromResult = results.find(
    (r) => r.designerUserId === designerUserId && r.teamName
  )?.teamName;
  if (fromResult) return fromResult;

  const fromSession = sessions.find(
    (s) => s.designerUserId === designerUserId && s.teamName
  )?.teamName;
  if (fromSession) return fromSession;

  const fromNameResult = results.find(
    (r) => r.designerName === designerName && r.teamName
  )?.teamName;
  if (fromNameResult) return fromNameResult;

  return sessions.find((s) => s.designerName === designerName && s.teamName)?.teamName;
}

export function filterResultsForTeam(
  results: ProductivityResult[],
  team?: NykaaDesignTeam
): ProductivityResult[] {
  if (!team) return results;
  return results.filter((r) => r.teamName === team);
}

export function filterSessionsForTeam(
  sessions: WorkSession[],
  team?: NykaaDesignTeam
): WorkSession[] {
  if (!team) return sessions;
  return sessions.filter((s) => s.teamName === team);
}

export function filterDesignerOptionsForTeam(
  designers: { id: string; name: string }[],
  team: NykaaDesignTeam | undefined,
  sessions: WorkSession[],
  results: ProductivityResult[]
): { id: string; name: string }[] {
  if (!team) return designers;
  return designers.filter((d) => resolveDesignerTeamName(d.id, d.name, sessions, results) === team);
}

export function teamLabel(team: NykaaDesignTeam): string {
  switch (team) {
    case "Beauty":
      return "Beauty designers";
    case "Fashion":
      return "Fashion designers";
    case "Man":
      return "Man designers";
    default:
      return team;
  }
}
