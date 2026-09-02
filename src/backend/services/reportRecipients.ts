/** Stakeholder emails available in the admin report recipient dropdown (not auto-sent). */
export const DEFAULT_REPORT_RECIPIENT_OPTIONS = [
  "sudhakar.pandey@nykaa.com",
  "vipul.gupta@nykaa.com",
  "jay.hasija@nykaa.com",
  "rajesh@nykaa.com",
  "parshyajyoti.bora@nykaa.com",
] as const;

export function parseEmailList(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function readProcessEnv(key: string): string {
  try {
    if (typeof process === "undefined" || !process.env) return "";
    return process.env[key] ?? "";
  } catch {
    return "";
  }
}

/**
 * Catalog for the admin UI dropdown.
 * Env: LUMI_REPORT_RECIPIENT_OPTIONS (preferred).
 * Never treated as an automatic send list.
 */
export function resolveReportRecipientOptions(envValue?: string): string[] {
  const fromArg = parseEmailList(envValue);
  if (fromArg.length > 0) return fromArg;

  const fromEnv = parseEmailList(
    readProcessEnv("LUMI_REPORT_RECIPIENT_OPTIONS") || readProcessEnv("LUMI_REPORT_EMAILS")
  );
  if (fromEnv.length > 0) return fromEnv;

  return [...DEFAULT_REPORT_RECIPIENT_OPTIONS];
}
