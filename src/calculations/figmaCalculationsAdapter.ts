import { patchStyleLookup } from "./lookupPatch";
import { getInstanceMainComponent } from "../scanner/componentResolver";
import { safeFindInstancesFast } from "../scanner/safeNodeTraversal";
import type {
  AdoptionCalculationOptions,
  AggregateCounts,
  LintCheckPercent,
  ProcessedNodeTree,
  ProcessedPage,
} from "figma-calculations";

patchStyleLookup();

export type { AggregateCounts, ProcessedNodeTree, LintCheckPercent, ProcessedPage };

export class FigmaCalculationsAdapter {
  private calculator: import("figma-calculations").FigmaCalculator;

  constructor() {
    const { FigmaCalculator } = require("figma-calculations") as typeof import("figma-calculations");
    this.calculator = new FigmaCalculator();
  }

  getCalculator(): import("figma-calculations").FigmaCalculator {
    return this.calculator;
  }

  setAPIToken(token: string): void {
    this.calculator.setAPIToken(token);
  }

  async loadTeamLibraries(teamId: string): Promise<void> {
    await this.calculator.loadComponents(teamId);
    await this.calculator.loadStyles(teamId);
  }

  async loadFromFileKeys(fileKeys: string[]): Promise<void> {
    await this.calculator.loadComponentsFromFiles(fileKeys);
    await this.calculator.loadStylesFromFiles(fileKeys);
  }

  async loadLocalVariables(fileKey: string): Promise<void> {
    await this.calculator.loadLocalVariables(fileKey);
  }

  setLibraryData(
    components: import("figma-calculations").FigmaTeamComponent[],
    styles: import("figma-calculations").FigmaTeamStyle[]
  ): void {
    this.calculator.components = components;
    this.calculator.allStyles = styles;
  }

  getAllPages(): PageNode[] {
    return this.calculator.getAllPages();
  }

  async processTree(
    rootNode: BaseNode,
    opts?: import("figma-calculations").ProcessedNodeOptions
  ): Promise<ProcessedNodeTree> {
    try {
      return await this.calculator.processTree(rootNode, opts);
    } catch (error) {
      console.warn("[LUMI] figma-calculations processTree failed:", error);
      return {
        parentNode: { id: rootNode.id, name: rootNode.name },
        aggregateCounts: {
          totalNodes: 0,
          hiddenNodes: 0,
          ignoredNodes: 0,
          libraryNodes: 0,
          checks: {},
          compliance: {
            fills: { attached: 0, detached: 0, none: 0 },
            rounding: { attached: 0, detached: 0, none: 0 },
            spacing: { attached: 0, detached: 0, none: 0 },
            strokes: { attached: 0, detached: 0, none: 0 },
            text: { attached: 0, detached: 0, none: 0 },
          },
        },
      };
    }
  }

  getAdoptionPercent(
    aggregates: AggregateCounts[],
    opts?: AdoptionCalculationOptions
  ): number {
    return this.calculator.getAdoptionPercent(aggregates, opts);
  }

  getTextStylePercentage(
    aggregates: AggregateCounts[],
    opts?: AdoptionCalculationOptions
  ): LintCheckPercent {
    return this.calculator.getTextStylePercentage(aggregates, opts);
  }

  getFillStylePercent(
    aggregates: AggregateCounts[],
    opts?: AdoptionCalculationOptions
  ): LintCheckPercent {
    return this.calculator.getFillStylePercent(aggregates, opts);
  }

  getBreakDownByTeams(
    pages: ProcessedPage[],
    opts?: AdoptionCalculationOptions
  ) {
    return this.calculator.getBreakDownByTeams(pages, opts);
  }
}

/** Build style/component stubs from in-plugin library for figma-calculations. */
export async function collectPublishedLibraryData(
  lumiPrefix: string
): Promise<{
  components: import("figma-calculations").FigmaTeamComponent[];
  styles: import("figma-calculations").FigmaTeamStyle[];
  lumiComponentKeys: Set<string>;
}> {
  const components: import("figma-calculations").FigmaTeamComponent[] = [];
  const styles: import("figma-calculations").FigmaTeamStyle[] = [];
  const lumiComponentKeys = new Set<string>();
  const now = new Date().toISOString();

  await figma.loadAllPagesAsync();

  for (const page of figma.root.children) {
    try {
      await page.loadAsync();
    } catch {
      continue;
    }

    let instances: InstanceNode[];
    try {
      instances = safeFindInstancesFast(page);
    } catch {
      continue;
    }

    for (const instance of instances) {
      try {
        const main = await getInstanceMainComponent(instance);
        if (!main) continue;
        const key = main.key;
        if (components.some((c) => c.key === key)) continue;

        const name = main.name;
        const isLumi =
          main.remote ||
          name.toUpperCase().startsWith(lumiPrefix.toUpperCase()) ||
          name.includes("/");

        if (isLumi) {
          lumiComponentKeys.add(key);
          components.push({
            key,
            file_key: figma.fileKey ?? "",
            node_id: main.id,
            name,
            description: main.description ?? "",
            updated_at: now,
            created_at: now,
            containing_frame: { name: main.parent?.name ?? name },
          });
        }
      } catch {
        // missing main component
      }
    }
  }

  const paintStyles = await figma.getLocalPaintStylesAsync();
  const textStyles = await figma.getLocalTextStylesAsync();

  for (const s of [...paintStyles, ...textStyles]) {
    styles.push({
      key: s.key,
      file_key: figma.fileKey ?? "",
      node_id: s.id,
      name: s.name,
      description: s.description ?? "",
      updated_at: now,
      created_at: now,
      style_type: s.type === "PAINT" ? "FILL" : "TEXT",
      sort_position: "",
      nodeDetails: {},
    });
  }

  return { components, styles, lumiComponentKeys };
}
