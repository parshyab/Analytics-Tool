import type {
  BenchmarkFilters,
  BenchmarkKey,
  BenchmarkLevel,
  ProductivityBenchmark,
  WorkSession,
} from "../types";

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function keysMatch(a: BenchmarkKey, b: BenchmarkKey, level: BenchmarkLevel): boolean {
  switch (level) {
    case "exact-match":
      return (
        a.projectName === b.projectName &&
        a.flowName === b.flowName &&
        a.workType === b.workType &&
        a.complexity === b.complexity &&
        (a.platform === b.platform || (!a.platform && !b.platform))
      );
    case "flow-match":
      return a.flowName === b.flowName && a.workType === b.workType && a.complexity === b.complexity;
    case "worktype-match":
      return a.workType === b.workType && a.complexity === b.complexity;
    case "complexity-match":
      return a.complexity === b.complexity;
    default:
      return false;
  }
}

function confidenceFromSampleSize(n: number): ProductivityBenchmark["confidence"] {
  if (n >= 10) return "high";
  if (n >= 5) return "medium";
  if (n >= 2) return "low";
  return "unavailable";
}

export function buildBenchmarkFromSessions(
  key: BenchmarkKey,
  sessions: WorkSession[],
  level: BenchmarkLevel
): ProductivityBenchmark | null {
  const minutes = sessions
    .filter((s) => s.status === "finished" && s.adjustedActualMinutes)
    .map((s) => s.adjustedActualMinutes as number);

  if (minutes.length < 2) return null;

  return {
    id: uid(),
    key,
    benchmarkLevel: level,
    sampleSize: minutes.length,
    medianMinutes: median(minutes),
    averageMinutes: average(minutes),
    p25Minutes: percentile(minutes, 25),
    p75Minutes: percentile(minutes, 75),
    source: "work-sessions",
    confidence: confidenceFromSampleSize(minutes.length),
    createdFromSessionIds: sessions.map((s) => s.id),
    updatedAt: new Date().toISOString(),
  };
}

export function findBestBenchmark(
  key: BenchmarkKey,
  finishedSessions: WorkSession[],
  manualBenchmarks: ProductivityBenchmark[]
): ProductivityBenchmark {
  const levels: BenchmarkLevel[] = [
    "exact-match",
    "flow-match",
    "worktype-match",
    "complexity-match",
  ];

  for (const level of levels) {
    const matching = finishedSessions.filter((s) => {
      if (s.status !== "finished" || !s.adjustedActualMinutes) return false;
      return keysMatch(
        {
          projectName: s.projectName,
          flowName: s.flowName,
          workType: s.workType,
          complexity: s.complexity,
          platform: s.platform,
        },
        key,
        level
      );
    });

    const built = buildBenchmarkFromSessions(key, matching, level);
    if (built) return built;
  }

  const manual = manualBenchmarks.find(
    (b) =>
      b.source === "manual-baseline" &&
      b.benchmarkLevel === "manual-baseline" &&
      keysMatch(b.key, key, "exact-match")
  );
  if (manual) return manual;

  return {
    id: uid(),
    key,
    benchmarkLevel: "unavailable",
    sampleSize: 0,
    medianMinutes: 0,
    averageMinutes: 0,
    source: "work-sessions",
    confidence: "unavailable",
    createdFromSessionIds: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createManualBenchmark(
  key: BenchmarkKey,
  medianMinutes: number,
  sourceNote?: string,
  effectiveDate?: string
): ProductivityBenchmark {
  return {
    id: uid(),
    key,
    benchmarkLevel: "manual-baseline",
    sampleSize: 1,
    medianMinutes,
    averageMinutes: medianMinutes,
    source: "manual-baseline",
    confidence: "medium",
    createdFromSessionIds: [],
    sourceNote,
    effectiveDate,
    updatedAt: new Date().toISOString(),
  };
}

export function filterBenchmarks(
  benchmarks: ProductivityBenchmark[],
  filters: BenchmarkFilters
): ProductivityBenchmark[] {
  return benchmarks.filter((b) => {
    if (filters.projectName && b.key.projectName !== filters.projectName) return false;
    if (filters.flowName && b.key.flowName !== filters.flowName) return false;
    if (filters.workType && b.key.workType !== filters.workType) return false;
    if (filters.complexity && b.key.complexity !== filters.complexity) return false;
    return true;
  });
}
