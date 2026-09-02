import type {
  DesignerTimeSeriesPoint,
  DesignerTrendSeries,
  LumiConsent,
  ProductivityResult,
  ProductivityTrendFilters,
  TrendCardSummary,
  TrendGroupBy,
  TrendMetric,
  TrendViewScope,
  WorkSession,
} from "../types";

const SERIES_COLORS = [
  "#6c5ce7",
  "#059669",
  "#d97706",
  "#2563eb",
  "#db2777",
  "#0891b2",
  "#7c3aed",
  "#ca8a04",
];

export function getDefaultTrendFilters(): ProductivityTrendFilters {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dateFrom = `${month}-01`;
  const dateTo = now.toISOString().slice(0, 10);

  return {
    designerUserIds: [],
    designerNames: [],
    teamNames: [],
    dateFrom,
    dateTo,
    month,
    projectNames: [],
    jiraTicketIds: [],
    jiraAssigneeNames: [],
    jiraStatuses: [],
    jiraComponents: [],
    flowNames: [],
    workTypes: [],
    complexities: [],
    confidenceLabels: [],
    sessionStatuses: [],
    groupBy: "week",
    metric: "observedHoursSaved",
    viewScope: "full-designer-view",
  };
}

export function getPeriodKey(isoDate: string, groupBy: TrendGroupBy): string {
  const d = new Date(isoDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  if (groupBy === "day") return `${y}-${m}-${day}`;
  if (groupBy === "month") return `${y}-${m}`;

  const jan1 = new Date(y, 0, 1);
  const week = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
  );
  return `${y}-W${String(week).padStart(2, "0")}`;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function weightedAvg(values: number[], weights: number[]): number {
  let totalWeight = 0;
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    const w = weights[i] ?? 0;
    if (w <= 0) continue;
    total += values[i] * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? total / totalWeight : 0;
}

export function anonymizeDesignerName(
  userId: string,
  realName: string,
  consent: LumiConsent | null,
  index: number
): string {
  if (consent?.mode === "anonymous") return `Designer ${index + 1}`;
  if (consent?.mode === "declined") return `Designer ${index + 1}`;
  return realName;
}

function applyViewScope(
  results: ProductivityResult[],
  sessions: WorkSession[],
  scope: TrendViewScope,
  currentUserId?: string,
  teamName?: string
): { results: ProductivityResult[]; sessions: WorkSession[] } {
  if (scope === "my-data" && currentUserId) {
    return {
      results: results.filter((r) => r.designerUserId === currentUserId),
      sessions: sessions.filter((s) => s.designerUserId === currentUserId),
    };
  }
  if (scope === "team-summary" && teamName) {
    return {
      results: results.filter((r) => (r.teamName ?? "Unassigned") === teamName),
      sessions: sessions.filter((s) => (s.teamName ?? "Unassigned") === teamName),
    };
  }
  return { results, sessions };
}

export function filterResultsForTrend(
  results: ProductivityResult[],
  sessions: WorkSession[],
  filters: ProductivityTrendFilters,
  opts?: { currentUserId?: string; teamName?: string }
): { results: ProductivityResult[]; sessions: WorkSession[] } {
  let scoped = applyViewScope(
    results,
    sessions,
    filters.viewScope,
    opts?.currentUserId,
    opts?.teamName ?? filters.teamNames[0]
  );

  const filteredResults = scoped.results.filter((r) => {
    if (filters.designerUserIds.length && !filters.designerUserIds.includes(r.designerUserId))
      return false;
    if (filters.teamNames.length && !filters.teamNames.includes(r.teamName ?? "Unassigned"))
      return false;
    if (filters.dateFrom && r.createdAt.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && r.createdAt.slice(0, 10) > filters.dateTo) return false;
    if (filters.month && !r.createdAt.startsWith(filters.month)) return false;
    if (filters.projectNames.length && !filters.projectNames.includes(r.projectName ?? ""))
      return false;
    if (filters.jiraTicketIds.length && !filters.jiraTicketIds.includes(r.jiraTicketId ?? ""))
      return false;
    if (filters.flowNames.length && !filters.flowNames.includes(r.flowName ?? "")) return false;
    if (filters.workTypes.length && !filters.workTypes.includes(r.workType ?? "")) return false;
    if (filters.complexities.length && !filters.complexities.includes(r.complexity ?? ""))
      return false;
    if (
      filters.confidenceLabels.length &&
      !filters.confidenceLabels.includes(r.confidence.label)
    )
      return false;
    if (filters.sessionStatuses.length && !filters.sessionStatuses.includes("finished"))
      return false;
    return true;
  });

  const filteredSessions = scoped.sessions.filter((s) => {
    if (filters.designerUserIds.length && !filters.designerUserIds.includes(s.designerUserId))
      return false;
    if (filters.teamNames.length && !filters.teamNames.includes(s.teamName ?? "Unassigned"))
      return false;
    if (filters.dateFrom && s.startedAt.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && s.startedAt.slice(0, 10) > filters.dateTo) return false;
    if (filters.month && !s.startedAt.startsWith(filters.month)) return false;
    if (filters.projectNames.length && !filters.projectNames.includes(s.projectName ?? ""))
      return false;
    if (filters.jiraTicketIds.length && !filters.jiraTicketIds.includes(s.jiraTicketId ?? ""))
      return false;
    if (filters.flowNames.length && !filters.flowNames.includes(s.flowName ?? "")) return false;
    if (filters.workTypes.length && !filters.workTypes.includes(s.workType ?? "")) return false;
    if (filters.complexities.length && !filters.complexities.includes(s.complexity ?? ""))
      return false;
    if (filters.sessionStatuses.length && !filters.sessionStatuses.includes(s.status)) return false;
    return true;
  });

  return { results: filteredResults, sessions: filteredSessions };
}

function resultToPoint(r: ProductivityResult, groupBy: TrendGroupBy): DesignerTimeSeriesPoint {
  const date = r.createdAt.slice(0, 10);
  const lumiAttrMinutes = (r.lumiAttributedHoursSaved ?? 0) * 60;
  return {
    date,
    month: r.createdAt.slice(0, 7),
    periodKey: getPeriodKey(r.createdAt, groupBy),
    designerUserId: r.designerUserId,
    designerName: r.designerName,
    teamName: r.teamName,
    sessions: 1,
    tickets: r.jiraTicketId ? 1 : 0,
    actualMinutes: r.actualMinutes,
    benchmarkMinutes: r.benchmarkMinutes ?? 0,
    observedMinutesSaved: r.observedMinutesSaved ?? 0,
    observedHoursSaved: r.observedHoursSaved ?? 0,
    lumiAttributedMinutesSaved: lumiAttrMinutes,
    lumiAttributedHoursSaved: r.lumiAttributedHoursSaved ?? 0,
    productivityLiftPercent: r.productivityLiftPercent ?? null,
    lumiAdoptionRate: r.lumiAdoptionRate,
    tokenAdoptionRate: r.tokenAdoptionRate,
    styleAdoptionRate: r.styleAdoptionRate,
    componentReuse: r.lumiComponentInstances,
    componentsReusedPerHour: r.componentsReusedPerHour ?? 0,
    lumiLeverageScore: r.designSystemLeverageScore,
    qualityScore: r.qualityScore,
    confidenceScore: r.confidence.score,
    confidenceLabel: r.confidence.label,
  };
}

function mergePoints(points: DesignerTimeSeriesPoint[]): DesignerTimeSeriesPoint {
  const first = points[0];
  const benchmarkWeights = points.map((p) => p.benchmarkMinutes);
  const instanceWeights = points.map((p) => p.componentReuse);
  const liftValues = points
    .filter((p) => p.productivityLiftPercent !== null)
    .map((p) => p.productivityLiftPercent as number);
  const liftWeights = points
    .filter((p) => p.benchmarkMinutes > 0)
    .map((p) => p.benchmarkMinutes);

  return {
    ...first,
    sessions: points.reduce((s, p) => s + p.sessions, 0),
    tickets: new Set(points.filter((p) => p.tickets > 0).map((p) => p.designerUserId)).size,
    actualMinutes: points.reduce((s, p) => s + p.actualMinutes, 0),
    benchmarkMinutes: points.reduce((s, p) => s + p.benchmarkMinutes, 0),
    observedMinutesSaved: points.reduce((s, p) => s + p.observedMinutesSaved, 0),
    observedHoursSaved: points.reduce((s, p) => s + p.observedHoursSaved, 0),
    lumiAttributedMinutesSaved: points.reduce((s, p) => s + p.lumiAttributedMinutesSaved, 0),
    lumiAttributedHoursSaved: points.reduce((s, p) => s + p.lumiAttributedHoursSaved, 0),
    productivityLiftPercent:
      liftValues.length > 0 ? weightedAvg(liftValues, liftWeights) : null,
    lumiAdoptionRate: weightedAvg(
      points.map((p) => p.lumiAdoptionRate),
      instanceWeights.length ? instanceWeights : points.map(() => 1)
    ),
    tokenAdoptionRate: weightedAvg(
      points.map((p) => p.tokenAdoptionRate),
      instanceWeights.length ? instanceWeights : points.map(() => 1)
    ),
    styleAdoptionRate: weightedAvg(
      points.map((p) => p.styleAdoptionRate),
      instanceWeights.length ? instanceWeights : points.map(() => 1)
    ),
    componentReuse: points.reduce((s, p) => s + p.componentReuse, 0),
    componentsReusedPerHour: avg(points.map((p) => p.componentsReusedPerHour)),
    lumiLeverageScore: avg(points.map((p) => p.lumiLeverageScore)),
    qualityScore: avg(points.map((p) => p.qualityScore)),
    confidenceScore: avg(points.map((p) => p.confidenceScore)),
    confidenceLabel: first.confidenceLabel,
  };
}

function liveSessionToPoint(session: WorkSession, groupBy: TrendGroupBy, liveMinutes: number): DesignerTimeSeriesPoint {
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  return {
    date,
    month: now.slice(0, 7),
    periodKey: getPeriodKey(now, groupBy),
    designerUserId: session.designerUserId,
    designerName: session.designerName,
    teamName: session.teamName,
    sessions: 1,
    tickets: session.jiraTicketId ? 1 : 0,
    actualMinutes: liveMinutes,
    benchmarkMinutes: 0,
    observedMinutesSaved: 0,
    observedHoursSaved: 0,
    lumiAttributedMinutesSaved: 0,
    lumiAttributedHoursSaved: 0,
    productivityLiftPercent: null,
    lumiAdoptionRate: 0,
    tokenAdoptionRate: 0,
    styleAdoptionRate: 0,
    componentReuse: 0,
    componentsReusedPerHour: 0,
    lumiLeverageScore: 0,
    qualityScore: 0,
    confidenceScore: 0,
    confidenceLabel: "unavailable",
    isLive: true,
  };
}

export function computeLiveMinutes(session: WorkSession, now = Date.now()): number {
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
  return Math.max(0, Math.round((now - start - pausedMs) / 60000));
}

export function buildTrendSeries(
  results: ProductivityResult[],
  sessions: WorkSession[],
  filters: ProductivityTrendFilters,
  opts?: {
    currentUserId?: string;
    teamName?: string;
    consent?: LumiConsent | null;
    liveMinutesBySession?: Record<string, number>;
  }
): DesignerTrendSeries[] {
  const { results: filtered, sessions: filteredSessions } = filterResultsForTrend(
    results,
    sessions,
    filters,
    opts
  );

  const designerIndex = new Map<string, number>();
  let idx = 0;
  for (const r of filtered) {
    if (!designerIndex.has(r.designerUserId)) {
      designerIndex.set(r.designerUserId, idx++);
    }
  }

  const seriesMap = new Map<string, Map<string, DesignerTimeSeriesPoint[]>>();

  for (const r of filtered) {
    const point = resultToPoint(r, filters.groupBy);
    const anonName = anonymizeDesignerName(
      r.designerUserId,
      r.designerName,
      opts?.consent ?? null,
      designerIndex.get(r.designerUserId) ?? 0
    );
    point.designerName = anonName;

    const designerKey = r.designerUserId;
    if (!seriesMap.has(designerKey)) seriesMap.set(designerKey, new Map());
    const periodMap = seriesMap.get(designerKey)!;
    const list = periodMap.get(point.periodKey) ?? [];
    list.push(point);
    periodMap.set(point.periodKey, list);
  }

  const activeSessions = filteredSessions.filter((s) =>
    ["draft", "active", "paused"].includes(s.status)
  );

  for (const session of activeSessions) {
    const liveMinutes =
      opts?.liveMinutesBySession?.[session.id] ?? computeLiveMinutes(session);
    const point = liveSessionToPoint(session, filters.groupBy, liveMinutes);
    point.designerName = anonymizeDesignerName(
      session.designerUserId,
      session.designerName,
      opts?.consent ?? null,
      designerIndex.get(session.designerUserId) ?? idx++
    );

    if (!seriesMap.has(session.designerUserId)) seriesMap.set(session.designerUserId, new Map());
    const periodMap = seriesMap.get(session.designerUserId)!;
    const existing = periodMap.get(point.periodKey) ?? [];
    existing.push(point);
    periodMap.set(point.periodKey, existing);
  }

  const series: DesignerTrendSeries[] = [];

  for (const [designerUserId, periodMap] of seriesMap.entries()) {
    const mergedPoints = [...periodMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, pts]) => mergePoints(pts));

    const firstPoint = mergedPoints[0];
    if (!firstPoint) continue;

    series.push({
      designerUserId,
      designerName: firstPoint.designerName,
      teamName: firstPoint.teamName,
      colorIndex: designerIndex.get(designerUserId) ?? 0,
      isLive: mergedPoints.some((p) => p.isLive),
      points: mergedPoints,
    });
  }

  series.sort((a, b) => a.designerName.localeCompare(b.designerName));

  if (series.length > 1) {
    const teamPeriodMap = new Map<string, DesignerTimeSeriesPoint[]>();
    for (const s of series) {
      for (const p of s.points) {
        const list = teamPeriodMap.get(p.periodKey) ?? [];
        list.push(p);
        teamPeriodMap.set(p.periodKey, list);
      }
    }
    const teamPoints = [...teamPeriodMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, pts]) => {
        const merged = mergePoints(pts);
        return {
          ...merged,
          designerUserId: "__team_avg__",
          designerName: "Team average",
        };
      });

    if (teamPoints.length > 0) {
      series.push({
        designerUserId: "__team_avg__",
        designerName: "Team average",
        teamName: filters.teamNames[0],
        colorIndex: SERIES_COLORS.length - 1,
        isTeamAverage: true,
        points: teamPoints,
      });
    }
  }

  if (filters.designerUserIds.length === 1) {
    return series.filter(
      (s) => s.designerUserId === filters.designerUserIds[0] || s.isTeamAverage
    );
  }

  if (filters.designerUserIds.length > 1) {
    const ids = new Set(filters.designerUserIds);
    return series.filter((s) => ids.has(s.designerUserId));
  }

  return series;
}

