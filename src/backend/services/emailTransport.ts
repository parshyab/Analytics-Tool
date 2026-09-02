import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { parseEmailList } from "./reportRecipients";

export type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

export type SendEmailInput = {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  /** true = save files only; false = send SMTP; undefined = use LUMI_REPORT_DRY_RUN env */
  dryRun?: boolean;
};

export type SendEmailResult = {
  ok: boolean;
  mode: "smtp" | "dry-run";
  messageId?: string;
  outputPath?: string;
  error?: string;
};

export type SmtpStatus = {
  configured: boolean;
  hasCredentials: boolean;
  canSendLive: boolean;
  dryRunDefault: boolean;
  host: string | null;
  from: string | null;
  user: string | null;
};

/** Explicit dryRun=false always attempts live SMTP when configured. */
export function resolveReportDryRun(explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  return process.env.LUMI_REPORT_DRY_RUN === "true";
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.LUMI_SMTP_HOST?.trim() && process.env.LUMI_SMTP_FROM?.trim());
}

export function smtpHasCredentials(): boolean {
  return Boolean(process.env.LUMI_SMTP_USER?.trim() && process.env.LUMI_SMTP_PASS?.trim());
}

export function getSmtpStatus(): SmtpStatus {
  const configured = smtpConfigured();
  const hasCredentials = smtpHasCredentials();
  const dryRunDefault = process.env.LUMI_REPORT_DRY_RUN === "true";
  return {
    configured,
    hasCredentials,
    canSendLive: configured && hasCredentials,
    dryRunDefault,
    host: process.env.LUMI_SMTP_HOST?.trim() || null,
    from: process.env.LUMI_SMTP_FROM?.trim() || null,
    user: process.env.LUMI_SMTP_USER?.trim() || null,
  };
}

/** Explicit recipient list only — no default auto-send list. */
export function parseReportRecipients(envValue?: string): string[] {
  return parseEmailList(envValue);
}

function createSmtpTransporter(): Transporter {
  const port = Number(process.env.LUMI_SMTP_PORT ?? "587");
  const secure = process.env.LUMI_SMTP_SECURE === "true" || port === 465;
  return nodemailer.createTransport({
    host: process.env.LUMI_SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user: process.env.LUMI_SMTP_USER,
      pass: process.env.LUMI_SMTP_PASS,
    },
  });
}

export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  const status = getSmtpStatus();
  if (!status.canSendLive) {
    return {
      ok: false,
      error: status.configured
        ? "SMTP host/from set but LUMI_SMTP_USER and LUMI_SMTP_PASS are required."
        : "Set LUMI_SMTP_HOST, LUMI_SMTP_FROM, LUMI_SMTP_USER, and LUMI_SMTP_PASS in .env.",
    };
  }

  try {
    const transporter = createSmtpTransporter();
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function writeDryRunArtifacts(input: SendEmailInput): Promise<SendEmailResult> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.resolve(process.cwd(), "data/reports");
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, `lumi-report-${stamp}`);
  fs.writeFileSync(`${base}.html`, input.html, "utf8");
  if (input.text) fs.writeFileSync(`${base}.txt`, input.text, "utf8");
  for (const att of input.attachments ?? []) {
    fs.writeFileSync(`${base}-${att.filename}`, att.content, "utf8");
  }
  const meta = {
    to: input.to,
    subject: input.subject,
    dryRun: true,
    writtenAt: new Date().toISOString(),
  };
  fs.writeFileSync(`${base}.meta.json`, JSON.stringify(meta, null, 2), "utf8");
  return {
    ok: true,
    mode: "dry-run",
    outputPath: `${base}.html`,
  };
}

export async function sendReportEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!input.to.length) {
    return {
      ok: false,
      mode: "dry-run",
      error: "No recipients selected. Choose recipients in the admin Export tab or pass --to.",
    };
  }

  const dryRun = resolveReportDryRun(input.dryRun);

  if (dryRun) {
    return writeDryRunArtifacts(input);
  }

  const status = getSmtpStatus();
  if (!status.canSendLive) {
    return {
      ok: false,
      mode: "smtp",
      error: status.configured
        ? "SMTP credentials missing. Set LUMI_SMTP_USER and LUMI_SMTP_PASS (Google App Password) in .env, then restart npm run analytics-api."
        : "SMTP not configured. Set LUMI_SMTP_HOST, LUMI_SMTP_FROM, LUMI_SMTP_USER, and LUMI_SMTP_PASS in .env, then restart npm run analytics-api.",
    };
  }

  try {
    const transporter = createSmtpTransporter();
    await transporter.verify();

    const info = await transporter.sendMail({
      from: process.env.LUMI_SMTP_FROM,
      to: input.to.join(", "),
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: (input.attachments ?? []).map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? "text/csv",
      })),
    });

    return {
      ok: true,
      mode: "smtp",
      messageId: info.messageId,
    };
  } catch (error) {
    return {
      ok: false,
      mode: "smtp",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
