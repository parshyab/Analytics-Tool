import type {
  DesignerAggregate,
  MonthlyAggregate,
  ProductivityFilters,
  ProductivityResult,
  TeamAggregate,
  WorkSession,
} from "../types";

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function dominantConfidence(
  labels: ProductivityResult["confidence"]["label"][]
): ProductivityResult["confidence"]["label"] {
  if (labels.includes("high")) return "high";
  if (labels.includes("medium")) return "medium";
  if (labels.includes("low")) return "low";
  if (labels.includes("directional")) return "directional";
  return "unavailable";
}

export function filterResults(
  results: ProductivityResult[],
  filters: ProductivityFilters
): ProductivityResult[] {
  return results.filter((r) => {
    if (filters.designerUserId && r.designerUserId !== filters.designerUserId) return false;
    if (filters.teamName && r.teamName !== filters.teamName) return false;
    if (filters.projectName && r.projectName !== filters.projectName) return false;
    if (filters.flowName && r.flowName !== filters.flowName) return false;
    if (filters.fromDate && r.createdAt < filters.fromDate) return false;
    if (filters.toDate && r.createdAt > filters.toDate) return false;
    if (filters.confidence?.length && !filters.confidence.includes(r.confidence.label)) return false;
    return true;
  });
}

export function aggregateByDesigner(results: ProductivityResult[]): DesignerAggregate[] {
  const map = new Map<string, ProductivityResult[]>();
  for (const r of results) {
    const list = map.get(r.designerUserId) ?? [];
    list.push(r);
    map.set(r.designerUserId, list);
  }

  return [...map.entries()].map(([designerUserId, rows]) => {
    const tickets = new Set(rows.map((r) => r.jiraTicketId).filter(Boolean)).size;
    return {
      designerUserId,
      designerName: rows[0].designerName,
      teamName: rows[0].teamName,
      sessions: rows.length,
      tickets,
      actualHours: avg(rows.map((r) => r.actualMinutes)) * rows.length / 60,
      benchmarkHours: avg(rows.map((r) => r.benchmarkMinutes ?? 0).filter(Boolean)) * rows.length / 60,
      observedHoursSaved: rows.reduce((s, r) => s + (r.observedHoursSaved ?? 0), 0),
      lumiAttributedHoursSaved: rows.reduce((s, r) => s + (r.lumiAttributedHoursSaved ?? 0), 0),
      productivityLiftPercent: avg(rows.map((r) => r.productivityLiftPercent ?? 0)),
      lumiAdoptionRate: avg(rows.map((r) => r.lumiAdoptionRate)),
      componentsReused: rows.reduce((s, r) => s + r.lumiComponentInstances, 0),
      componentsReusedPerHour: avg(rows.map((r) => r.componentsReusedPerHour ?? 0)),
      tokenAdoptionRate: avg(rows.map((r) => r.tokenAdoptionRate)),
      styleAdoptionRate: avg(rows.map((r) => r.styleAdoptionRate)),
      qualityScore: avg(rows.map((r) => r.qualityScore)),
      designSystemLeverageScore: avg(rows.map((r) => r.designSystemLeverageScore)),
      confidence: dominantConfidence(rows.map((r) => r.confidence.label)),
      lastSessionAt: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt,
    };
  });
}

export function aggregateByTeam(results: ProductivityResult[]): TeamAggregate[] {
  const map = new Map<string, ProductivityResult[]>();
  for (const r of results) {
    const team = r.teamName ?? "Unassigned";
    const list = map.get(team) ?? [];
    list.push(r);
    map.set(team, list);
  }

  return [...map.entries()].map(([teamName, rows]) => {
    const designers = new Set(rows.map((r) => r.designerUserId)).size;
    const tickets = new Set(rows.map((r) => r.jiraTicketId).filter(Boolean)).size;
    return {
      teamName,
      designers,
      sessions: rows.length,
      tickets,
      actualHours: rows.reduce((s, r) => s + r.actualMinutes, 0) / 60,
      benchmarkHours: rows.reduce((s, r) => s + (r.benchmarkMinutes ?? 0), 0) / 60,
      observedHoursSaved: rows.reduce((s, r) => s + (r.observedHoursSaved ?? 0), 0),
      lumiAttributedHoursSaved: rows.reduce((s, r) => s + (r.lumiAttributedHoursSaved ?? 0), 0),
      productivityLiftPercent: avg(rows.map((r) => r.productivityLiftPercent ?? 0)),
      lumiAdoptionRate: avg(rows.map((r) => r.lumiAdoptionRate)),
      tokenAdoptionRate: avg(rows.map((r) => r.tokenAdoptionRate)),
      styleAdoptionRate: avg(rows.map((r) => r.styleAdoptionRate)),
      qualityScore: avg(rows.map((r) => r.qualityScore)),
      confidence: dominantConfidence(rows.map((r) => r.confidence.label)),
    };
  });
}

export function aggregateByMonth(results: ProductivityResult[]): MonthlyAggregate[] {
  const map = new Map<string, ProductivityResult[]>();
  for (const r of results) {
    const month = r.createdAt.slice(0, 7);
    const list = map.get(month) ?? [];
    list.push(r);
    map.set(month, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rows]) => ({
      month,
      designers: new Set(rows.map((r) => r.designerUserId)).size,
      tickets: new Set(rows.map((r) => r.jiraTicketId).filter(Boolean)).size,
      sessions: rows.length,
      actualHours: rows.reduce((s, r) => s + r.actualMinutes, 0) / 60,
      benchmarkHours: rows.reduce((s, r) => s + (r.benchmarkMinutes ?? 0), 0) / 60,
      observedHoursSaved: rows.reduce((s, r) => s + (r.observedHoursSaved ?? 0), 0),
      lumiAttributedHoursSaved: rows.reduce((s, r) => s + (r.lumiAttributedHoursSaved ?? 0), 0),
      averageLumiAdoption: avg(rows.map((r) => r.lumiAdoptionRate)),
      componentReuse: rows.reduce((s, r) => s + r.lumiComponentInstances, 0),
      tokenAdoption: avg(rows.map((r) => r.tokenAdoptionRate)),
      qualityScore: avg(rows.map((r) => r.qualityScore)),
    }));
}

export function getMyTodayStats(
  userId: string,
  sessions: WorkSession[],
  results: ProductivityResult[]
): {
  sessionsToday: number;
  minutesToday: number;
  lumiAdoption: number;
  hoursSaved: number;
} {
  const today = new Date().toISOString().slice(0, 10);
  const myResults = results.filter(
    (r) => r.designerUserId === userId && r.createdAt.startsWith(today)
  );
  const mySessions = sessions.filter(
    (s) => s.designerUserId === userId && s.startedAt.startsWith(today)
  );

  return {
    sessionsToday: mySessions.length,
    minutesToday: myResults.reduce((s, r) => s + r.actualMinutes, 0),
    lumiAdoption: avg(myResults.map((r) => r.lumiAdoptionRate)),
    hoursSaved: myResults.reduce((s, r) => s + (r.observedHoursSaved ?? 0), 0),
  };
}
