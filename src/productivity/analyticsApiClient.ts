import { extractScanPayloads } from "./dsBenchmarkLocal";
import { getAllScanSnapshotsFromStorage } from "./scanStorage";
import { workLogStore } from "./workLogStore";

export function normalizeApiBase(url: string): string {
  return url.replace(/\/+$/, "").replace(/\/\/127\.0\.0\.1/i, "//localhost");
}

/** Figma devAllowedDomains only permits localhost — normalize 127.0.0.1 to localhost. */
export function alternateApiBases(primary: string): string[] {
  const norm = normalizeApiBase(primary);
  return [norm];
}

function buildRequestHeaders(
  headers?: HeadersInit,
  ownerKey?: string
): Record<string, string> {
  const out: Record<string, string> = {};

  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    for (const [key, value] of Object.entries(headers as Record<string, string>)) {
      if (value != null) out[key] = String(value);
    }
  }

  if (ownerKey?.trim()) out["X-Owner-Key"] = ownerKey.trim();
  return out;
}

export async function fetchAnalyticsApi(
  primaryBase: string,
  path: string,
  options?: RequestInit,
  ownerKey?: string
): Promise<{ res: Response; baseUrl: string } | null> {
  const headers = buildRequestHeaders(options?.headers, ownerKey);
  for (const base of alternateApiBases(primaryBase)) {
    try {
      const res = await fetch(`${base}${path}`, { ...options, headers });
      return { res, baseUrl: base };
    } catch {
      continue;
    }
  }
  return null;
}

export async function checkAnalyticsApiHealth(
  primaryBase: string,
  ownerKey?: string
): Promise<{
  ok: boolean;
  baseUrl?: string;
  email?: {
    canSendLive: boolean;
    dryRunDefault: boolean;
    configured: boolean;
    hasCredentials: boolean;
    liveSendReady: boolean;
  };
}> {
  const result = await fetchAnalyticsApi(primaryBase, "/health", { method: "GET" }, ownerKey);
  if (!result) return { ok: false };
  try {
    const data = (await result.res.json()) as {
      ok?: boolean;
      email?: {
        canSendLive?: boolean;
        dryRunDefault?: boolean;
        configured?: boolean;
        hasCredentials?: boolean;
        liveSendReady?: boolean;
      };
    };
    return {
      ok: result.res.ok && data.ok !== false,
      baseUrl: result.baseUrl,
      email: data.email
        ? {
            canSendLive: Boolean(data.email.canSendLive),
            dryRunDefault: Boolean(data.email.dryRunDefault),
            configured: Boolean(data.email.configured),
            hasCredentials: Boolean(data.email.hasCredentials),
            liveSendReady: Boolean(data.email.liveSendReady),
          }
        : undefined,
    };
  } catch {
    return { ok: result.res.ok, baseUrl: result.baseUrl };
  }
}

export async function syncPluginDataToAnalyticsApi(
  primaryBase: string,
  ownerKey?: string
): Promise<{
  productivity: { synced: number; failed: number };
  scans: { synced: number; failed: number };
}> {
  const results = await workLogStore.getProductivityResults();
  const sessions = await workLogStore.getSessions();
  let productivitySynced = 0;
  let productivityFailed = 0;

  for (const result of results) {
    const session = sessions.find((s) => s.id === result.sessionId);
    const posted = await fetchAnalyticsApi(
      primaryBase,
      "/api/analytics/productivity",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, session }),
      },
      ownerKey
    );
    if (posted?.res.ok) productivitySynced += 1;
    else productivityFailed += 1;
  }

  const scans = await getAllScanSnapshotsFromStorage();
  const payloads = extractScanPayloads(scans);
  let scansSynced = 0;
  let scansFailed = 0;

  for (const payload of payloads) {
    const posted = await fetchAnalyticsApi(
      primaryBase,
      "/api/analytics/scans",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      ownerKey
    );
    if (posted?.res.ok) scansSynced += 1;
    else scansFailed += 1;
  }

  return {
    productivity: { synced: productivitySynced, failed: productivityFailed },
    scans: { synced: scansSynced, failed: scansFailed },
  };
}

export type SendLumiReportApiResponse = {
  ok?: boolean;
  send?: { ok?: boolean; mode?: "smtp" | "dry-run"; outputPath?: string; error?: string };
  error?: string;
};

export async function sendLumiReportViaApi(
  primaryBase: string,
  body: {
    period: "weekly" | "monthly" | "quarterly";
    recipients: string[];
    dryRun: boolean;
  },
  ownerKey?: string
): Promise<{ ok: boolean; data?: SendLumiReportApiResponse; status?: number; error?: string }> {
  const result = await fetchAnalyticsApi(
    primaryBase,
    "/api/analytics/reports/send",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    ownerKey
  );

  if (!result) {
    return { ok: false, error: "Could not reach analytics API" };
  }

  const data = (await result.res.json()) as SendLumiReportApiResponse;
  const sendOk = Boolean(result.res.ok && data.ok && data.send?.ok !== false);
  return {
    ok: sendOk,
    data,
    status: result.res.status,
    error: sendOk
      ? undefined
      : data.send?.error ?? data.error ?? `Send failed (HTTP ${result.res.status})`,
  };
}
