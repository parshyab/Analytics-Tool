import type { LumiScanSnapshot } from "../../types";
import { extractScanPayloads } from "../../productivity/dsBenchmarkLocal";
import type {
  LumiAdoptionAdminMetrics,
  LumiCurrentMetrics,
  LumiLegacyBenchmarkMetrics,
} from "../types/lumiAdoptionAdmin";
import type { LumiAnalyticsScanPayload } from "../types/designSystemRegistry";

function clamp(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return clamp((numerator / denominator) * 100);
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(0)}%`;
}

function fmtPts(delta: number): string {
  if (!Number.isFinite(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)} pts`;
}

function reworkLevelFromRate(rate: number): "Low" | "Medium" | "High" {
  if (rate < 33) return "Low";
  if (rate < 66) return "Medium";
  return "High";
}

type AggregateInput = {
  totalComponentInstances: number;
  lumiInstances: number;
  ndsBeautyInstances: number;
  ndsFashionInstances: number;
  legacyOtherInstances: number;
  detachedCandidates: number;
  customUiCandidates: number;
  customColors: number;
  customTextStyles: number;
  heavyOverrides: number;
  textStyleUses: number;
  paintStyleUses: number;
  lumiTextStyleUses: number;
  lumiPaintStyleUses: number;
  variableTokenUses: number;
  lumiVariableTokenUses: number;
  tokenAdoptionRate: number;
  styleAdoptionRate: number;
};

function aggregateFromPayloads(payloads: LumiAnalyticsScanPayload[]): AggregateInput {
  const totals = {
    totalComponentInstances: 0,
    lumiInstances: 0,
    ndsBeautyInstances: 0,
    ndsFashionInstances: 0,
    legacyOtherInstances: 0,
    detachedCandidates: 0,
    customUiCandidates: 0,
    customColors: 0,
    customTextStyles: 0,
    heavyOverrides: 0,
    textStyleUses: 0,
    paintStyleUses: 0,
    lumiTextStyleUses: 0,
    lumiPaintStyleUses: 0,
    variableTokenUses: 0,
    lumiVariableTokenUses: 0,
    tokenAdoptionSum: 0,
    styleAdoptionSum: 0,
  };

  for (const p of payloads) {
    totals.totalComponentInstances += p.counts.totalComponentInstances;
    totals.lumiInstances += p.counts.lumiInstances;
    totals.ndsBeautyInstances += p.counts.ndsBeautyInstances;
    totals.ndsFashionInstances += p.counts.ndsFashionInstances;
    totals.legacyOtherInstances += p.counts.legacyOtherInstances;
    totals.detachedCandidates += p.counts.detachedCandidates;
    totals.customUiCandidates += p.counts.customUiCandidates;
    totals.textStyleUses += p.counts.textStyleUses;
    totals.paintStyleUses += p.counts.paintStyleUses;
    totals.lumiTextStyleUses += p.counts.lumiTextStyleUses;
    totals.lumiPaintStyleUses += p.counts.lumiPaintStyleUses;
    totals.variableTokenUses += p.counts.variableTokenUses;
    totals.lumiVariableTokenUses += p.counts.lumiVariableTokenUses;
    totals.tokenAdoptionSum += p.rates.tokenAdoptionRate;
    totals.styleAdoptionSum += p.rates.styleAdoptionRate;
  }

  const n = Math.max(payloads.length, 1);
  return {
    ...totals,
    tokenAdoptionRate: totals.tokenAdoptionSum / n,
    styleAdoptionRate: totals.styleAdoptionSum / n,
  };
}

