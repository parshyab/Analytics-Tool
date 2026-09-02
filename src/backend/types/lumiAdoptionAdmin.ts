/** Admin-only LUMI Adoption efficiency metrics (LUMI vs older design systems). */

export type LumiLegacyBenchmarkMetrics = {
  source: "nds-beauty" | "nds-fashion" | "legacy-average" | "manual-baseline";
  customUsageRate?: number;
  lumiReuseRate?: number;
  detachmentRate?: number;
  customStyleRate?: number;
  reworkSignalRate?: number;
  designDebtRate?: number;
  tokenAdoptionRate?: number;
  styleAdoptionRate?: number;
};

export type LumiCurrentMetrics = {
  customUsageRate: number;
  lumiReuseRate: number;
  detachmentRate: number;
  customStyleRate: number;
  reworkSignalRate: number;
  designDebtRate: number;
  tokenAdoptionRate: number;
  styleAdoptionRate: number;
};

export type LumiAdoptionAdminMetrics = {
  hasScanData: boolean;
  hasClassificationData: boolean;
  totals: {
    totalComponentInstances: number;
    lumiInstances: number;
    ndsBeautyInstances: number;
    ndsFashionInstances: number;
    legacyOtherInstances: number;
    detachedCandidates: number;
    customUiCandidates: number;
    customColors: number;
    customTextStyles: number;
    reworkSignals: number;
    styleEligibleNodes: number;
    totalUiCandidates: number;
    dsRelatedComponents: number;
  };
  rates: {
    lumiReuseRate: number;
    legacyUsageRate: number;
    customUsageRate: number;
    detachmentRate: number;
    customStyleRate: number;
    reworkSignalRate: number;
    designDebtRate: number;
    lumiEfficiencyScore: number;
    productivityGainScore: number | null;
  };
  comparison?: {
    previous?: LumiLegacyBenchmarkMetrics;
    current: LumiCurrentMetrics;
    hasBaseline: boolean;
  };
  factorContributors: Array<{
    id: string;
    label: string;
    description: string;
    currentValue: number;
    previousValue?: number;
    improvement?: number;
    status: "improved" | "needs-monitoring" | "at-risk" | "neutral" | "positive";
    displayValue: string;
    displayPrevious?: string;
    displayImprovement?: string;
  }>;
  comparisonRows: Array<{
    metric: string;
    legacyLabel: string;
    lumiLabel: string;
    improvementLabel: string;
    status: "improved" | "needs-monitoring" | "baseline-unavailable" | "neutral";
  }>;
  insights: string[];
  reworkLevel: "Low" | "Medium" | "High";
  registrySyncedAt: string | null;
};
