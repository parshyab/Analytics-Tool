import type { LumiConsent, ConsentMode } from "../types";
import { STORAGE_KEYS, LUMI_CONSENT_VERSION } from "../types";

type LegacyConsent = {
  userId: string;
  consentGiven: boolean;
  consentMode: ConsentMode;
  consentGivenAt?: string;
  consentVersion: string;
};

async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await figma.clientStorage.getAsync(key);
  return (raw as T) ?? fallback;
}

async function setJson(key: string, value: unknown): Promise<void> {
  await figma.clientStorage.setAsync(key, value);
}

function migrateLegacyConsent(old: LegacyConsent): LumiConsent {
  const now = new Date().toISOString();
  return {
    consentVersion: LUMI_CONSENT_VERSION,
    consentGiven: old.consentGiven,
    mode: old.consentMode,
    userId: old.userId,
    consentGivenAt: old.consentGivenAt,
    updatedAt: now,
  };
}

export async function loadLumiConsent(): Promise<LumiConsent | null> {
  const current = await getJson<LumiConsent | null>(STORAGE_KEYS.consent, null);
  if (current?.consentVersion === LUMI_CONSENT_VERSION) {
    return current;
  }

  const legacy = await getJson<LegacyConsent | null>(STORAGE_KEYS.consentLegacy, null);
  if (legacy) {
    const migrated = migrateLegacyConsent(legacy);
    await saveLumiConsent(migrated);
    return migrated;
  }

  return current;
}

export async function saveLumiConsent(consent: LumiConsent): Promise<void> {
  await setJson(STORAGE_KEYS.consent, {
    ...consent,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteLumiConsent(): Promise<void> {
  await figma.clientStorage.setAsync(STORAGE_KEYS.consent, null);
  await figma.clientStorage.setAsync(STORAGE_KEYS.consentLegacy, null);
}

export function shouldShowConsent(consent: LumiConsent | null): boolean {
  if (!consent) return true;
  if (consent.consentVersion !== LUMI_CONSENT_VERSION) return true;
  if (consent.mode === "declined") return true;
  if (!consent.consentGiven) return true;
  return false;
}

export function canTrackSessions(consent: LumiConsent | null): boolean {
  if (!consent) return false;
  return consent.consentGiven && (consent.mode === "identified" || consent.mode === "anonymous");
}

export { buildLumiConsent } from "../types";
