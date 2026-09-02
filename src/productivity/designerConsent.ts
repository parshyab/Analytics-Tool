import type { DesignerProfile, ConsentMode } from "../types";
import { buildProfile } from "../types";

export {
  loadLumiConsent,
  saveLumiConsent,
  deleteLumiConsent,
  shouldShowConsent,
  canTrackSessions,
  buildLumiConsent,
} from "./consentStorage";

export { buildProfile };

export function isDeclined(consent: { mode?: ConsentMode; consentMode?: ConsentMode } | null): boolean {
  return consent?.mode === "declined" || consent?.consentMode === "declined";
}
