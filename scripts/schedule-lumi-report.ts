#!/usr/bin/env tsx
/**
 * Local scheduled report sender — same period rules as GitHub Actions.
 * Use with cron, e.g. daily at 9:00 IST:
 *   0 9 * * * cd /path/to/Analytics && npm run report:schedule
 *
 * Recipients: LUMI_REPORT_EMAILS or LUMI_REPORT_RECIPIENT_OPTIONS in .env
 */
import "dotenv/config";
import { execSync } from "child_process";

function resolvePeriod(): { period: string; skip: boolean } {
  const now = new Date();
  const day = now.getUTCDate();
  const month = now.getUTCMonth() + 1;
  const dow = now.getUTCDay(); // 0 Sun … 6 Sat; Monday = 1

  if (day === 1 && [1, 4, 7, 10].includes(month)) {
    return { period: "quarterly", skip: false };
  }
  if (day === 1) {
    return { period: "monthly", skip: false };
  }
  if (dow === 1) {
    return { period: "weekly", skip: false };
  }
  return { period: "none", skip: true };
}

function resolveRecipients(): string {
  const raw =
    process.env.LUMI_REPORT_EMAILS?.trim() ||
    process.env.LUMI_REPORT_RECIPIENT_OPTIONS?.trim() ||
    "";
  if (!raw) {
    console.log("No LUMI_REPORT_EMAILS or LUMI_REPORT_RECIPIENT_OPTIONS — skipping.");
    process.exit(0);
  }
  return raw;
}

const { period, skip } = resolvePeriod();
if (skip) {
  console.log("No report period boundary today — nothing to send.");
  process.exit(0);
}

const recipients = resolveRecipients();
const dryRun = process.env.LUMI_REPORT_DRY_RUN === "true";

console.log(`Sending ${period} report to: ${recipients} (dryRun=${dryRun})`);

execSync(
  `npm run report:send -- --period ${period} --to "${recipients}"${dryRun ? " --dry-run" : " --live"}`,
  { stdio: "inherit", cwd: process.cwd() }
);