function aggregateFromSnapshots(scans: LumiScanSnapshot[]): AggregateInput {
  const totals = {
    totalComponentInstances: 0,
    lumiInstances: 0,
    ndsBeautyInstances: 0,
    ndsFashionInstances: 0,
    legacyOtherInstances: 0,
    detachedCandidates: 0,
    customUiCandidates: 0,
    customColors: 0,
    customTextStyles: 0,
    heavyOverrides: 0,
    textStyleUses: 0,
    paintStyleUses: 0,
    lumiTextStyleUses: 0,
    lumiPaintStyleUses: 0,
    variableTokenUses: 0,
    lumiVariableTokenUses: 0,
    tokenAdoptionSum: 0,
    styleAdoptionSum: 0,
  };

  for (const s of scans) {
    totals.totalComponentInstances += s.totalComponentInstances;
    totals.lumiInstances += s.lumiComponentInstances;
    totals.detachedCandidates += s.detachedCandidates;
    totals.customColors += s.customColors;
    totals.customTextStyles += s.customTextStyles;
    totals.heavyOverrides += s.heavyOverrides;
    totals.textStyleUses += s.textStyleUses;
    totals.paintStyleUses += s.paintStyleUses;
    totals.lumiTextStyleUses += s.lumiTextStyleUses;
    totals.lumiPaintStyleUses += s.lumiPaintStyleUses;
    totals.variableTokenUses += s.variableTokenUses;
    totals.lumiVariableTokenUses += s.variableTokenUses;
    totals.tokenAdoptionSum += s.tokenAdoptionRate;
    totals.styleAdoptionSum += s.styleAdoptionRate;
  }

  const n = Math.max(scans.length, 1);
  return {
    ...totals,
    tokenAdoptionRate: totals.tokenAdoptionSum / n,
    styleAdoptionRate: totals.styleAdoptionSum / n,
  };
}

function computeReworkSignalRate(input: AggregateInput, totalUiCandidates: number): number {
  if (totalUiCandidates <= 0) return 0;

  const detachedShare = safeRate(input.detachedCandidates, totalUiCandidates);
  const customUiShare = safeRate(input.customUiCandidates, totalUiCandidates);
  const styleDenom = input.textStyleUses + input.paintStyleUses + input.customColors;
  const customColorShare = safeRate(input.customColors, Math.max(styleDenom, 1));
  const customTextShare = safeRate(
    input.customTextStyles,
    Math.max(input.textStyleUses + input.customTextStyles, 1)
  );
  const overrideShare = safeRate(input.heavyOverrides, totalUiCandidates);

  return clamp(
    detachedShare * 0.3 +
      customUiShare * 0.25 +
      customColorShare * 0.15 +
      customTextShare * 0.15 +
      overrideShare * 0.15
  );
}

function computeRates(input: AggregateInput): {
  totals: LumiAdoptionAdminMetrics["totals"];
  rates: LumiAdoptionAdminMetrics["rates"];
  current: LumiCurrentMetrics;
  reworkLevel: "Low" | "Medium" | "High";
} {
  const legacyInstances =
    input.ndsBeautyInstances + input.ndsFashionInstances + input.legacyOtherInstances;

  const dsRelatedComponents =
    input.lumiInstances + legacyInstances + input.detachedCandidates;

  const styleEligibleNodes = Math.max(
    input.textStyleUses + input.paintStyleUses + input.customColors + input.customTextStyles,
    1
  );

  const customStyleIssues = input.customColors + input.customTextStyles;
  const totalUiCandidates = Math.max(
    input.totalComponentInstances +
      input.detachedCandidates +
      input.customUiCandidates +
      customStyleIssues,
    1
  );

  const lumiReuseRate = safeRate(input.lumiInstances, input.totalComponentInstances);
  const legacyUsageRate = safeRate(legacyInstances, input.totalComponentInstances);
  const customUsageRate = safeRate(
    input.customUiCandidates,
    input.totalComponentInstances + input.customUiCandidates
  );
  const detachmentRate = safeRate(input.detachedCandidates, dsRelatedComponents);
  const customStyleRate = safeRate(customStyleIssues, styleEligibleNodes);
  const designDebtRate = safeRate(
    legacyInstances + input.detachedCandidates + input.customUiCandidates + customStyleIssues,
    totalUiCandidates
  );

  const reworkSignalRate = computeReworkSignalRate(input, totalUiCandidates);

  const customUsageReductionScore = clamp(100 - customUsageRate);
  const lowDetachmentScore = clamp(100 - detachmentRate);
  const lowCustomStyleScore = clamp(100 - customStyleRate);
  const lowReworkScore = clamp(100 - reworkSignalRate);

  const lumiEfficiencyScore = clamp(
    0.3 * lumiReuseRate +
      0.2 * customUsageReductionScore +
      0.2 * lowDetachmentScore +
      0.15 * lowCustomStyleScore +
      0.15 * lowReworkScore
  );

  const totals: LumiAdoptionAdminMetrics["totals"] = {
    totalComponentInstances: input.totalComponentInstances,
    lumiInstances: input.lumiInstances,
    ndsBeautyInstances: input.ndsBeautyInstances,
    ndsFashionInstances: input.ndsFashionInstances,
    legacyOtherInstances: input.legacyOtherInstances,
    detachedCandidates: input.detachedCandidates,
    customUiCandidates: input.customUiCandidates,
    customColors: input.customColors,
    customTextStyles: input.customTextStyles,
    reworkSignals: Math.round(reworkSignalRate),
    styleEligibleNodes,
    totalUiCandidates,
    dsRelatedComponents,
  };

  const current: LumiCurrentMetrics = {
    customUsageRate,
    lumiReuseRate,
    detachmentRate,
    customStyleRate,
    reworkSignalRate,
    designDebtRate,
    tokenAdoptionRate: clamp(input.tokenAdoptionRate),
    styleAdoptionRate: clamp(input.styleAdoptionRate),
  };

  return {
    totals,
    rates: {
      lumiReuseRate,
      legacyUsageRate,
      customUsageRate,
      detachmentRate,
      customStyleRate,
      reworkSignalRate,
      designDebtRate,
      lumiEfficiencyScore,
      productivityGainScore: null,
    },
    current,
    reworkLevel: reworkLevelFromRate(reworkSignalRate),
  };
}

