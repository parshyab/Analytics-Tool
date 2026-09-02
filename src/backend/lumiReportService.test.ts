import assert from "assert";
import {
  buildLumiReport,
  resolveReportRange,
  reportSubject,
} from "./services/lumiReportService";
import type { ProductivityResult } from "../types";
import type { LumiAnalyticsScanPayload } from "./types/designSystemRegistry";

function sampleResult(overrides: Partial<ProductivityResult> = {}): ProductivityResult {
  return {
    id: "r1",
    sessionId: "s1",
    designerUserId: "u1",
    designerName: "Alex Designer",
    teamName: "Beauty",
    actualMinutes: 90,
    observedHoursSaved: 1.5,
    lumiAttributedHoursSaved: 0.8,
    productivityLiftPercent: 20,
    lumiAdoptionRate: 72,
    tokenAdoptionRate: 60,
    styleAdoptionRate: 55,
    lumiComponentInstances: 12,
    uniqueLumiComponents: 8,
    detachedCandidates: 2,
    customColors: 1,
    qualityScore: 78,
    designSystemLeverageScore: 70,
    confidence: { label: "medium", score: 60, reasons: [] },
    confidenceNotes: [],
    createdAt: "2026-07-08T12:00:00.000Z",
    ...overrides,
  };
}

function samplePayload(overrides: Partial<LumiAnalyticsScanPayload> = {}): LumiAnalyticsScanPayload {
  return {
    scanId: "scan1",
    scannedAt: "2026-07-08T12:30:00.000Z",
    fileName: "Checkout",
    scanScope: "page",
    designerName: "Alex Designer",
    teamName: "Beauty",
    counts: {
      totalComponentInstances: 100,
      lumiInstances: 70,
      ndsBeautyInstances: 10,
      ndsFashionInstances: 5,
      legacyOtherInstances: 5,
      detachedCandidates: 5,
      customUiCandidates: 5,
      unknownInstances: 0,
      textStyleUses: 20,
      lumiTextStyleUses: 15,
      legacyTextStyleUses: 5,
      paintStyleUses: 20,
      lumiPaintStyleUses: 14,
      legacyPaintStyleUses: 6,
      variableTokenUses: 30,
      lumiVariableTokenUses: 22,
      legacyVariableTokenUses: 8,
    },
    rates: {
      lumiAdoptionRate: 70,
      legacyUsageRate: 20,
      ndsBeautyUsageRate: 10,
      ndsFashionUsageRate: 5,
      detachmentRate: 5,
      customUiRate: 5,
      designDebtRate: 25,
      migrationProgressRate: 70,
      tokenAdoptionRate: 73,
      styleAdoptionRate: 72,
      qualityScore: 80,
      lumiProductivityScore: 75,
    },
    componentBreakdown: [],
    ...overrides,
  };
}

function testWeeklyRange() {
  // Wednesday 15 Jul 2026 UTC → previous week Mon 6 – Sun 12 Jul
  const range = resolveReportRange("weekly", new Date("2026-07-15T10:00:00.000Z"));
  assert.strictEqual(range.displayFrom, "2026-07-06");
  assert.strictEqual(range.displayTo, "2026-07-12");
  assert.ok(range.label.includes("2026-07-06"));
}

function testMonthlyRange() {
  const range = resolveReportRange("monthly", new Date("2026-07-15T10:00:00.000Z"));
  assert.strictEqual(range.displayFrom, "2026-06-01");
  assert.strictEqual(range.displayTo, "2026-06-30");
}

function testQuarterlyRange() {
  const range = resolveReportRange("quarterly", new Date("2026-07-15T10:00:00.000Z"));
  assert.strictEqual(range.label, "Q2 2026");
  assert.strictEqual(range.displayFrom, "2026-04-01");
  assert.strictEqual(range.displayTo, "2026-06-30");
}

function testBuildReport() {
  const now = new Date("2026-07-15T10:00:00.000Z");
  const bundle = buildLumiReport({
    period: "weekly",
    results: [sampleResult()],
    scanPayloads: [samplePayload()],
    now,
  });

  assert.strictEqual(bundle.summary.designers, 1);
  assert.strictEqual(bundle.summary.sessions, 1);
  assert.strictEqual(bundle.summary.scans, 1);
  assert.ok(bundle.designers[0].insights.length > 0);
  assert.ok(bundle.html.includes("Alex Designer"));
  assert.ok(bundle.designerCsv.includes("Alex Designer"));
  assert.ok(reportSubject(bundle).includes("Weekly"));
  assert.ok(bundle.adminEfficiency);
  assert.ok((bundle.adminEfficiency?.lumiReuseRate ?? 0) > 0);
}

function testOutOfRangeExcluded() {
  const now = new Date("2026-07-15T10:00:00.000Z");
  const bundle = buildLumiReport({
    period: "weekly",
    results: [sampleResult({ createdAt: "2026-06-01T12:00:00.000Z" })],
    scanPayloads: [samplePayload({ scannedAt: "2026-06-01T12:00:00.000Z" })],
    now,
  });
  assert.strictEqual(bundle.summary.sessions, 0);
  assert.strictEqual(bundle.summary.scans, 0);
}

testWeeklyRange();
testMonthlyRange();
testQuarterlyRange();
testBuildReport();
testOutOfRangeExcluded();
console.log("lumiReportService.test.ts: all passed");
