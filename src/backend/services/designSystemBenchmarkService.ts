import {
  aggregateBenchmarkCounts,
  computeBenchmarkRates,
  generateInsightSummary,
  type LumiVsLegacyTotals,
} from "./benchmarkFormulas";
import type { DesignSystemRegistryRepository } from "../repositories/designSystemRegistryRepository";
import type {
  DesignSystemBenchmarkFilters,
  DesignSystemBenchmarkSnapshot,
  LumiAnalyticsScanPayload,
  LumiVsLegacySummary,
} from "../types/designSystemRegistry";
import { monthKey, uid } from "../types/designSystemRegistry";

export class DesignSystemBenchmarkService {
  constructor(private repo: DesignSystemRegistryRepository) {}

  async ingestScanPayload(payload: LumiAnalyticsScanPayload): Promise<DesignSystemBenchmarkSnapshot> {
    await this.repo.saveScanPayload(payload);
    const snapshot = this.payloadToSnapshot(payload);
    await this.repo.saveBenchmarkSnapshot(snapshot);
    return snapshot;
  }

  payloadToSnapshot(payload: LumiAnalyticsScanPayload): DesignSystemBenchmarkSnapshot {
    return {
      id: uid("snap"),
      scanId: payload.scanId,
      createdAt: payload.scannedAt,
      month: monthKey(payload.scannedAt),
      fileKey: payload.fileKey,
      fileName: payload.fileName,
      flowName: payload.flowName,
      teamName: payload.teamName,
      jiraIssueKey: payload.jiraIssueKey,
      totalComponentInstances: payload.counts.totalComponentInstances,
      lumiInstances: payload.counts.lumiInstances,
      ndsBeautyInstances: payload.counts.ndsBeautyInstances,
      ndsFashionInstances: payload.counts.ndsFashionInstances,
      legacyOtherInstances: payload.counts.legacyOtherInstances,
      detachedCandidates: payload.counts.detachedCandidates,
      customUiCandidates: payload.counts.customUiCandidates,
      lumiAdoptionRate: payload.rates.lumiAdoptionRate,
      legacyUsageRate: payload.rates.legacyUsageRate,
      ndsBeautyUsageRate: payload.rates.ndsBeautyUsageRate,
      ndsFashionUsageRate: payload.rates.ndsFashionUsageRate,
      detachmentRate: payload.rates.detachmentRate,
      customUiRate: payload.rates.customUiRate,
      designDebtRate: payload.rates.designDebtRate,
      migrationProgressRate: payload.rates.migrationProgressRate,
      tokenAdoptionRate: payload.rates.tokenAdoptionRate,
      styleAdoptionRate: payload.rates.styleAdoptionRate,
      qualityScore: payload.rates.qualityScore,
      lumiProductivityScore: payload.rates.lumiProductivityScore,
    };
  }

  async compareCurrentScanAgainstLegacy(scanId: string): Promise<LumiVsLegacySummary | null> {
    const payloads = await this.repo.getScanPayloads();
    const scan = payloads.find((p) => p.scanId === scanId);
    if (!scan) return null;
    return this.summarizePayloads([scan], {});
  }

  async getLumiVsLegacySummary(filters: DesignSystemBenchmarkFilters = {}): Promise<LumiVsLegacySummary> {
    const snapshots = await this.repo.getBenchmarkSnapshots(filters);
    if (snapshots.length > 0) {
      return this.summarizeSnapshots(snapshots, filters);
    }
    const payloads = await this.repo.getScanPayloads(filters);
    return this.summarizePayloads(payloads, filters);
  }