function deriveHistoricalBaseline(
  payloads: LumiAnalyticsScanPayload[]
): LumiLegacyBenchmarkMetrics | undefined {
  if (payloads.length < 2) return undefined;

  const historical = payloads.slice(0, -1);
  const agg = aggregateFromPayloads(historical);
  const computed = computeRates(agg);

  return {
    source: "legacy-average",
    customUsageRate: computed.current.customUsageRate,
    lumiReuseRate: computed.current.lumiReuseRate,
    detachmentRate: computed.current.detachmentRate,
    customStyleRate: computed.current.customStyleRate,
    reworkSignalRate: computed.current.reworkSignalRate,
    designDebtRate: computed.current.designDebtRate,
    tokenAdoptionRate: computed.current.tokenAdoptionRate,
    styleAdoptionRate: computed.current.styleAdoptionRate,
  };
}

function computeProductivityGainScore(
  current: LumiCurrentMetrics,
  previous: LumiLegacyBenchmarkMetrics
): number | null {
  const fields: Array<
    keyof Pick<
      LumiCurrentMetrics,
      | "customUsageRate"
      | "lumiReuseRate"
      | "detachmentRate"
      | "customStyleRate"
      | "reworkSignalRate"
    >
  > = [
    "customUsageRate",
    "lumiReuseRate",
    "detachmentRate",
    "customStyleRate",
    "reworkSignalRate",
  ];

  const deltas: number[] = [];
  for (const field of fields) {
    const prev = previous[field];
    const cur = current[field];
    if (prev === undefined || !Number.isFinite(prev) || !Number.isFinite(cur)) continue;

    if (field === "lumiReuseRate") {
      deltas.push(cur - prev);
    } else {
      deltas.push(prev - cur);
    }
  }

  if (deltas.length === 0) return null;
  const avgImprovement = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return clamp(50 + avgImprovement);
}

function factorStatus(
  improvement: number | undefined
): "improved" | "needs-monitoring" | "at-risk" | "neutral" | "positive" {
  if (improvement === undefined) return "neutral";
  if (improvement >= 5) return "improved";
  if (improvement <= -5) return "at-risk";
  if (improvement >= 0) return "positive";
  return "needs-monitoring";
}

