#!/usr/bin/env tsx
/**
 * Verify SMTP settings and optionally send a test message.
 *
 * Usage:
 *   npm run report:test-smtp
 *   npm run report:test-smtp -- --to parshyajyoti.bora@nykaa.com
 */
import "dotenv/config";
import {
  getSmtpStatus,
  sendReportEmail,
  verifySmtpConnection,
} from "../src/backend/services/emailTransport";

function parseTo(argv: string[]): string[] {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--to" && argv[i + 1]) {
      return argv[++i]
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    }
  }
  const fromEnv = process.env.LUMI_ADMIN_EMAILS?.split(",")[0]?.trim().toLowerCase();
  return fromEnv ? [fromEnv] : [];
}

async function main() {
  const status = getSmtpStatus();
  console.log("SMTP status:");
  console.log(`  host:     ${status.host ?? "(not set)"}`);
  console.log(`  from:     ${status.from ?? "(not set)"}`);
  console.log(`  user:     ${status.user ?? "(not set)"}`);
  console.log(`  creds:    ${status.hasCredentials ? "yes" : "no"}`);
  console.log(`  dry-run:  ${status.dryRunDefault ? "default (env)" : "live send allowed"}`);

  const verify = await verifySmtpConnection();
  if (!verify.ok) {
    console.error("\nSMTP verify failed:", verify.error);
    console.error(
      "\nFor Google Workspace / Gmail: use smtp.gmail.com, your full @nykaa.com email as LUMI_SMTP_USER, and a Google App Password (not your login password) as LUMI_SMTP_PASS.\nCreate one at: https://myaccount.google.com/apppasswords"
    );
    process.exit(1);
  }

  console.log("\n✓ SMTP connection verified.");

  const recipients = parseTo(process.argv.slice(2));
  if (!recipients.length) {
    console.log("Pass --to your.email@nykaa.com to send a test message.");
    return;
  }

  const result = await sendReportEmail({
    to: recipients,
    subject: "LUMI Analytics — SMTP test",
    html: "<p>If you received this, LUMI report email is configured correctly.</p>",
    text: "If you received this, LUMI report email is configured correctly.",
    dryRun: false,
  });

  if (!result.ok) {
    console.error("\nTest send failed:", result.error);
    process.exit(1);
  }

  console.log(`\n✓ Test email sent to ${recipients.join(", ")} (messageId: ${result.messageId ?? "n/a"})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
