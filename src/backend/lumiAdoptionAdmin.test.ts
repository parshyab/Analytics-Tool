import assert from "node:assert/strict";
import {
  canViewLumiAdoptionAdminInsights,
  isAuthorizedAdminEmail,
  parseLumiAdminEmails,
  resolveLumiAccess,
} from "../access/lumiAdminAccess";
import {
  computeLumiAdoptionAdminMetrics,
  generateLumiEfficiencyInsights,
} from "../backend/services/lumiAdoptionAdminMetrics";
import type { LumiScanSnapshot } from "../types";
import type { LumiAnalyticsScanPayload } from "../backend/types/designSystemRegistry";

function makeScan(overrides: Partial<LumiScanSnapshot> = {}): LumiScanSnapshot {
  return {
    id: "scan-1",
    sessionId: "session-1",
    scannedAt: "2026-06-01T10:00:00.000Z",
    scanScope: "page",
    fileName: "Test File",
    pageName: "Home",
    totalComponentInstances: 100,
    lumiComponentInstances: 82,
    nonLumiComponentInstances: 18,
    lumiAdoptionRate: 82,
    uniqueLumiComponents: 12,
    lumiComponentKeys: [],
    lumiComponentUsage: [],
    tokenAdoptionRate: 70,
    styleAdoptionRate: 65,
    textStyleAdoptionRate: 60,
    colorStyleAdoptionRate: 55,
    textStyleUses: 50,
    lumiTextStyleUses: 40,
    paintStyleUses: 40,
    lumiPaintStyleUses: 30,
    variableTokenUses: 20,
    detachedCandidates: 9,
    customColors: 14,
    customTextStyles: 8,
    heavyOverrides: 3,
    qualityScore: 78,
    qualitySignals: [],
    scanWarnings: [],
    ...overrides,
  };
}

function makePayload(scanId: string, overrides: Partial<LumiAnalyticsScanPayload["counts"]> = {}): LumiAnalyticsScanPayload {
  const counts = {
    totalComponentInstances: 100,
    lumiInstances: 82,
    ndsBeautyInstances: 10,
    ndsFashionInstances: 5,
    legacyOtherInstances: 3,
    detachedCandidates: 9,
    customUiCandidates: 12,
    unknownInstances: 0,
    textStyleUses: 50,
    lumiTextStyleUses: 40,
    legacyTextStyleUses: 10,
    paintStyleUses: 40,
    lumiPaintStyleUses: 30,
    legacyPaintStyleUses: 10,
    variableTokenUses: 20,
    lumiVariableTokenUses: 15,
    legacyVariableTokenUses: 5,
    ...overrides,
  };

  return {
    scanId,
    scannedAt: "2026-06-01T10:00:00.000Z",
    fileName: "Test File",
    scanScope: "page",
    counts,
    rates: {
      lumiAdoptionRate: 82,
      legacyUsageRate: 18,
      ndsBeautyUsageRate: 10,
      ndsFashionUsageRate: 5,
      detachmentRate: 9,
      customUiRate: 12,
      designDebtRate: 24,
      migrationProgressRate: 82,
      tokenAdoptionRate: 75,
      styleAdoptionRate: 70,
      qualityScore: 78,
      lumiProductivityScore: 72,
    },
    componentBreakdown: [],
  };
}

function testAdminAccess(): void {
  assert.equal(
    canViewLumiAdoptionAdminInsights({ email: "designer@nykaa.com" }),
    false
  );
  assert.equal(
    canViewLumiAdoptionAdminInsights({ email: "parshyajyoti.bora@nykaa.com" }),
    true
  );
  assert.equal(canViewLumiAdoptionAdminInsights({ email: undefined }), false);
  assert.equal(canViewLumiAdoptionAdminInsights({ devModeEnabled: true }), true);
  assert.equal(isAuthorizedAdminEmail("parshyajyoti.bora@nykaa.com"), true);
  assert.equal(isAuthorizedAdminEmail("random@nykaa.com"), false);

  const designer = resolveLumiAccess({ consentEmail: "designer@nykaa.com" });
  assert.equal(designer.role, "designer");
  assert.equal(designer.canViewAdminInsights, false);

  const admin = resolveLumiAccess({ consentEmail: "parshyajyoti.bora@nykaa.com" });
  assert.equal(admin.role, "admin");
  assert.equal(admin.canViewAdminInsights, true);

  assert.ok(parseLumiAdminEmails().length >= 1);
}

