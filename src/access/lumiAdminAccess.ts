import type { DesignerProfile } from "../types";

export type LumiRole = "admin" | "designer";

declare const __LUMI_ADMIN_EMAILS__: string | undefined;
declare const __LUMI_DEV_MODE__: boolean | undefined;

const FALLBACK_ADMIN_EMAILS = ["parshyajyoti.bora@nykaa.com"];

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

export function parseLumiAdminEmails(): string[] {
  try {
    if (typeof __LUMI_ADMIN_EMAILS__ === "string" && __LUMI_ADMIN_EMAILS__.trim()) {
      return __LUMI_ADMIN_EMAILS__
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    }
  } catch {
    /* bundled define may be absent in tests */
  }
  return FALLBACK_ADMIN_EMAILS.map((e) => e.toLowerCase());
}

export type LumiAccessUser = {
  email?: string;
  devModeEnabled?: boolean;
};

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return parseLumiAdminEmails().some((admin) => admin === normalized);
}

export function canViewLumiAdoptionAdminInsights(user?: LumiAccessUser): boolean {
  if (user?.devModeEnabled) return true;
  if (isBuildDevModeEnabled()) return true;
  return isAuthorizedAdminEmail(user?.email);
}

export function resolveLumiAccess(input?: {
  profile?: DesignerProfile | null;
  consentEmail?: string;
  devModeEnabled?: boolean;
  currentUserEmail?: string;
}): {
  role: LumiRole;
  canViewAdminInsights: boolean;
  reason: string;
  userEmail?: string;
} {
  const profileEmail = normalizeEmail(input?.profile?.email);
  const consentEmail = normalizeEmail(input?.consentEmail);
  const figmaEmail = normalizeEmail(input?.currentUserEmail);
  const userEmail = profileEmail ?? consentEmail ?? figmaEmail;
  const devModeEnabled = input?.devModeEnabled ?? false;

  if (canViewLumiAdoptionAdminInsights({ email: userEmail, devModeEnabled })) {
    return {
      role: "admin",
      canViewAdminInsights: true,
      reason: devModeEnabled
        ? "Developer mode enabled"
        : userEmail
          ? "Admin email match"
          : "Development override",
      userEmail,
    };
  }

  return {
    role: "designer",
    canViewAdminInsights: false,
    reason: userEmail ? "Designer access" : "No admin email — designer view",
    userEmail,
  };
}
