import type { LumiAnalyticsScanPayload } from "../types/designSystemRegistry";

export type BenchmarkCountInput = LumiAnalyticsScanPayload["counts"] & {
  qualityScore?: number;
};

export type BenchmarkRateOutput = LumiAnalyticsScanPayload["rates"];

function clamp(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return clamp((numerator / denominator) * 100);
}

export function computeBenchmarkRates(input: BenchmarkCountInput): BenchmarkRateOutput {
  const {
    totalComponentInstances,
    lumiInstances,
    ndsBeautyInstances,
    ndsFashionInstances,
    legacyOtherInstances,
    detachedCandidates,
    customUiCandidates,
    textStyleUses,
    lumiTextStyleUses,
    paintStyleUses,
    lumiPaintStyleUses,
    variableTokenUses,
    lumiVariableTokenUses,
  } = input;

  const legacyInstances =
    ndsBeautyInstances + ndsFashionInstances + legacyOtherInstances;

  const lumiAdoptionRate = safeRate(lumiInstances, totalComponentInstances);
  const ndsBeautyUsageRate = safeRate(ndsBeautyInstances, totalComponentInstances);
  const ndsFashionUsageRate = safeRate(ndsFashionInstances, totalComponentInstances);
  const legacyUsageRate = safeRate(legacyInstances, totalComponentInstances);

  const migrationDenominator = lumiInstances + legacyInstances;
  const migrationProgressRate = safeRate(lumiInstances, migrationDenominator);

  const detachmentDenominator =
    lumiInstances + legacyInstances + detachedCandidates;
  const detachmentRate = safeRate(detachedCandidates, detachmentDenominator);

  const customUiDenominator = totalComponentInstances + customUiCandidates;
  const customUiRate = safeRate(customUiCandidates, customUiDenominator);

  const designDebtNumerator =
    legacyInstances + detachedCandidates + customUiCandidates;
  const designDebtDenominator =
    totalComponentInstances + detachedCandidates + customUiCandidates;
  const designDebtRate = safeRate(designDebtNumerator, designDebtDenominator);

  const styleUses = textStyleUses + paintStyleUses;
  const lumiStyleUses = lumiTextStyleUses + lumiPaintStyleUses;
  const styleAdoptionRate = safeRate(lumiStyleUses, styleUses);

  const tokenAdoptionRate = safeRate(lumiVariableTokenUses, variableTokenUses);

  const legacyReductionRate = clamp(100 - legacyUsageRate);
  const lowDetachmentScore = clamp(100 - detachmentRate);
  const qualityScore = clamp(input.qualityScore ?? 0);

  const lumiProductivityScore = clamp(
    0.3 * lumiAdoptionRate +
      0.2 * legacyReductionRate +
      0.2 * lowDetachmentScore +
      0.15 * tokenAdoptionRate +
      0.15 * qualityScore
  );

  return {
    lumiAdoptionRate,
    legacyUsageRate,
    ndsBeautyUsageRate,
    ndsFashionUsageRate,
    detachmentRate,
    customUiRate,
    designDebtRate,
    migrationProgressRate,
    tokenAdoptionRate,
    styleAdoptionRate,
    qualityScore,
    lumiProductivityScore,
  };
}

export function aggregateBenchmarkCounts(
  snapshots: Array<Pick<LumiAnalyticsScanPayload["counts"], keyof LumiAnalyticsScanPayload["counts"]>>
): LumiAnalyticsScanPayload["counts"] {
  const totals = {
    totalComponentInstances: 0,
    lumiInstances: 0,
    ndsBeautyInstances: 0,
    ndsFashionInstances: 0,
    legacyOtherInstances: 0,
    detachedCandidates: 0,
    customUiCandidates: 0,
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

  for (const s of snapshots) {
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
      totals[key] += s[key] ?? 0;
    }
  }

  return totals;
}

export function generateInsightSummary(
  rates: BenchmarkRateOutput,
  totals: LumiVsLegacyTotals
): string[] {
  const insights: string[] = [];

  if (totals.scans > 0) {
    insights.push(
      `Across ${totals.scans} scan${totals.scans === 1 ? "" : "s"}, LUMI adoption is ${rates.lumiAdoptionRate.toFixed(0)}%.`
    );
  }

  if (rates.legacyUsageRate > 0) {
    insights.push(
      `Legacy design system usage (NDS + other) is ${rates.legacyUsageRate.toFixed(0)}% — migration progress at ${rates.migrationProgressRate.toFixed(0)}%.`
    );
  } else if (totals.totalComponentInstances > 0) {
    insights.push("No legacy NDS instances detected in current scans.");
  }

  if (rates.ndsBeautyUsageRate > 10) {
    insights.push(`NDS Beauty still accounts for ${rates.ndsBeautyUsageRate.toFixed(0)}% of component usage.`);
  }

  if (rates.ndsFashionUsageRate > 10) {
    insights.push(`NDS Fashion still accounts for ${rates.ndsFashionUsageRate.toFixed(0)}% of component usage.`);
  }

  if (rates.detachmentRate > 15) {
    insights.push(
      `Detachment rate is ${rates.detachmentRate.toFixed(0)}% — detached frames may inflate perceived LUMI adoption.`
    );
  }

  if (rates.designDebtRate > 25) {
    insights.push(`Design debt rate is ${rates.designDebtRate.toFixed(0)}% across legacy, detached, and custom UI.`);
  }

  if (rates.lumiProductivityScore >= 70) {
    insights.push("LUMI productivity score indicates strong migration and reuse momentum.");
  }

  return insights.slice(0, 6);
}

export type LumiVsLegacyTotals = {
  scans: number;
  totalComponentInstances: number;
  lumiInstances: number;
  ndsBeautyInstances: number;
  ndsFashionInstances: number;
  legacyOtherInstances: number;
  detachedCandidates: number;
  customUiCandidates: number;
};
