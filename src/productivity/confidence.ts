import type {
  LumiScanSnapshot,
  ProductivityBenchmark,
  ProductivityConfidence,
  LegacyScanScope,
  ScanScope,
  WorkSession,
} from "../types";
import { normalizeScanScope } from "../types";

type ConfidenceInput = {
  session: WorkSession;
  scan: LumiScanSnapshot;
  benchmark: ProductivityBenchmark;
  actualMinutesConfirmed: boolean;
};

export function computeProductivityConfidence(input: ConfidenceInput): ProductivityConfidence {
  const { session, scan, benchmark, actualMinutesConfirmed } = input;
  const reasons: string[] = [];
  let score = 0;

  if (session.status === "finished") {
    score += 25;
    reasons.push("Session completed (+25)");
  }

  if (actualMinutesConfirmed) {
    score += 15;
    reasons.push("Actual minutes confirmed by designer (+15)");
  }

  if (scan.totalComponentInstances >= 0) {
    score += 20;
    reasons.push("LUMI scan completed (+20)");
  }

  switch (benchmark.confidence) {
    case "high":
      score += 25;
      reasons.push("Benchmark high confidence (+25)");
      break;
    case "medium":
      score += 15;
      reasons.push("Benchmark medium confidence (+15)");
      break;
    case "low":
      score += 8;
      reasons.push("Benchmark low confidence (+8)");
      break;
    case "unavailable":
      reasons.push("Benchmark unavailable — hours saved not calculated");
      return { label: "unavailable", score: 0, reasons };
  }

  score += scopeBonus(session.scanScope, reasons);

  const elapsed = session.adjustedActualMinutes ?? session.rawElapsedMinutes ?? 0;
  if (elapsed > 480 && session.adjustmentReason === "none") {
    score -= 15;
    reasons.push("Long unadjusted session (-15)");
  }

  const label = scoreToLabel(score);
  return { label, score: Math.max(0, score), reasons };
}

function scopeBonus(scope: ScanScope | LegacyScanScope, reasons: string[]): number {
  const normalized = normalizeScanScope(scope);
  if (normalized === "whole-file") {
    reasons.push("Whole file scan (+3)");
    return 3;
  }
  reasons.push("Specific scope selected (+10)");
  return 10;
}

function scoreToLabel(score: number): ProductivityConfidence["label"] {
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  if (score >= 35) return "low";
  return "directional";
}
