import {
  aggregateBenchmarkCounts,
  computeBenchmarkRates,
  generateInsightSummary,
} from "../backend/services/benchmarkFormulas";
import type {
  DesignSystemBenchmarkFilters,
  DsBenchmarkDashboardPayload,
  LumiAnalyticsScanPayload,
  LumiVsLegacySummary,
} from "../backend/types/designSystemRegistry";
import type { LumiScanSnapshot, ProductivityResult, WorkSession } from "../types";

function summarizePayloads(
  payloads: LumiAnalyticsScanPayload[],
  filters: DesignSystemBenchmarkFilters = {}
): LumiVsLegacySummary {
  const totals = {
    scans: payloads.length,
    totalComponentInstances: 0,
    lumiInstances: 0,
    ndsBeautyInstances: 0,
    ndsFashionInstances: 0,
    legacyOtherInstances: 0,
    detachedCandidates: 0,
    customUiCandidates: 0,
  };

  const counts = aggregateBenchmarkCounts(payloads.map((p) => p.counts));
  totals.totalComponentInstances = counts.totalComponentInstances;
  totals.lumiInstances = counts.lumiInstances;
  totals.ndsBeautyInstances = counts.ndsBeautyInstances;
  totals.ndsFashionInstances = counts.ndsFashionInstances;
  totals.legacyOtherInstances = counts.legacyOtherInstances;
  totals.detachedCandidates = counts.detachedCandidates;
  totals.customUiCandidates = counts.customUiCandidates;

  const avgQuality =
    payloads.length > 0
      ? payloads.reduce((a, p) => a + p.rates.qualityScore, 0) / payloads.length
      : 0;

  const rates = computeBenchmarkRates({ ...counts, qualityScore: avgQuality });
  return {
    period: { from: filters.dateFrom, to: filters.dateTo, month: filters.month },
    totals,
    rates,
    insightSummary: generateInsightSummary(rates, totals),
  };
}

export function extractScanPayloads(scans: LumiScanSnapshot[]): LumiAnalyticsScanPayload[] {
  return scans
    .map((s) => s.systemClassification)
    .filter((p): p is LumiAnalyticsScanPayload => !!p);
}

export function buildLocalDsBenchmarkDashboard(
  scans: LumiScanSnapshot[],
  registrySyncedAt: string | null
): DsBenchmarkDashboardPayload {
  const payloads = extractScanPayloads(scans);
  const summary = summarizePayloads(payloads);

  const byMonth = new Map<string, LumiAnalyticsScanPayload[]>();
  for (const p of payloads) {
    const month = p.scannedAt.slice(0, 7);
    const list = byMonth.get(month) ?? [];
    list.push(p);
    byMonth.set(month, list);
  }

  const trends = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rows]) => {
      const s = summarizePayloads(rows, { month });
      return { month, rates: s.rates, totals: s.totals };
    });

  const byFlowMap = new Map<string, LumiAnalyticsScanPayload[]>();
  for (const p of payloads) {
    const flow = p.flowName ?? "Other";
    const list = byFlowMap.get(flow) ?? [];
    list.push(p);
    byFlowMap.set(flow, list);
  }

  const byFlow = [...byFlowMap.entries()].map(([flowName, rows]) => ({
    flowName,
    ...summarizePayloads(rows),
  }));

  const byTeamMap = new Map<string, LumiAnalyticsScanPayload[]>();
  for (const p of payloads) {
    const team = p.teamName ?? "Unassigned";
    const list = byTeamMap.get(team) ?? [];
    list.push(p);
    byTeamMap.set(team, list);
  }

  const byTeam = [...byTeamMap.entries()].map(([teamName, rows]) => ({
    teamName,
    ...summarizePayloads(rows),
  }));

  const usageByKey = new Map<string, { name: string; classification: string; count: number }>();
  for (const p of payloads) {
    for (const row of p.componentBreakdown) {
      if (!row.componentKey) continue;
      if (
        row.classification === "nds-beauty" ||
        row.classification === "nds-fashion" ||
        row.classification === "legacy-other" ||
        row.classification === "detached-candidate"
      ) {
        const existing = usageByKey.get(row.componentKey);
        usageByKey.set(row.componentKey, {
          name: row.componentName ?? row.nodeName,
          classification: row.classification,
          count: (existing?.count ?? 0) + 1,
        });
      }
    }
  }

  const opportunities = [...usageByKey.entries()]
    .map(([sourceComponentKey, meta]) => ({
      sourceComponentKey,
      sourceComponentName: meta.name,
      classification: meta.classification as import("../backend/types/designSystemRegistry").ComponentSystemClassification,
      usageCount: meta.count,
      confidence: "suggested" as const,
      migrationPriority: meta.count >= 5 ? "high" : meta.count >= 2 ? "medium" : "low",
    }))
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 20);

  return {
    summary,
    trends,
    byFlow,
    byTeam,
    opportunities,
    registrySyncedAt,
  };
}

export async function postScanPayloadToBackend(
  payload: LumiAnalyticsScanPayload,
  apiBaseUrl: string
): Promise<boolean> {
  try {
    const res = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/api/analytics/scans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function postProductivityToBackend(
  body: { result: ProductivityResult; session?: WorkSession },
  apiBaseUrl: string
): Promise<boolean> {
  try {
    const res = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/api/analytics/productivity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}