function buildFactorContributors(
  current: LumiCurrentMetrics,
  previous?: LumiLegacyBenchmarkMetrics
): LumiAdoptionAdminMetrics["factorContributors"] {
  const factors = [
    {
      id: "custom-usage",
      label: "Decrease in custom usage",
      description: "Less custom UI means designers spend less time recreating patterns.",
      currentKey: "customUsageRate" as const,
      invertImprovement: true,
    },
    {
      id: "lumi-reuse",
      label: "Increase in LUMI reuse",
      description: "More reusable LUMI components means faster screen creation and better consistency.",
      currentKey: "lumiReuseRate" as const,
      invertImprovement: false,
    },
    {
      id: "detachment",
      label: "Lower detachment rate",
      description: "Fewer detached components means less manual maintenance and fewer update issues.",
      currentKey: "detachmentRate" as const,
      invertImprovement: true,
    },
    {
      id: "custom-styles",
      label: "Fewer custom styles",
      description: "Higher token/style usage improves design-dev consistency and reduces handoff cleanup.",
      currentKey: "customStyleRate" as const,
      invertImprovement: true,
    },
    {
      id: "rework",
      label: "Less rework",
      description: "Cleaner LUMI usage reduces review comments, design QA issues, and corrections.",
      currentKey: "reworkSignalRate" as const,
      invertImprovement: true,
    },
  ];

  return factors.map((f) => {
    const currentValue = current[f.currentKey];
    const previousValue = previous?.[f.currentKey];
    let improvement: number | undefined;
    if (previousValue !== undefined && Number.isFinite(previousValue)) {
      improvement = f.invertImprovement
        ? previousValue - currentValue
        : currentValue - previousValue;
    }

    const displayValue =
      f.id === "rework" ? reworkLevelFromRate(currentValue) : fmtPct(currentValue);

    return {
      id: f.id,
      label: f.label,
      description: f.description,
      currentValue,
      previousValue,
      improvement,
      status: factorStatus(improvement),
      displayValue,
      displayPrevious:
        previousValue !== undefined
          ? f.id === "rework"
            ? reworkLevelFromRate(previousValue)
            : fmtPct(previousValue)
          : undefined,
      displayImprovement:
        improvement !== undefined ? fmtPts(improvement) : undefined,
    };
  });
}

function buildComparisonRows(
  current: LumiCurrentMetrics,
  previous?: LumiLegacyBenchmarkMetrics,
  reworkLevel?: "Low" | "Medium" | "High"
): LumiAdoptionAdminMetrics["comparisonRows"] {
  const hasBaseline = !!previous;

  const rows: Array<{
    metric: string;
    key: keyof LumiCurrentMetrics;
    lowerIsBetter: boolean;
    isRework?: boolean;
  }> = [
    { metric: "Component reuse", key: "lumiReuseRate", lowerIsBetter: false },
    { metric: "Custom usage", key: "customUsageRate", lowerIsBetter: true },
    { metric: "Detachment rate", key: "detachmentRate", lowerIsBetter: true },
    { metric: "Custom styles", key: "customStyleRate", lowerIsBetter: true },
    { metric: "Rework signal", key: "reworkSignalRate", lowerIsBetter: true, isRework: true },
    { metric: "Design debt", key: "designDebtRate", lowerIsBetter: true },
    { metric: "Token adoption", key: "tokenAdoptionRate", lowerIsBetter: false },
    { metric: "Style adoption", key: "styleAdoptionRate", lowerIsBetter: false },
  ];

  return rows.map((row) => {
    const cur = current[row.key];
    const prev = previous?.[row.key];

    if (!hasBaseline || prev === undefined) {
      return {
        metric: row.metric,
        legacyLabel: "Baseline unavailable",
        lumiLabel: row.isRework ? (reworkLevel ?? reworkLevelFromRate(cur)) : fmtPct(cur),
        improvementLabel: "—",
        status: "baseline-unavailable" as const,
      };
    }

    const delta = row.lowerIsBetter ? prev - cur : cur - prev;
    const improved = delta >= 3;

    return {
      metric: row.metric,
      legacyLabel: row.isRework ? reworkLevelFromRate(prev) : fmtPct(prev),
      lumiLabel: row.isRework ? (reworkLevel ?? reworkLevelFromRate(cur)) : fmtPct(cur),
      improvementLabel: row.isRework
        ? delta >= 3
          ? "Reduced"
          : delta <= -3
            ? "Increased"
            : "Needs monitoring"
        : fmtPts(delta),
      status: improved ? ("improved" as const) : ("needs-monitoring" as const),
    };
  });
}

