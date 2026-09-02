/** Patch figma-calculations lookup crash when FILL bucket is missing. */
export function patchStyleLookup(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lookupModule = require("figma-calculations/dist/rules/utils/styles/lookup") as {
    default: (
      checkName: string,
      stylesLookup: Record<string, Record<string, unknown>>,
      styleType: string,
      targetNode: unknown
    ) => { checkName: string; matchLevel: string; suggestions: unknown[] };
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