export function buildTrendCardSummary(
  results: ProductivityResult[],
  sessions: WorkSession[],
  filters: ProductivityTrendFilters,
  opts?: { currentUserId?: string; teamName?: string }
): TrendCardSummary {
  const { results: filtered, sessions: filteredSessions } = filterResultsForTrend(
    results,
    sessions,
    filters,
    opts
  );

  const activeSessions = filteredSessions.filter((s) =>
    ["draft", "active", "paused"].includes(s.status)
  );
  const liveMinutes = activeSessions.reduce((s, sess) => s + computeLiveMinutes(sess), 0);

  const actualMinutes =
    filtered.reduce((s, r) => s + r.actualMinutes, 0) + liveMinutes;
  const benchmarkMinutes = filtered.reduce((s, r) => s + (r.benchmarkMinutes ?? 0), 0);

  return {
    designers: new Set([
      ...filtered.map((r) => r.designerUserId),
      ...activeSessions.map((s) => s.designerUserId),
    ]).size,
    tickets: new Set(filtered.map((r) => r.jiraTicketId).filter(Boolean)).size,
    sessions: filtered.length + activeSessions.length,
    actualHours: actualMinutes / 60,
    benchmarkHours: benchmarkMinutes / 60,
    observedHoursSaved: filtered.reduce((s, r) => s + (r.observedHoursSaved ?? 0), 0),
    lumiAttributedHoursSaved: filtered.reduce(
      (s, r) => s + (r.lumiAttributedHoursSaved ?? 0),
      0
    ),
    averageLumiAdoption: avg(filtered.map((r) => r.lumiAdoptionRate)),
    componentReuse: filtered.reduce((s, r) => s + r.lumiComponentInstances, 0),
    averageComponentsPerHour: avg(filtered.map((r) => r.componentsReusedPerHour ?? 0)),
    averageTokenAdoption: avg(filtered.map((r) => r.tokenAdoptionRate)),
    averageLeverageScore: avg(filtered.map((r) => r.designSystemLeverageScore)),
    qualityScore: avg(filtered.map((r) => r.qualityScore)),
    hasBenchmark: filtered.some((r) => (r.benchmarkMinutes ?? 0) > 0),
    hasLiveSession: activeSessions.length > 0,
  };
}