export function generateLumiEfficiencyInsights(metrics: LumiAdoptionAdminMetrics): string[] {
  const insights: string[] = [];
  const { rates, totals, comparison } = metrics;

  if (!metrics.hasScanData) {
    return ["Run a LUMI adoption scan to calculate LUMI efficiency."];
  }

  if (rates.lumiReuseRate >= 60) {
    insights.push("LUMI reuse is strong, which indicates less repeated UI creation.");
  } else if (rates.lumiReuseRate > 0) {
    insights.push("LUMI reuse has room to grow — promote high-frequency LUMI patterns in active flows.");
  }

  if (rates.customUsageRate > 20) {
    insights.push("Custom usage is still high. Review repeated custom patterns for potential LUMI components.");
  } else if (totals.customUiCandidates === 0) {
    insights.push("No custom UI detected in this scope.");
  }

  if (rates.detachmentRate > 15) {
    insights.push("Detachment rate is above target. Replace detached components with source LUMI instances.");
  } else if (totals.detachedCandidates === 0) {
    insights.push("No detached components detected.");
  }

  if (rates.customStyleRate < 20 && totals.customColors + totals.customTextStyles > 0) {
    insights.push("Custom style usage is reducing, improving consistency and handoff quality.");
  } else if (rates.customStyleRate >= 25) {
    insights.push("Custom style usage remains elevated — align colors and text to LUMI tokens.");
  }

  if (metrics.reworkLevel === "High") {
    insights.push("Rework signal is high because detached and custom UI usage are still present.");
  }

  if (rates.legacyUsageRate > 10) {
    insights.push(
      `Legacy design system usage is ${fmtPct(rates.legacyUsageRate)} — prioritize migration in high-traffic flows.`
    );
  }

  if (!comparison?.hasBaseline && metrics.hasClassificationData) {
    insights.push(
      "Legacy benchmark unavailable. Add NDS Beauty and NDS Fashion libraries and run more scans to compare LUMI efficiency against older design systems."
    );
  }

  if (rates.lumiEfficiencyScore >= 70) {
    insights.push("LUMI efficiency score indicates strong adoption with manageable design debt.");
  }

  return insights.slice(0, 5);
}

/** Build admin efficiency metrics directly from stored scan payloads (backend reports). */
export function computeLumiAdoptionAdminMetricsFromPayloads(
  payloads: LumiAnalyticsScanPayload[],
  registrySyncedAt: string | null = null
): LumiAdoptionAdminMetrics {
  if (payloads.length === 0) {
    return computeLumiAdoptionAdminMetrics([], registrySyncedAt);
  }

  const agg = aggregateFromPayloads(payloads);
  const computed = computeRates(agg);
  const previous = deriveHistoricalBaseline(payloads);
  const hasBaseline = !!previous;

  let productivityGainScore: number | null = null;
  if (previous) {
    productivityGainScore = computeProductivityGainScore(computed.current, previous);
  }
  computed.rates.productivityGainScore = productivityGainScore;

  const factorContributors = buildFactorContributors(computed.current, previous);
  const comparisonRows = buildComparisonRows(
    computed.current,
    previous,
    computed.reworkLevel
  );

  const metrics: LumiAdoptionAdminMetrics = {
    hasScanData: true,
    hasClassificationData: true,
    totals: computed.totals,
    rates: computed.rates,
    comparison: {
      previous,
      current: computed.current,
      hasBaseline,
    },
    factorContributors,
    comparisonRows,
    insights: [],
    reworkLevel: computed.reworkLevel,
    registrySyncedAt,
  };

  metrics.insights = generateLumiEfficiencyInsights(metrics);
  return metrics;
}

