type LookupFn = (
  checkName: string,
  stylesLookup: Record<string, Record<string, unknown>>,
  styleType: string,
  targetNode: unknown
) => { checkName: string; matchLevel: string; suggestions: unknown[] };

/**
 * figma-calculations crashes in lookup.ts when stylesLookup[styleType] is
 * undefined (common when a team has no published FILL styles). Patch the
 * lookup module before figma-calculations rules are loaded.
 */
export function patchStyleLookup(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lookupModule = require("figma-calculations/dist/rules/utils/styles/lookup") as {
    default: LookupFn;
  };

  const original = lookupModule.default;

  lookupModule.default = (checkName, stylesLookup, styleType, targetNode) => {
    const resolvedType = styleType === "STROKE" ? "FILL" : styleType;

    if (!stylesLookup[resolvedType]) {
      return { checkName, matchLevel: "None", suggestions: [] };
    }

    return original(checkName, stylesLookup, styleType, targetNode);
  };
}
