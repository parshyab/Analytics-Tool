import "dotenv/config";
import fs from "fs";
import path from "path";
import { FigmaLibraryClient } from "../src/backend/figma/figmaLibraryClient";
import { createDefaultRepository } from "../src/backend/repositories/jsonDesignSystemRegistryRepository";
import {
  indexDesignSystemLibrary,
  suggestReplacementMappings,
  type LibrarySeed,
} from "../src/backend/services/designSystemIndexer";
import type { DesignSystemLibraryType } from "../src/backend/types/designSystemRegistry";

type LegacyLibraryJson = {
  name: string;
  slug: string;
  type: DesignSystemLibraryType;
  status?: LibrarySeed["status"];
  figmaFileKey?: string;
  figmaTeamId?: string;
  description?: string;
};

function loadLibrarySeeds(): LibrarySeed[] {
  const teamIds = (process.env.FIGMA_TEAM_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const defaultTeamId = teamIds[0];

  const seeds: LibrarySeed[] = [
    {
      name: "LUMI Design System",
      slug: "lumi",
      type: "lumi",
      status: "active",
      figmaFileKey: process.env.LUMI_LIBRARY_FILE_KEY?.trim() || undefined,
      figmaTeamId: defaultTeamId,
      description: "Nykaa LUMI governed design system",
    },
    {
      name: "NDS Beauty",
      slug: "nds-beauty",
      type: "nds-beauty",
      status: "legacy",
      figmaFileKey: process.env.NDS_BEAUTY_LIBRARY_FILE_KEY?.trim() || undefined,
      figmaTeamId: defaultTeamId,
      description: "Legacy NDS Beauty design system",
    },
    {
      name: "NDS Fashion",
      slug: "nds-fashion",
      type: "nds-fashion",
      status: "legacy",
      figmaFileKey: process.env.NDS_FASHION_LIBRARY_FILE_KEY?.trim() || undefined,
      figmaTeamId: defaultTeamId,
      description: "Legacy NDS Fashion design system",
    },
  ];

  const legacyJson = process.env.LEGACY_DESIGN_SYSTEM_LIBRARIES_JSON?.trim();
  if (legacyJson) {
    try {
      const parsed = JSON.parse(legacyJson) as LegacyLibraryJson[];
      for (const item of parsed) {
        if (seeds.some((s) => s.slug === item.slug)) continue;
        seeds.push({
          name: item.name,
          slug: item.slug,
          type: item.type,
          status: item.status ?? "legacy",
          figmaFileKey: item.figmaFileKey,
          figmaTeamId: item.figmaTeamId ?? defaultTeamId,
          description: item.description,
        });
      }
    } catch (error) {
      console.warn("Could not parse LEGACY_DESIGN_SYSTEM_LIBRARIES_JSON:", error);
    }
  }

  return seeds;
}

async function main(): Promise<void> {
  const token = process.env.FIGMA_API_TOKEN?.trim();
  const seeds = loadLibrarySeeds();
  const repo = createDefaultRepository();
  const cacheOutput =
    process.env.DS_REGISTRY_CACHE_OUTPUT?.trim() || "src/generated/design-system-registry.json";

  console.log(`Indexing ${seeds.length} design system libraries…`);

  if (token) {
    const client = new FigmaLibraryClient(token);
    for (const seed of seeds) {
      try {
        const result = await indexDesignSystemLibrary(repo, client, seed);
        console.log(
          `✓ ${seed.name}: ${result.components} components, ${result.styles} styles, ${result.variables} variables`
        );
      } catch (error) {
        console.error(`✗ ${seed.name}:`, error instanceof Error ? error.message : error);
        await repo.upsertLibrary({
          id: `lib-${seed.slug}`,
          name: seed.name,
          slug: seed.slug,
          type: seed.type,
          status: seed.status,
          figmaFileKey: seed.figmaFileKey,
          figmaTeamId: seed.figmaTeamId,
          description: seed.description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } else {
    console.warn("FIGMA_API_TOKEN not set — registering library metadata only (no Figma fetch).");
    const now = new Date().toISOString();
    for (const seed of seeds) {
      await repo.upsertLibrary({
        id: `lib-${seed.slug}`,
        name: seed.name,
        slug: seed.slug,
        type: seed.type,
        status: seed.status,
        figmaFileKey: seed.figmaFileKey,
        figmaTeamId: seed.figmaTeamId,
        description: seed.description,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const mappings = await suggestReplacementMappings(repo);
  console.log(`Suggested ${mappings.length} LUMI replacement mappings.`);

  const cache = repo.exportRegistryCache();
  const outPath = path.resolve(cacheOutput);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(cache, null, 2));
  console.log(`✓ Wrote plugin cache → ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