export function computeLumiAdoptionAdminMetrics(
  scans: LumiScanSnapshot[],
  registrySyncedAt: string | null = null
): LumiAdoptionAdminMetrics {
  const payloads = extractScanPayloads(scans);
  const hasClassificationData = payloads.length > 0;
  const hasScanData = scans.length > 0;

  if (!hasScanData) {
    return {
      hasScanData: false,
      hasClassificationData: false,
      totals: {
        totalComponentInstances: 0,
        lumiInstances: 0,
        ndsBeautyInstances: 0,
        ndsFashionInstances: 0,
        legacyOtherInstances: 0,
        detachedCandidates: 0,
        customUiCandidates: 0,
        customColors: 0,
        customTextStyles: 0,
        reworkSignals: 0,
        styleEligibleNodes: 0,
        totalUiCandidates: 0,
        dsRelatedComponents: 0,
      },
      rates: {
        lumiReuseRate: 0,
        legacyUsageRate: 0,
        customUsageRate: 0,
        detachmentRate: 0,
        customStyleRate: 0,
        reworkSignalRate: 0,
        designDebtRate: 0,
        lumiEfficiencyScore: 0,
        productivityGainScore: null,
      },
      factorContributors: [],
      comparisonRows: [],
      insights: ["Run a LUMI adoption scan to calculate LUMI efficiency."],
      reworkLevel: "Low",
      registrySyncedAt,
    };
  }

  const agg = hasClassificationData
    ? aggregateFromPayloads(payloads)
    : aggregateFromSnapshots(scans);

  agg.customColors = scans.reduce((a, s) => a + s.customColors, 0);
  agg.customTextStyles = scans.reduce((a, s) => a + s.customTextStyles, 0);
  agg.heavyOverrides = scans.reduce((a, s) => a + s.heavyOverrides, 0);

  if (!hasClassificationData) {
    agg.lumiInstances = scans.reduce((a, s) => a + s.lumiComponentInstances, 0);
    agg.totalComponentInstances = scans.reduce((a, s) => a + s.totalComponentInstances, 0);
  }

  const computed = computeRates(agg);
  const previous = hasClassificationData ? deriveHistoricalBaseline(payloads) : undefined;
  const hasBaseline = !!previous;

  let productivityGainScore: number | null = null;
  if (previous) {
    productivityGainScore = computeProductivityGainScore(computed.current, previous);
  }
  computed.rates.productivityGainScore = productivityGainScore;

  const factorContributors = buildFactorContributors(computed.current, previous);
  const comparisonRows = buildComparisonRows(
    computed.current,
    previous,
    computed.reworkLevel
  );

  const metrics: LumiAdoptionAdminMetrics = {
    hasScanData: true,
    hasClassificationData,
    totals: computed.totals,
    rates: computed.rates,
    comparison: {
      previous,
      current: computed.current,
      hasBaseline,
    },
    factorContributors,
    comparisonRows,
    insights: [],
    reworkLevel: computed.reworkLevel,
    registrySyncedAt,
  };

  metrics.insights = generateLumiEfficiencyInsights(metrics);
  return metrics;
}

export function exportLumiEfficiencyCsv(
  scans: LumiScanSnapshot[],
  registrySyncedAt: string | null = null
): string {
  const payloads = extractScanPayloads(scans);
  const headers = [
    "scan_id",
    "file_name",
    "page_name",
    "section_name",
    "frame_name",
    "lumi_reuse_rate",
    "legacy_usage_rate",
    "custom_usage_rate",
    "detachment_rate",
    "custom_style_rate",
    "rework_signal_rate",
    "design_debt_rate",
    "lumi_efficiency_score",
    "productivity_gain_score",
  ];

  const escape = (v: string | number | undefined | null): string => {
    if (v === undefined || v === null) return "";
    const s = String(v);
    return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows: string[][] = [];

  if (payloads.length > 0) {
    for (const p of payloads) {
      const m = computeLumiAdoptionAdminMetrics(
        scans.filter((s) => s.id === p.scanId),
        registrySyncedAt
      );
      rows.push([
        p.scanId,
        p.fileName,
        p.pageName ?? "",
        p.sectionName ?? "",
        p.frameName ?? "",
        m.rates.lumiReuseRate.toFixed(1),
        m.rates.legacyUsageRate.toFixed(1),
        m.rates.customUsageRate.toFixed(1),
        m.rates.detachmentRate.toFixed(1),
        m.rates.customStyleRate.toFixed(1),
        m.rates.reworkSignalRate.toFixed(1),
        m.rates.designDebtRate.toFixed(1),
        m.rates.lumiEfficiencyScore.toFixed(1),
        m.rates.productivityGainScore?.toFixed(1) ?? "",
      ]);
    }
  } else {
    for (const s of scans) {
      const m = computeLumiAdoptionAdminMetrics([s], registrySyncedAt);
      rows.push([
        s.id,
        s.fileName,
        s.pageName ?? "",
        "",
        s.rootNodeName ?? "",
        m.rates.lumiReuseRate.toFixed(1),
        m.rates.legacyUsageRate.toFixed(1),
        m.rates.customUsageRate.toFixed(1),
        m.rates.detachmentRate.toFixed(1),
        m.rates.customStyleRate.toFixed(1),
        m.rates.reworkSignalRate.toFixed(1),
        m.rates.designDebtRate.toFixed(1),
        m.rates.lumiEfficiencyScore.toFixed(1),
        m.rates.productivityGainScore?.toFixed(1) ?? "",
      ]);
    }
  }

  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}
