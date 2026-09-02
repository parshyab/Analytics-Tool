import { createDefaultRepository } from "../repositories/jsonDesignSystemRegistryRepository";
import { createDefaultProductivityStore } from "../repositories/jsonProductivityStore";
import {
  buildLumiReport,
  reportSubject,
  type LumiReportBundle,
  type ReportPeriod,
} from "./lumiReportService";
import { sendReportEmail, type SendEmailResult } from "./emailTransport";

export async function loadAndBuildReport(period: ReportPeriod): Promise<LumiReportBundle> {
  const repo = createDefaultRepository();
  const productivity = createDefaultProductivityStore();
  const [results, scanPayloads] = await Promise.all([
    productivity.getResults(),
    repo.getScanPayloads(),
  ]);
  return buildLumiReport({ period, results, scanPayloads });
}

export async function runLumiReportJob(options: {
  period: ReportPeriod;
  dryRun?: boolean;
  /** Required — admin-selected recipients; never defaults to a fixed stakeholder list */
  recipients: string[];
}): Promise<{ bundle: LumiReportBundle; send: SendEmailResult; recipients: string[] }> {
  const bundle = await loadAndBuildReport(options.period);
  const recipients = options.recipients
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!recipients.length) {
    return {
      bundle,
      recipients: [],
      send: {
        ok: false,
        mode: "dry-run",
        error: "No recipients selected. Choose who to send to from the admin dropdown.",
      },
    };
  }

  const send = await sendReportEmail({
    to: recipients,
    subject: reportSubject(bundle),
    html: bundle.html,
    text: bundle.text,
    dryRun: options.dryRun,
    attachments: [
      {
        filename: `lumi-designers-${options.period}.csv`,
        content: bundle.designerCsv,
        contentType: "text/csv",
      },
      {
        filename: `lumi-adoption-scans-${options.period}.csv`,
        content: bundle.adoptionCsv,
        contentType: "text/csv",
      },
    ],
  });

  return { bundle, send, recipients };
}
