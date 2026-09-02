import type { DesignerProfile } from "../types";

export type LumiRole = "owner" | "designer";

declare const __LUMI_DEV_MODE__: boolean | undefined;

const DEV_MODE_STORAGE_KEY = "lumi.devMode.v1";
const LEGACY_OWNER_OVERRIDE_KEY = "lumi.access.devOwnerOverride.v1";

const DEFAULT_OWNER_EMAILS = ["parshyajyoti.bora@nykaa.com"];

function normalizeEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const trimmed = email.trim().toLowerCase();
  return trimmed || undefined;
}

function isBuildDevModeEnabled(): boolean {
  try {
    return __LUMI_DEV_MODE__ === true;
  } catch {
    return false;
  }
}

async function loadStoredDevMode(): Promise<boolean> {
  const stored = await figma.clientStorage.getAsync(DEV_MODE_STORAGE_KEY);
  if (stored === true) return true;
  const legacy = await figma.clientStorage.getAsync(LEGACY_OWNER_OVERRIDE_KEY);
  return legacy === true;
}

export async function isDevModeEnabled(): Promise<boolean> {
  if (isBuildDevModeEnabled()) return true;
  return loadStoredDevMode();
}

export async function setDevModeEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await figma.clientStorage.setAsync(DEV_MODE_STORAGE_KEY, true);
  } else {
    await figma.clientStorage.deleteAsync(DEV_MODE_STORAGE_KEY);
    await figma.clientStorage.deleteAsync(LEGACY_OWNER_OVERRIDE_KEY);
  }
}

export function canShowDeveloperTools(input?: {
  devModeEnabled?: boolean;
  email?: string;
}): boolean {
  if (input?.devModeEnabled) return true;
  if (isBuildDevModeEnabled()) return true;
  const email = normalizeEmail(input?.email);
  if (email && DEFAULT_OWNER_EMAILS.some((o) => o.toLowerCase() === email)) {
    return true;
  }
  return false;
}

export async function resolveCurrentLumiRole(input?: {
  profile?: DesignerProfile | null;
  consentEmail?: string;
  devModeEnabled?: boolean;
}): Promise<{
  role: LumiRole;
  reason: string;
  userEmail?: string;
  userName?: string;
  devModeEnabled: boolean;
}> {
  const devModeEnabled = input?.devModeEnabled ?? (await isDevModeEnabled());
  const userName = input?.profile?.name ?? figma.currentUser?.name;
  const figmaEmail = normalizeEmail((figma.currentUser as { email?: string } | null)?.email);
  const consentEmail = normalizeEmail(input?.consentEmail);
  const profileEmail = normalizeEmail(input?.profile?.email);
  const userEmail = profileEmail ?? consentEmail ?? figmaEmail;

  if (devModeEnabled) {
    return {
      role: "owner",
      reason: "Developer mode enabled",
      userEmail,
      userName,
      devModeEnabled: true,
    };
  }

  if (userEmail && DEFAULT_OWNER_EMAILS.some((o) => o.toLowerCase() === userEmail)) {
    return {
      role: "owner",
      reason: "Owner email match",
      userEmail,
      userName,
      devModeEnabled: false,
    };
  }

  return {
    role: "designer",
    reason: "Designer access",
    userEmail,
    userName,
    devModeEnabled: false,
  };
}
