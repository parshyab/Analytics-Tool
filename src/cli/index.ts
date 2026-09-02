import "dotenv/config";
import { patchStyleLookup } from "../calculations/lookupPatch";

patchStyleLookup();

async function loadFigmaCalculator() {
  const { FigmaCalculator } = await import("figma-calculations");
  return FigmaCalculator;
}

type ProcessedPage = import("figma-calculations").ProcessedPage;
type FigmaTeamComponent = import("figma-calculations").FigmaTeamComponent;
type FigmaTeamStyle = import("figma-calculations").FigmaTeamStyle;
type FigmaCalculator = import("figma-calculations").FigmaCalculator;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseCsv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function dedupeByKey<T extends { key: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    seen.set(item.key, item);
  }
  return [...seen.values()];
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

async function loadLibraryAssets(
  figmaCalculator: FigmaCalculator,
  fileKey: string,
  teamId: string | undefined,
  libraryFileIds: string[]
): Promise<{ styles: number; components: number }> {
  const fileKeys = [...new Set([fileKey, ...libraryFileIds])];

  let teamStyles: FigmaTeamStyle[] = [];
  let teamComponents: FigmaTeamComponent[] = [];

  if (teamId) {
    teamStyles = await figmaCalculator.loadStyles(teamId).catch(() => []);
    teamComponents = await figmaCalculator.loadComponents(teamId).catch(() => []);
  }

  const fileStyles = await figmaCalculator.loadStylesFromFiles(fileKeys);
  const fileComponents = await figmaCalculator.loadComponentsFromFiles(fileKeys);

  figmaCalculator.allStyles = dedupeByKey([...teamStyles, ...fileStyles]);
  figmaCalculator.components = dedupeByKey([...teamComponents, ...fileComponents]);

  return {
    styles: figmaCalculator.allStyles.length,
    components: figmaCalculator.components.length,
  };
}

async function analyzeFile(
  figmaCalculator: FigmaCalculator,
  file: { key: string; name: string; teamName?: string; projectName?: string },
  teamId: string | undefined,
  libraryFileIds: string[]
): Promise<ProcessedPage[]> {
  const figmaFile = await figmaCalculator.fetchCloudDocument(file.key);
  const documentName = figmaFile.name;

  console.log(`\nAnalyzing: ${documentName} (${file.key})`);

  const { styles, components } = await loadLibraryAssets(
    figmaCalculator,
    file.key,
    teamId,
    libraryFileIds
  );

  console.log(`  Loaded ${styles} styles and ${components} components`);

  const processedPages: ProcessedPage[] = [];

  for (const page of figmaCalculator.getAllPages()) {
    const result = await figmaCalculator.processTree(page, {
      onProcessNode: (node) => {
        for (const check of node.lintChecks) {
          if (check.checkName === "Text-Style" && check.matchLevel === "Partial") {
            console.log(`  Partial text style on "${node.name}":`, check.suggestions);
          }
        }
      },
    });

    processedPages.push({
      file: {
        key: file.key,
        name: documentName,
        thumbnail_url: "",
        last_modified: "",
        teamName: file.teamName,
        projectName: file.projectName,
      },
      pageName: page.name,
      pageAggregates: result.aggregateCounts,
    });
  }

  return processedPages;
}

async function main(): Promise<void> {
  const FigmaCalculator = await loadFigmaCalculator();

  const apiToken = requireEnv("FIGMA_API_TOKEN");
  const teamIds = parseCsv(process.env.FIGMA_TEAM_IDS);
  const libraryFileIds = parseCsv(process.env.FIGMA_LIBRARY_FILE_IDS);
  const singleFileId = process.env.FIGMA_FILE_ID?.trim();
  const weeksAgo = Number(process.env.FIGMA_WEEKS_AGO ?? "2");
  const teamId = teamIds[0];

  const figmaCalculator = new FigmaCalculator();
  figmaCalculator.setAPIToken(apiToken);

  let processedPages: ProcessedPage[] = [];

  if (singleFileId) {
    processedPages = await analyzeFile(
      figmaCalculator,
      { key: singleFileId, name: singleFileId },
      teamId,
      libraryFileIds.length > 0 ? libraryFileIds : [singleFileId]
    );
  } else {
    if (teamIds.length === 0) {
      throw new Error("Set FIGMA_TEAM_IDS or FIGMA_FILE_ID in your .env file");
    }

    const { files, counts } = await figmaCalculator.getFilesForTeams(teamIds, weeksAgo);

    console.log(
      `Found ${counts.recentlyModified} recently modified files (of ${counts.total} total)`
    );

    for (const file of files) {
      const pages = await analyzeFile(figmaCalculator, file, teamId, libraryFileIds);
      processedPages.push(...pages);
    }
  }

  if (processedPages.length === 0) {
    console.log("\nNo pages were processed.");
    return;
  }

  const allAggregates = processedPages.map((page) => page.pageAggregates);

  const adoptionOptions = {
    includeMatchingText: true,
    includePartialText: true,
    includePartialFills: true,
  };

  const totalAdoption = figmaCalculator.getAdoptionPercent(allAggregates, adoptionOptions);
  const textStylePercents = figmaCalculator.getTextStylePercentage(allAggregates, adoptionOptions);
  const fillStylePercents = figmaCalculator.getFillStylePercent(allAggregates, adoptionOptions);
  const teamBreakdown = figmaCalculator.getBreakDownByTeams(processedPages, adoptionOptions);

  console.log("\n=== Design System Adoption Summary ===");
  console.log(`Overall adoption: ${formatPercent(totalAdoption)}`);
  console.log(
    `Text styles — full: ${formatPercent(textStylePercents.full)}, partial: ${formatPercent(textStylePercents.partial)}`
  );
  console.log(
    `Fill styles — full: ${formatPercent(fillStylePercents.full)}, partial: ${formatPercent(fillStylePercents.partial)}`
  );

  console.log("\n=== Team Breakdown ===");
  for (const [teamName, stats] of Object.entries(teamBreakdown.teams)) {
    console.log(`${teamName}: ${formatPercent(stats.adoptionPercent)} adoption`);
  }

  console.log("\n=== Totals ===");
  console.log(JSON.stringify(teamBreakdown.totals, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