  async getBenchmarkTrends(filters: DesignSystemBenchmarkFilters = {}) {
    const snapshots = await this.repo.getBenchmarkSnapshots(filters);
    const byMonth = new Map<string, DesignSystemBenchmarkSnapshot[]>();
    for (const s of snapshots) {
      const list = byMonth.get(s.month) ?? [];
      list.push(s);
      byMonth.set(s.month, list);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, rows]) => {
        const summary = this.summarizeSnapshots(rows, { ...filters, month });
        return { month, rates: summary.rates, totals: summary.totals };
      });
  }

  async getBenchmarkByFlow(filters: DesignSystemBenchmarkFilters = {}) {
    const snapshots = await this.repo.getBenchmarkSnapshots(filters);
    const byFlow = new Map<string, DesignSystemBenchmarkSnapshot[]>();
    for (const s of snapshots) {
      const flow = s.flowName ?? "Other";
      const list = byFlow.get(flow) ?? [];
      list.push(s);
      byFlow.set(flow, list);
    }
    return [...byFlow.entries()].map(([flowName, rows]) => ({
      flowName,
      ...this.summarizeSnapshots(rows, filters),
    }));
  }

  async getBenchmarkByTeam(filters: DesignSystemBenchmarkFilters = {}) {
    const snapshots = await this.repo.getBenchmarkSnapshots(filters);
    const byTeam = new Map<string, DesignSystemBenchmarkSnapshot[]>();
    for (const s of snapshots) {
      const team = s.teamName ?? "Unassigned";
      const list = byTeam.get(team) ?? [];
      list.push(s);
      byTeam.set(team, list);
    }
    return [...byTeam.entries()].map(([teamName, rows]) => ({
      teamName,
      ...this.summarizeSnapshots(rows, filters),
    }));
  }

  async getMigrationProgress(filters: DesignSystemBenchmarkFilters = {}) {
    const summary = await this.getLumiVsLegacySummary(filters);
    return {
      migrationProgressRate: summary.rates.migrationProgressRate,
      lumiAdoptionRate: summary.rates.lumiAdoptionRate,
      legacyUsageRate: summary.rates.legacyUsageRate,
      designDebtRate: summary.rates.designDebtRate,
      insightSummary: summary.insightSummary,
    };
  }

  async getMigrationOpportunities(filters: DesignSystemBenchmarkFilters = {}) {
    const payloads = await this.repo.getScanPayloads(filters);
    const mappings = await this.repo.getReplacementMappings();
    const usageByKey = new Map<string, number>();

    for (const p of payloads) {
      for (const row of p.componentBreakdown) {
        if (!row.componentKey) continue;
        if (
          row.classification === "nds-beauty" ||
          row.classification === "nds-fashion" ||
          row.classification === "legacy-other" ||
          row.classification === "detached-candidate"
        ) {
          usageByKey.set(row.componentKey, (usageByKey.get(row.componentKey) ?? 0) + 1);
        }
      }
    }

    return [...usageByKey.entries()]
      .map(([sourceKey, usageCount]) => {
        const mapping = mappings.find((m) => m.sourceComponentKey === sourceKey);
        const sample = payloads
          .flatMap((p) => p.componentBreakdown)
          .find((r) => r.componentKey === sourceKey);
        return {
          sourceComponentKey: sourceKey,
          sourceComponentName: sample?.componentName ?? sourceKey,
          classification: sample?.classification ?? "unknown",
          usageCount,
          lumiReplacementKey: mapping?.targetComponentKey,
          lumiReplacementName: mapping?.targetComponentName,
          confidence: mapping?.confidence ?? "suggested",
          migrationPriority: usageCount >= 5 ? "high" : usageCount >= 2 ? "medium" : "low",
        };
      })
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 25);
  }

  private summarizeSnapshots(
    snapshots: DesignSystemBenchmarkSnapshot[],
    filters: DesignSystemBenchmarkFilters
  ): LumiVsLegacySummary {
    const totals: LumiVsLegacyTotals = {
      scans: snapshots.length,
      totalComponentInstances: 0,
      lumiInstances: 0,
      ndsBeautyInstances: 0,
      ndsFashionInstances: 0,
      legacyOtherInstances: 0,
      detachedCandidates: 0,
      customUiCandidates: 0,
    };

    for (const s of snapshots) {
      totals.totalComponentInstances += s.totalComponentInstances;
      totals.lumiInstances += s.lumiInstances;
      totals.ndsBeautyInstances += s.ndsBeautyInstances;
      totals.ndsFashionInstances += s.ndsFashionInstances;
      totals.legacyOtherInstances += s.legacyOtherInstances;
      totals.detachedCandidates += s.detachedCandidates;
      totals.customUiCandidates += s.customUiCandidates;
    }

    const avgQuality =
      snapshots.length > 0
        ? snapshots.reduce((a, s) => a + s.qualityScore, 0) / snapshots.length
        : 0;

    const counts = {
      ...totals,
      unknownInstances: 0,
      textStyleUses: 0,
      lumiTextStyleUses: 0,
      legacyTextStyleUses: 0,
      paintStyleUses: 0,
      lumiPaintStyleUses: 0,
      legacyPaintStyleUses: 0,
      variableTokenUses: 0,
      lumiVariableTokenUses: 0,
      legacyVariableTokenUses: 0,
    };

    const rates = computeBenchmarkRates({ ...counts, qualityScore: avgQuality });
    return {
      period: { from: filters.dateFrom, to: filters.dateTo, month: filters.month },
      totals,
      rates,
      insightSummary: generateInsightSummary(rates, totals),
    };
  }

  private summarizePayloads(
    payloads: LumiAnalyticsScanPayload[],
    filters: DesignSystemBenchmarkFilters
  ): LumiVsLegacySummary {
    const totals: LumiVsLegacyTotals = {
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
}

export function createBenchmarkService(
  repo: DesignSystemRegistryRepository
): DesignSystemBenchmarkService {
  return new DesignSystemBenchmarkService(repo);
}