function testMetricsFormulas(): void {
  const scan = makeScan({
    systemClassification: makePayload("scan-1"),
  });

  const metrics = computeLumiAdoptionAdminMetrics([scan]);
  assert.equal(metrics.hasScanData, true);
  assert.equal(metrics.rates.lumiReuseRate, 82);
  assert.equal(metrics.rates.legacyUsageRate, 18);
  assert.ok(Number.isFinite(metrics.rates.customUsageRate));
  assert.ok(Number.isFinite(metrics.rates.detachmentRate));
  assert.ok(Number.isFinite(metrics.rates.customStyleRate));
  assert.ok(metrics.rates.lumiEfficiencyScore >= 0 && metrics.rates.lumiEfficiencyScore <= 100);
  assert.ok(!Number.isNaN(metrics.rates.lumiEfficiencyScore));
  assert.equal(metrics.comparison?.hasBaseline, false);
  assert.equal(metrics.rates.productivityGainScore, null);
  assert.equal(metrics.factorContributors.length, 5);
  assert.equal(metrics.comparisonRows.length, 8);
}

function testBaselineFromHistoricalScans(): void {
  const scan1 = makeScan({
    id: "scan-1",
    scannedAt: "2026-05-01T10:00:00.000Z",
    systemClassification: makePayload("scan-1", {
      lumiInstances: 42,
      ndsBeautyInstances: 30,
      ndsFashionInstances: 10,
      legacyOtherInstances: 8,
      customUiCandidates: 31,
      detachedCandidates: 28,
    }),
  });
  const scan2 = makeScan({
    id: "scan-2",
    scannedAt: "2026-06-01T10:00:00.000Z",
    systemClassification: makePayload("scan-2", {
      lumiInstances: 82,
      ndsBeautyInstances: 10,
      ndsFashionInstances: 5,
      legacyOtherInstances: 3,
      customUiCandidates: 12,
      detachedCandidates: 9,
    }),
  });

  const metrics = computeLumiAdoptionAdminMetrics([scan1, scan2]);
  assert.equal(metrics.comparison?.hasBaseline, true);
  assert.ok(metrics.rates.productivityGainScore !== null);
  assert.ok(metrics.rates.productivityGainScore! >= 0 && metrics.rates.productivityGainScore! <= 100);
}

function testEmptyStates(): void {
  const empty = computeLumiAdoptionAdminMetrics([]);
  assert.equal(empty.hasScanData, false);
  assert.deepEqual(empty.insights, ["Run a LUMI adoption scan to calculate LUMI efficiency."]);

  const noDetach = computeLumiAdoptionAdminMetrics([
    makeScan({
      detachedCandidates: 0,
      systemClassification: makePayload("scan-1", { detachedCandidates: 0 }),
    }),
  ]);
  assert.ok(noDetach.insights.some((i) => i.includes("No detached components")));

  const insights = generateLumiEfficiencyInsights(noDetach);
  assert.ok(insights.length >= 1 && insights.length <= 5);
}

function testNoNaN(): void {
  const scan = makeScan({
    totalComponentInstances: 0,
    lumiComponentInstances: 0,
    detachedCandidates: 0,
    customColors: 0,
    customTextStyles: 0,
    systemClassification: makePayload("scan-1", {
      totalComponentInstances: 0,
      lumiInstances: 0,
      ndsBeautyInstances: 0,
      ndsFashionInstances: 0,
      legacyOtherInstances: 0,
      detachedCandidates: 0,
      customUiCandidates: 0,
    }),
  });

  const metrics = computeLumiAdoptionAdminMetrics([scan]);
  for (const value of Object.values(metrics.rates)) {
    if (value !== null) {
      assert.ok(Number.isFinite(value));
    }
  }
}

function main(): void {
  testAdminAccess();
  testMetricsFormulas();
  testBaselineFromHistoricalScans();
  testEmptyStates();
  testNoNaN();
  console.log("All LUMI adoption admin acceptance tests passed.");
}

main();
