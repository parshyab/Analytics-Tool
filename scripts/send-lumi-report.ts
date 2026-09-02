#!/usr/bin/env tsx
/**
 * Build and email (or dry-run) LUMI designer performance + adoption reports.
 *
 * Recipients are never implied — pass --to explicitly (or use the admin Export UI).
 *
 * Usage:
 *   npm run report:preview -- --period weekly
 *   npm run report:send -- --period weekly --to a@nykaa.com,b@nykaa.com
 *   npm run report:send -- --period monthly --to a@nykaa.com --dry-run
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import type { ReportPeriod } from "../src/backend/services/lumiReportService";
import { resolveReportDryRun } from "../src/backend/services/emailTransport";
import { loadAndBuildReport, runLumiReportJob } from "../src/backend/services/runLumiReportJob";
import { parseEmailList } from "../src/backend/services/reportRecipients";

function parseArgs(argv: string[]) {
  let period: ReportPeriod = "weekly";
  let dryRun = resolveReportDryRun();
  let previewOnly = false;
  let recipients: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--period" && argv[i + 1]) {
      const p = argv[++i] as ReportPeriod;
      if (p === "weekly" || p === "monthly" || p === "quarterly") period = p;
      else throw new Error(`Invalid --period ${p}. Use weekly|monthly|quarterly`);
    } else if (a === "--to" && argv[i + 1]) {
      recipients = parseEmailList(argv[++i]);
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--live") {
      dryRun = false;
    } else if (a === "--preview") {
      previewOnly = true;
      dryRun = true;
    } else if (a === "--help" || a === "-h") {
      console.log(
        `Usage: send-lumi-report --period weekly|monthly|quarterly --to email1,email2 [--dry-run] [--preview]`
      );
      process.exit(0);
    }
  }

  return { period, dryRun, previewOnly, recipients };
}

async function main() {
  const { period, dryRun, previewOnly, recipients } = parseArgs(process.argv.slice(2));

  if (previewOnly) {
    const bundle = await loadAndBuildReport(period);
    console.log(`Period: ${bundle.range.label} (${bundle.range.displayFrom} → ${bundle.range.displayTo})`);
    console.log(
      `Data: ${bundle.summary.designers} designers, ${bundle.summary.sessions} sessions, ${bundle.summary.scans} scans`
    );
    const dir = path.resolve(process.cwd(), "data/reports");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = `${period}-${bundle.range.displayFrom}_${bundle.range.displayTo}`;
    const htmlPath = path.join(dir, `preview-${stamp}.html`);
    const csvPath = path.join(dir, `preview-${stamp}-designers.csv`);
    fs.writeFileSync(htmlPath, bundle.html, "utf8");
    fs.writeFileSync(csvPath, bundle.designerCsv, "utf8");
    fs.writeFileSync(path.join(dir, `preview-${stamp}-adoption.csv`), bundle.adoptionCsv, "utf8");
    console.log(`Preview written:\n  ${htmlPath}\n  ${csvPath}`);
    return;
  }

  if (!recipients.length) {
    throw new Error(
      "No recipients selected. Pass --to email1,email2 or use Export → Send report in the plugin (admin dropdown)."
    );
  }

  const job = await runLumiReportJob({ period, dryRun, recipients });
  console.log(
    `Period: ${job.bundle.range.label} (${job.bundle.range.displayFrom} → ${job.bundle.range.displayTo})`
  );
  console.log(
    `Data: ${job.bundle.summary.designers} designers, ${job.bundle.summary.sessions} sessions, ${job.bundle.summary.scans} scans`
  );
  console.log(`Recipients: ${job.recipients.join(", ")}`);

  if (!job.send.ok) {
    console.error("Failed to send report:", job.send.error);
    process.exit(1);
  }

  if (job.send.mode === "dry-run") {
    console.log(`Dry-run OK — report saved to ${job.send.outputPath}`);
    console.log("Configure LUMI_SMTP_* and unset LUMI_REPORT_DRY_RUN to send email.");
  } else {
    console.log(`Email sent via SMTP (messageId: ${job.send.messageId ?? "n/a"})`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
