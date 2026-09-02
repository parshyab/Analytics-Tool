import assert from "node:assert/strict";
import { computeBenchmarkRates } from "./services/benchmarkFormulas";
import { countClassifications } from "../scanner/componentClassifier";
import type { ComponentClassificationResult } from "./types/designSystemRegistry";
import { normalizeDesignSystemName } from "./types/designSystemRegistry";
import { createDefaultRepository } from "./repositories/jsonDesignSystemRegistryRepository";
import { createBenchmarkService } from "./services/designSystemBenchmarkService";

function testBenchmarkFormulas(): void {
  const rates = computeBenchmarkRates({
    totalComponentInstances: 100,
    lumiInstances: 78,
    ndsBeautyInstances: 12,
    ndsFashionInstances: 5,
    legacyOtherInstances: 3,
    detachedCandidates: 8,
    customUiCandidates: 4,
    unknownInstances: 2,
    textStyleUses: 50,
    lumiTextStyleUses: 40,
    legacyTextStyleUses: 10,
    paintStyleUses: 40,
    lumiPaintStyleUses: 30,
    legacyPaintStyleUses: 10,
    variableTokenUses: 20,
    lumiVariableTokenUses: 15,
    legacyVariableTokenUses: 5,
    qualityScore: 82,
  });

  assert.equal(rates.lumiAdoptionRate, 78);
  assert.equal(rates.legacyUsageRate, 20);
  assert.ok(Math.abs(rates.migrationProgressRate - 79.59) < 0.1);
  assert.ok(rates.designDebtRate > 0);
  assert.ok(rates.lumiProductivityScore >= 0 && rates.lumiProductivityScore <= 100);
}

function testZeroLegacyDenominator(): void {
  const rates = computeBenchmarkRates({
    totalComponentInstances: 10,
    lumiInstances: 10,
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
    qualityScore: 90,
  });

  assert.equal(rates.legacyUsageRate, 0);
  assert.equal(rates.migrationProgressRate, 100);
}

function testClassificationCounts(): void {
  const rows: ComponentClassificationResult[] = [
    { nodeId: "1", nodeName: "Lumi Btn", classification: "lumi", parentPath: [] },
    { nodeId: "2", nodeName: "NDS Btn", classification: "nds-beauty", parentPath: [] },
    { nodeId: "3", nodeName: "Detached", classification: "detached-candidate", parentPath: [] },
    { nodeId: "4", nodeName: "Custom", classification: "custom-ui", parentPath: [] },
  ];

  const counts = countClassifications(rows);
  assert.equal(counts.lumiInstances, 1);
  assert.equal(counts.ndsBeautyInstances, 1);
  assert.equal(counts.detachedCandidates, 1);
  assert.equal(counts.customUiCandidates, 1);
  assert.equal(counts.totalComponentInstances, 2);
}

function testNormalizedName(): void {
  assert.equal(normalizeDesignSystemName(" Button / Primary "), "button / primary");
}

function testNoTokenInRegistryCacheExport(): void {
  const repo = createDefaultRepository();
  const cache = repo.exportRegistryCache();
  const serialized = JSON.stringify(cache);
  assert.ok(!serialized.includes("FIGMA_API_TOKEN"));
  assert.ok(!serialized.includes("api_token"));
}

async function testRepositorySnapshotAsync(): Promise<void> {
  const repo = createDefaultRepository();
  const service = createBenchmarkService(repo);
  const rates = computeBenchmarkRates({
    totalComponentInstances: 4,
    lumiInstances: 2,
    ndsBeautyInstances: 1,
    ndsFashionInstances: 1,
    legacyOtherInstances: 0,
    detachedCandidates: 1,
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
    qualityScore: 80,
  });

  await service.ingestScanPayload({
    scanId: "scan-test-2",
    scannedAt: new Date().toISOString(),
    fileName: "Test File",
    scanScope: "page",
    counts: {
      totalComponentInstances: 4,
      lumiInstances: 2,
      ndsBeautyInstances: 1,
      ndsFashionInstances: 1,
      legacyOtherInstances: 0,
      detachedCandidates: 1,
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
    },
    rates,
    componentBreakdown: [],
  });

  const summary = await service.getLumiVsLegacySummary();
  assert.equal(summary.totals.scans, 1);
  assert.equal(summary.rates.lumiAdoptionRate, 50);
  assert.ok(summary.rates.migrationProgressRate > 0);
}

async function main(): Promise<void> {
  testBenchmarkFormulas();
  testZeroLegacyDenominator();
  testClassificationCounts();
  testNormalizedName();
  testNoTokenInRegistryCacheExport();
  await testRepositorySnapshotAsync();
  console.log("All design system benchmark acceptance tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