export function getMetricValue(point: DesignerTimeSeriesPoint, metric: TrendMetric): number {
  switch (metric) {
    case "observedHoursSaved":
      return point.observedHoursSaved;
    case "lumiAttributedHoursSaved":
      return point.lumiAttributedHoursSaved;
    case "productivityLiftPercent":
      return point.productivityLiftPercent ?? 0;
    case "actualHours":
      return point.actualMinutes / 60;
    case "benchmarkHours":
      return point.benchmarkMinutes / 60;
    case "lumiAdoptionRate":
      return point.lumiAdoptionRate;
    case "componentReuse":
      return point.componentReuse;
    case "componentsReusedPerHour":
      return point.componentsReusedPerHour;
    case "tokenAdoptionRate":
      return point.tokenAdoptionRate;
    case "lumiLeverageScore":
      return point.lumiLeverageScore;
    case "qualityScore":
      return point.qualityScore;
    default:
      return 0;
  }
}

export function getMetricLabel(metric: TrendMetric): string {
  const labels: Record<TrendMetric, string> = {
    observedHoursSaved: "Observed hours saved",
    lumiAttributedHoursSaved: "LUMI-attributed hours saved",
    productivityLiftPercent: "Productivity lift %",
    actualHours: "Actual hours worked",
    benchmarkHours: "Benchmark hours",
    lumiAdoptionRate: "LUMI adoption %",
    componentReuse: "Component reuse",
    componentsReusedPerHour: "Components reused/hour",
    tokenAdoptionRate: "Token adoption %",
    lumiLeverageScore: "LUMI leverage score",
    qualityScore: "Quality score",
  };
  return labels[metric];
}

