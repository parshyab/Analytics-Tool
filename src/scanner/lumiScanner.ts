import { FigmaCalculationsAdapter, collectPublishedLibraryData } from "../calculations/figmaCalculationsAdapter";
import { getBundledDesignSystemRegistry } from "../integrations/designSystems/registryCacheLoader";
import { buildLumiAnalyticsScanPayload } from "../integrations/designSystems/scanPayloadBuilder";
import type { LumiScanSnapshot, QualitySignal, WorkSession } from "../types";
import { getInstanceMainComponent } from "../scanner/componentResolver";
import {
  classifyInstanceNode,
  classifyNonInstanceNode,
  classifyStyleKey,
} from "./componentClassifier";
import { resolveScanRoot, traverseSubtree, getNodeLocation } from "./sectionTraversal";

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

export async function runLumiScan(
  session: WorkSession,
  lumiPrefix: string,
  apiToken?: string,
  teamId?: string
): Promise<LumiScanSnapshot> {
  const warnings: string[] = [];
  const { root, warnings: scopeWarnings } = await resolveScanRoot(session.scanScope);
  warnings.push(...scopeWarnings);

  const adapter = new FigmaCalculationsAdapter();

  if (apiToken && teamId) {
    adapter.setAPIToken(apiToken);
    try {
      await adapter.loadTeamLibraries(teamId);
    } catch {
      warnings.push("Could not load team libraries via API — using local scan.");
    }
  }

  const { components, styles, lumiComponentKeys } = await collectPublishedLibraryData(lumiPrefix);
  adapter.setLibraryData(components, styles);

  if (lumiComponentKeys.size === 0) {
    warnings.push("Connect LUMI library before calculating LUMI adoption.");
  }

  const location = getNodeLocation(root as SceneNode);
  const traversed = traverseSubtree(root);
  const registry = getBundledDesignSystemRegistry();
  const componentBreakdown: import("../backend/types/designSystemRegistry").ComponentClassificationResult[] =
    [];

  let totalComponentInstances = 0;
  let lumiComponentInstances = 0;
  const usageMap = new Map<
    string,
    {
      componentKey: string;
      componentName: string;
      componentSetName?: string;
      variantName?: string;
      instances: number;
      locations: LumiScanSnapshot["lumiComponentUsage"][0]["locations"];
    }
  >();

  let textStyleUses = 0;
  let lumiTextStyleUses = 0;
  let paintStyleUses = 0;
  let lumiPaintStyleUses = 0;
  let variableTokenUses = 0;
  let detachedCandidates = 0;
  let customColors = 0;
  let customTextStyles = 0;
  let heavyOverrides = 0;
  const qualitySignals: QualitySignal[] = [];

  const aggregates: import("figma-calculations").AggregateCounts[] = [];

  if (session.scanScope === "whole-file") {
    await figma.loadAllPagesAsync();
    for (const page of figma.root.children) {
      try {
        const result = await adapter.processTree(page);
        aggregates.push(result.aggregateCounts);
      } catch (e) {
        warnings.push(`Scan partial failure on page ${page.name}: ${String(e)}`);
      }
    }
  } else {
    try {
      const result = await adapter.processTree(root);
      aggregates.push(result.aggregateCounts);
    } catch (e) {
      warnings.push(`figma-calculations scan failed: ${String(e)}`);
    }
  }

  let nonLumiComponentInstances = 0;

  for (const { node, context } of traversed) {
    if (node.type === "INSTANCE") {
      totalComponentInstances++;
      const classified = await classifyInstanceNode(node, context, registry);
      componentBreakdown.push(classified);

      try {
        const main = await getInstanceMainComponent(node);
        if (!main) {
          detachedCandidates++;
          continue;
        }

        const key = main.key;
        const isLumi =
          classified.classification === "lumi" ||
          lumiComponentKeys.has(key) ||
          main.remote ||
          main.name.toUpperCase().startsWith(lumiPrefix.toUpperCase());

        if (isLumi) {
          lumiComponentInstances++;
          lumiComponentKeys.add(key);

          const existing = usageMap.get(key) ?? {
            componentKey: key,
            componentName: main.name,
            instances: 0,
            locations: [],
          };
          existing.instances++;
          if (existing.locations.length < 3) {
            existing.locations.push({
              nodeId: node.id,
              pageName: context.pageName,
              sectionName: context.sectionName,
              frameName: context.frameName,
              parentPath: context.parentPath,
            });
          }
          usageMap.set(key, existing);
        } else {
          nonLumiComponentInstances++;
        }

        if (node.detachedInfo?.type === "local") {
          detachedCandidates++;
        }
      } catch {
        detachedCandidates++;
      }
    } else {
      const nonInstance = classifyNonInstanceNode(node, context, registry);
      if (nonInstance) componentBreakdown.push(nonInstance);
    }

    if (node.type === "TEXT") {
      textStyleUses++;
      if (node.textStyleId && node.textStyleId !== figma.mixed) {
        const bucket = classifyStyleKey(node.textStyleId, registry);
        if (bucket === "lumi") lumiTextStyleUses++;
        else if (bucket === "legacy") {
          /* legacy counted via diff */
        } else lumiTextStyleUses++;
      } else {
        customTextStyles++;
      }
    }

    if ("fills" in node && Array.isArray(node.fills)) {
      const visibleFills = node.fills.filter(
        (f) => f.visible !== false && f.type === "SOLID"
      ) as SolidPaint[];
      if (visibleFills.length > 0) {
        paintStyleUses++;
        if ("fillStyleId" in node && node.fillStyleId && node.fillStyleId !== figma.mixed) {
          const bucket = classifyStyleKey(node.fillStyleId, registry);
          if (bucket === "lumi") lumiPaintStyleUses++;
          else if (bucket !== "legacy") lumiPaintStyleUses++;
        } else {
          customColors++;
        }
      }
    }

    if ("boundVariables" in node && node.boundVariables) {
      variableTokenUses++;
    }

    if (node.type === "INSTANCE" && node.overrides && node.overrides.length > 5) {
      heavyOverrides++;
    }
  }

  const adoptionOpts = {
    includeMatchingText: true,
    includePartialText: true,
    includePartialFills: true,
  };

  const textPct = aggregates.length
    ? adapter.getTextStylePercentage(aggregates, adoptionOpts)
    : { full: 0, partial: 0 };
  const fillPct = aggregates.length
    ? adapter.getFillStylePercent(aggregates, adoptionOpts)
    : { full: 0, partial: 0 };

  const textStyleAdoptionRate = clamp((textPct.full + textPct.partial) * 100);
  const colorStyleAdoptionRate = clamp((fillPct.full + fillPct.partial) * 100);
  const styleAdoptionRate = clamp((textStyleAdoptionRate + colorStyleAdoptionRate) / 2);

  const tokenDenominator = Math.max(1, traversed.length);
  const tokenAdoptionRate = clamp((variableTokenUses / tokenDenominator) * 100);

  const lumiAdoptionRate =
    totalComponentInstances > 0
      ? clamp((lumiComponentInstances / totalComponentInstances) * 100)
      : 0;

  if (nonLumiComponentInstances > 0) {
    qualitySignals.push({
      type: "non-lumi-component",
      count: nonLumiComponentInstances,
      severity: nonLumiComponentInstances > 20 ? "medium" : "low",
      message: `${nonLumiComponentInstances} non-LUMI component instances in scan scope`,
    });
  }

  if (detachedCandidates > 0) {
    qualitySignals.push({
      type: "detached-candidate",
      count: detachedCandidates,
      severity: detachedCandidates > 5 ? "high" : "medium",
      message: `${detachedCandidates} detached or unresolved component instances`,
    });
  }
  if (customColors > 0) {
    qualitySignals.push({
      type: "custom-color",
      count: customColors,
      severity: customColors > 10 ? "medium" : "low",
      message: `${customColors} nodes using custom colors instead of styles`,
    });
  }
  if (customTextStyles > 0) {
    qualitySignals.push({
      type: "missing-text-style",
      count: customTextStyles,
      severity: "medium",
      message: `${customTextStyles} text nodes without text styles`,
    });
  }

  const qualityScore = clamp(
    100 -
      detachedCandidates * 2 -
      customColors * 0.5 -
      customTextStyles * 0.5 -
      heavyOverrides * 1
  );

  const snapshotBase = {
    id: uid(),
    sessionId: session.id,
    scannedAt: new Date().toISOString(),
    scanScope: session.scanScope,
    fileName: session.fileName,
    pageName: location.pageName,
    rootNodeId: root.id,
    rootNodeName: root.name,
    rootNodeType: root.type,
    totalComponentInstances,
    lumiComponentInstances,
    nonLumiComponentInstances: totalComponentInstances - lumiComponentInstances,
    lumiAdoptionRate,
    uniqueLumiComponents: usageMap.size,
    lumiComponentKeys: [...lumiComponentKeys],
    lumiComponentUsage: [...usageMap.values()],
    tokenAdoptionRate,
    styleAdoptionRate,
    textStyleAdoptionRate,
    colorStyleAdoptionRate,
    textStyleUses,
    lumiTextStyleUses,
    paintStyleUses,
    lumiPaintStyleUses,
    variableTokenUses,
    detachedCandidates,
    customColors,
    customTextStyles,
    heavyOverrides,
    qualityScore,
    qualitySignals,
    figmaCalculationsRaw: {
      textStylePercent: textPct,
      fillStylePercent: fillPct,
    },
    scanWarnings: warnings,
  };

  const systemClassification = buildLumiAnalyticsScanPayload({
    snapshot: snapshotBase as LumiScanSnapshot,
    session,
    componentBreakdown,
    registry,
  });

  return {
    ...snapshotBase,
    systemClassification,
  };
}
