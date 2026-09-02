import { FigmaLibraryClient } from "../figma/figmaLibraryClient";
import type { DesignSystemRegistryRepository } from "../repositories/designSystemRegistryRepository";
import type {
  ComponentReplacementMapping,
  DesignSystemComponent,
  DesignSystemLibrary,
  DesignSystemLibraryType,
  DesignSystemStyle,
  DesignSystemVariable,
  DesignSystemVariableType,
} from "../types/designSystemRegistry";
import { normalizeDesignSystemName, uid } from "../types/designSystemRegistry";

export type LibrarySeed = {
  name: string;
  slug: string;
  type: DesignSystemLibraryType;
  status: DesignSystemLibrary["status"];
  figmaFileKey?: string;
  figmaTeamId?: string;
  description?: string;
};

function inferCategory(name: string): DesignSystemComponent["category"] {
  const n = name.toLowerCase();
  if (/button|btn/.test(n)) return "button";
  if (/input|field|textfield/.test(n)) return "input";
  if (/nav|tab|menu|header/.test(n)) return "navigation";
  if (/modal|dialog|drawer|sheet/.test(n)) return "modal";
  if (/card|tile/.test(n)) return "card";
  if (/form/.test(n)) return "form";
  if (/table|grid|list/.test(n)) return "table";
  if (/toast|alert|banner|feedback/.test(n)) return "feedback";
  if (/layout|container|section/.test(n)) return "layout";
  if (/icon/.test(n)) return "icon";
  return "other";
}

function mapStyleType(type: string): DesignSystemStyle["type"] {
  switch (type) {
    case "TEXT":
      return "text";
    case "FILL":
      return "paint";
    case "EFFECT":
      return "effect";
    case "GRID":
      return "grid";
    default:
      return "unknown";
  }
}

function mapVariableType(resolvedType: string): DesignSystemVariableType {
  switch (resolvedType?.toUpperCase()) {
    case "COLOR":
      return "color";
    case "FLOAT":
      return "number";
    case "STRING":
      return "string";
    case "BOOLEAN":
      return "boolean";
    default:
      return "unknown";
  }
}

export async function indexDesignSystemLibrary(
  repo: DesignSystemRegistryRepository,
  client: FigmaLibraryClient,
  seed: LibrarySeed
): Promise<{ libraryId: string; components: number; styles: number; variables: number }> {
  const now = new Date().toISOString();
  const existing = await repo.getLibraryBySlug(seed.slug);
  const libraryId = existing?.id ?? uid("lib");

  const library: DesignSystemLibrary = {
    id: libraryId,
    name: seed.name,
    slug: seed.slug,
    type: seed.type,
    status: seed.status,
    figmaFileKey: seed.figmaFileKey,
    figmaTeamId: seed.figmaTeamId,
    description: seed.description,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const runId = uid("run");
  await repo.saveIndexRun({
    id: runId,
    libraryId,
    startedAt: now,
    status: "running",
    componentsIndexed: 0,
    stylesIndexed: 0,
    variablesIndexed: 0,
  });

  await repo.upsertLibrary(library);

  if (!seed.figmaFileKey) {
    await repo.saveIndexRun({
      id: runId,
      libraryId,
      startedAt: now,
      finishedAt: new Date().toISOString(),
      status: "success",
      componentsIndexed: 0,
      stylesIndexed: 0,
      variablesIndexed: 0,
      errorMessage: "No figmaFileKey configured — library registered only.",
    });
    return { libraryId, components: 0, styles: 0, variables: 0 };
  }

  try {
    const [apiComponents, apiStyles, variableData] = await Promise.all([
      client.fetchFileComponents(seed.figmaFileKey),
      client.fetchFileStyles(seed.figmaFileKey),
      client.fetchFileVariables(seed.figmaFileKey),
    ]);

    const components: DesignSystemComponent[] = apiComponents.map((c) => {
      const variantParts = c.name.split("/").map((p) => p.trim());
      const variantName = variantParts.length > 1 ? variantParts.slice(1).join(" / ") : undefined;
      return {
        id: uid("cmp"),
        libraryId,
        figmaNodeId: c.node_id,
        figmaKey: c.key,
        name: c.name,
        normalizedName: normalizeDesignSystemName(c.name),
        componentSetName: c.containing_frame?.name,
        variantName,
        category: inferCategory(c.name),
        status: seed.status === "legacy" ? "legacy" : "active",
        createdAt: now,
        updatedAt: now,
      };
    });

    const styles: DesignSystemStyle[] = apiStyles.map((s) => ({
      id: uid("sty"),
      libraryId,
      figmaStyleKey: s.key,
      figmaStyleId: s.node_id,
      name: s.name,
      normalizedName: normalizeDesignSystemName(s.name),
      type: mapStyleType(s.style_type),
      status: seed.status === "legacy" ? "legacy" : "active",
      createdAt: now,
      updatedAt: now,
    }));

    const variables: DesignSystemVariable[] = variableData.variables.map((v) => ({
      id: uid("var"),
      libraryId,
      figmaVariableKey: v.key,
      figmaVariableId: v.id,
      name: v.name,
      normalizedName: normalizeDesignSystemName(v.name),
      collectionName: variableData.collections[v.variableCollectionId]?.name,
      type: mapVariableType(v.resolvedType),
      status: seed.status === "legacy" ? "legacy" : "active",
      createdAt: now,
      updatedAt: now,
    }));

    await repo.upsertComponents(components);
    await repo.upsertStyles(styles);
    await repo.upsertVariables(variables);

    const finishedAt = new Date().toISOString();
    await repo.upsertLibrary({ ...library, lastIndexedAt: finishedAt, updatedAt: finishedAt });
    await repo.saveIndexRun({
      id: runId,
      libraryId,
      startedAt: now,
      finishedAt,
      status: "success",
      componentsIndexed: components.length,
      stylesIndexed: styles.length,
      variablesIndexed: variables.length,
    });

    return {
      libraryId,
      components: components.length,
      styles: styles.length,
      variables: variables.length,
    };
  } catch (error) {
    await repo.saveIndexRun({
      id: runId,
      libraryId,
      startedAt: now,
      finishedAt: new Date().toISOString(),
      status: "failed",
      componentsIndexed: 0,
      stylesIndexed: 0,
      variablesIndexed: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function suggestReplacementMappings(
  repo: DesignSystemRegistryRepository
): Promise<ComponentReplacementMapping[]> {
  const libraries = await repo.getLibraries();
  const lumi = libraries.find((l) => l.type === "lumi");
  if (!lumi) return [];

  const lumiComponents = await repo.getComponents({ libraryId: lumi.id });
  const lumiByName = new Map(lumiComponents.map((c) => [c.normalizedName, c]));
  const mappings: ComponentReplacementMapping[] = [];
  const now = new Date().toISOString();

  for (const lib of libraries.filter((l) => l.type !== "lumi")) {
    const legacyComponents = await repo.getComponents({ libraryId: lib.id });
    for (const source of legacyComponents) {
      const target = lumiByName.get(source.normalizedName);
      if (!target) continue;
      mappings.push({
        id: uid("map"),
        sourceLibraryId: lib.id,
        sourceComponentKey: source.figmaKey,
        sourceComponentName: source.name,
        targetLibraryId: lumi.id,
        targetComponentKey: target.figmaKey,
        targetComponentName: target.name,
        confidence: "suggested",
        notes: `Matched by normalized name: ${source.normalizedName}`,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  await repo.upsertReplacementMappings(mappings);
  return mappings;
}