export function getSeriesColor(index: number, isTeamAverage?: boolean): string {
  if (isTeamAverage) return "#9ca3af";
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

export function flattenSeriesToRows(series: DesignerTrendSeries[]): DesignerTimeSeriesPoint[] {
  const rows: DesignerTimeSeriesPoint[] = [];
  for (const s of series) {
    if (s.isTeamAverage) continue;
    for (const p of s.points) {
      rows.push({ ...p, designerName: s.designerName, teamName: s.teamName ?? p.teamName });
    }
  }
  return rows.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}

export function extractFilterOptions(
  results: ProductivityResult[],
  sessions: WorkSession[]
): {
  designers: { id: string; name: string }[];
  teams: string[];
  projects: string[];
  flows: string[];
  tickets: string[];
  workTypes: string[];
  complexities: string[];
} {
  const designerMap = new Map<string, string>();
  for (const r of results) designerMap.set(r.designerUserId, r.designerName);
  for (const s of sessions) designerMap.set(s.designerUserId, s.designerName);

  return {
    designers: [...designerMap.entries()].map(([id, name]) => ({ id, name })),
    teams: [...new Set([...results, ...sessions].map((x) => x.teamName ?? "Unassigned"))],
    projects: [
      ...new Set(
        [...results, ...sessions].map((x) => x.projectName).filter(Boolean) as string[]
      ),
    ],
    flows: [
      ...new Set([...results, ...sessions].map((x) => x.flowName).filter(Boolean) as string[]),
    ],
    tickets: [
      ...new Set([...results, ...sessions].map((x) => x.jiraTicketId).filter(Boolean) as string[]),
    ],
    workTypes: [
      ...new Set([...results, ...sessions].map((x) => x.workType).filter(Boolean) as string[]),
    ],
    complexities: [
      ...new Set([...results, ...sessions].map((x) => x.complexity).filter(Boolean) as string[]),
    ],
  };
}
