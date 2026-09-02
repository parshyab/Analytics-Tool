import assert from "node:assert/strict";
import { compactScanSnapshotForStorage } from "../productivity/scanStorage";
import type { LumiScanSnapshot } from "../types";

function makeHeavyScan(): LumiScanSnapshot {
  const breakdown = Array.from({ length: 5000 }, (_, i) => ({
    nodeId: `node-${i}`,
    nodeName: `Component ${i}`,
    classification: "lumi" as const,
    parentPath: [`Page`, `Frame`, `Section ${i}`],
  }));

  const qualitySignals = Array.from({ length: 3000 }, (_, i) => ({
    type: "non-lumi-component",
    count: 1,
    severity: "low" as const,
    message: `Non-LUMI ${i}`,
  }));

  const usage = Array.from({ length: 200 }, (_, i) => ({
    componentKey: `key-${i}`,
    componentName: `Button ${i}`,
    instances: 50,
    locations: Array.from({ length: 50 }, (_, j) => ({
      nodeId: `loc-${i}-${j}`,
      pageName: "Home",
      frameName: `Frame ${j}`,
    })),
  }));

  return {
    id: "scan-heavy",
    sessionId: "session-heavy",
    scannedAt: "2026-06-01T10:00:00.000Z",
    scanScope: "whole-file",
    fileName: "Big File",
    totalComponentInstances: 5000,
    lumiComponentInstances: 4000,
    nonLumiComponentInstances: 1000,
    lumiAdoptionRate: 80,
    uniqueLumiComponents: 200,
    lumiComponentKeys: usage.map((u) => u.componentKey),
    lumiComponentUsage: usage,
    tokenAdoptionRate: 70,
    styleAdoptionRate: 65,
    textStyleAdoptionRate: 60,
    colorStyleAdoptionRate: 55,
    textStyleUses: 5000,
    lumiTextStyleUses: 4000,
    paintStyleUses: 4000,
    lumiPaintStyleUses: 3000,
    variableTokenUses: 500,
    detachedCandidates: 120,
    customColors: 80,
    customTextStyles: 40,
    heavyOverrides: 15,
    qualityScore: 72,
    qualitySignals,
    scanWarnings: [],
    figmaCalculationsRaw: {
      aggregates: [{ count: 99999 }],
      textStylePercent: { full: 0.6, partial: 0.1 },
      fillStylePercent: { full: 0.5, partial: 0.2 },
    },
    systemClassification: {
      scanId: "scan-heavy",
      scannedAt: "2026-06-01T10:00:00.000Z",
      fileName: "Big File",
      scanScope: "file",
      counts: {
        totalComponentInstances: 5000,
        lumiInstances: 4000,
        ndsBeautyInstances: 200,
        ndsFashionInstances: 100,
        legacyOtherInstances: 50,
        detachedCandidates: 120,
        customUiCandidates: 80,
        unknownInstances: 0,
        textStyleUses: 5000,
        lumiTextStyleUses: 4000,
        legacyTextStyleUses: 1000,
        paintStyleUses: 4000,
        lumiPaintStyleUses: 3000,
        legacyPaintStyleUses: 1000,
        variableTokenUses: 500,
        lumiVariableTokenUses: 400,
        legacyVariableTokenUses: 100,
      },
      rates: {
        lumiAdoptionRate: 80,
        legacyUsageRate: 7,
        ndsBeautyUsageRate: 4,
        ndsFashionUsageRate: 2,
        detachmentRate: 2,
        customUiRate: 1,
        designDebtRate: 10,
        migrationProgressRate: 92,
        tokenAdoptionRate: 80,
        styleAdoptionRate: 75,
        qualityScore: 72,
        lumiProductivityScore: 78,
      },
      componentBreakdown: breakdown,
    },
  };
}

function testCompactionShrinksPayload(): void {
  const heavy = makeHeavyScan();
  const before = JSON.stringify(heavy).length;
  const compact = compactScanSnapshotForStorage(heavy);
  const after = JSON.stringify(compact).length;

  assert.ok(after < before / 10, `Expected >90% reduction, got ${before} -> ${after}`);
  assert.equal(compact.systemClassification?.componentBreakdown.length, 0);
  assert.ok(compact.lumiComponentUsage.length <= 24);
  assert.ok(compact.qualitySignals.length <= 12);
  assert.equal((compact.figmaCalculationsRaw as { aggregates?: unknown }).aggregates, undefined);
  assert.equal(compact.lumiComponentUsage[0]?.locations.length, 2);
  assert.equal(compact.totalComponentInstances, 5000);
  assert.equal(compact.systemClassification?.counts.lumiInstances, 4000);
}

function testQualitySignalAggregation(): void {
  const heavy = makeHeavyScan();
  const compact = compactScanSnapshotForStorage(heavy);
  const nonLumi = compact.qualitySignals.find((s) => s.type === "non-lumi-component");
  assert.ok(nonLumi);
  assert.equal(nonLumi.count, 3000);
}

function main(): void {
  testCompactionShrinksPayload();
  testQualitySignalAggregation();
  console.log("All scan storage tests passed.");
}

main();
