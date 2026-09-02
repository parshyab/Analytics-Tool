import type {
  LumiScanSnapshot,
  ProductivityBenchmark,
  ProductivityResult,
  WorkSession,
} from "../types";
import { computeProductivityConfidence } from "./confidence";

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

export function calculateProductivity(
  session: WorkSession,
  scan: LumiScanSnapshot,
  benchmark: ProductivityBenchmark
): ProductivityResult {
  const actualMinutes =
    session.adjustedActualMinutes ??
    session.rawElapsedMinutes ??
    0;

  const benchmarkAvailable = benchmark.benchmarkLevel !== "unavailable" && benchmark.medianMinutes > 0;

  let benchmarkMinutes: number | undefined;
  let observedMinutesSaved: number | undefined;
  let observedHoursSaved: number | undefined;
  let productivityLiftPercent: number | undefined;
  let rawTimeVarianceMinutes: number | undefined;
  let timeVariancePercent: number | undefined;
  let lumiAttributedHoursSaved: number | undefined;

  if (benchmarkAvailable) {
    benchmarkMinutes = benchmark.medianMinutes;
    observedMinutesSaved = benchmarkMinutes - actualMinutes;
    observedHoursSaved = Math.max(0, observedMinutesSaved) / 60;
    productivityLiftPercent =
      benchmarkMinutes > 0
        ? ((benchmarkMinutes - actualMinutes) / benchmarkMinutes) * 100
        : 0;
    rawTimeVarianceMinutes = observedMinutesSaved;
    timeVariancePercent = productivityLiftPercent;

    const lumiLeverageFactor =
      (0.45 * scan.lumiAdoptionRate +
        0.2 * scan.tokenAdoptionRate +
        0.15 * scan.styleAdoptionRate +
        0.2 * scan.qualityScore) /
      100;

    lumiAttributedHoursSaved = observedHoursSaved * lumiLeverageFactor;
  }

  const detachmentRate =
    scan.totalComponentInstances > 0
      ? (scan.detachedCandidates / scan.totalComponentInstances) * 100
      : 0;
  const lowDetachmentScore = clamp(100 - detachmentRate);

  const designSystemLeverageScore = clamp(
    0.35 * scan.lumiAdoptionRate +
      0.2 * scan.tokenAdoptionRate +
      0.15 * scan.styleAdoptionRate +
      0.15 * lowDetachmentScore +
      0.15 * scan.qualityScore
  );

  const componentsReusedPerHour =
    actualMinutes > 0 ? scan.lumiComponentInstances / (actualMinutes / 60) : undefined;

  const confidence = computeProductivityConfidence({
    session,
    scan,
    benchmark,
    actualMinutesConfirmed: session.adjustedActualMinutes !== undefined,
  });

  return {
    id: uid(),
    sessionId: session.id,
    designerUserId: session.designerUserId,
    designerName: session.designerName,
    teamName: session.teamName,
    projectName: session.projectName,
    jiraTicketId: session.jiraTicketId,
    jiraTicketUrl: session.jiraTicketUrl,
    flowName: session.flowName,
    workType: session.workType,
    complexity: session.complexity,
    actualMinutes,
    benchmark: benchmarkAvailable ? benchmark : undefined,
    benchmarkMinutes,
    observedMinutesSaved,
    observedHoursSaved,
    lumiAttributedHoursSaved,
    rawTimeVarianceMinutes,
    timeVariancePercent,
    productivityLiftPercent,
    lumiAdoptionRate: scan.lumiAdoptionRate,
    tokenAdoptionRate: scan.tokenAdoptionRate,
    styleAdoptionRate: scan.styleAdoptionRate,
    lumiComponentInstances: scan.lumiComponentInstances,
    uniqueLumiComponents: scan.uniqueLumiComponents,
    componentsReusedPerHour,
    detachedCandidates: scan.detachedCandidates,
    customColors: scan.customColors,
    qualityScore: scan.qualityScore,
    designSystemLeverageScore,
    confidence,
    confidenceNotes: confidence.reasons,
    createdAt: new Date().toISOString(),
  };
}

export function formatHoursSaved(result: ProductivityResult): string {
  if (result.observedHoursSaved === undefined) return "Benchmark unavailable";
  return `${result.observedHoursSaved.toFixed(1)}h observed`;
}

export function formatLumiAttributed(result: ProductivityResult): string {
  if (result.lumiAttributedHoursSaved === undefined) return "Benchmark unavailable";
  return `${result.lumiAttributedHoursSaved.toFixed(1)}h LUMI-attributed`;
}
