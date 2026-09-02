import { useEffect, useState } from "react";
import type { MainMessage, PluginState } from "../../types";
import { DEFAULT_REPORT_RECIPIENT_OPTIONS } from "../../backend/services/reportRecipients";
import { PageSection, EmptyPanel } from "./PageLayout";
import { postMessage } from "../hooks";

type ExportItem = { id: string; label: string; format: string };

const EXPORT_GROUPS: { title: string; items: ExportItem[] }[] = [
  {
    title: "Productivity",
    items: [
      { id: "designer-productivity", label: "Designer productivity", format: "CSV" },
      { id: "work-sessions", label: "Work sessions", format: "CSV" },
      { id: "monthly-summary", label: "Monthly summary", format: "CSV" },
      { id: "benchmarks", label: "Benchmarks", format: "CSV" },
    ],
  },
  {
    title: "Jira",
    items: [
      { id: "jira-ticket-productivity", label: "Ticket productivity", format: "CSV" },
      { id: "designer-workload-summary", label: "Workload summary", format: "CSV" },
      { id: "designer-ticket-detail", label: "Ticket detail", format: "CSV" },
    ],
  },
  {
    title: "Admin",
    items: [{ id: "lumi-efficiency-vs-legacy", label: "LUMI vs legacy", format: "CSV" }],
  },
  {
    title: "Full archive",
    items: [{ id: "full-json", label: "Complete dataset", format: "JSON" }],
  },
];

type ReportPeriod = "weekly" | "monthly" | "quarterly";

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export function ExportTab({ state }: { state: PluginState }) {
  const [includeEmails, setIncludeEmails] = useState(state.settings.includeEmailInExport);
  const [period, setPeriod] = useState<ReportPeriod>("weekly");
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [sendStatus, setSendStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [sendMessage, setSendMessage] = useState("");
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [apiUrl, setApiUrl] = useState("");
  const [emailReady, setEmailReady] = useState(false);
  const [emailHint, setEmailHint] = useState("");

  const isAdmin =
    state.lumiAccess?.role === "admin" || state.lumiAccess?.canViewAdminInsights === true;

  const recipientOptions =
    state.reportRecipientOptions?.length
      ? state.reportRecipientOptions
      : [...DEFAULT_REPORT_RECIPIENT_OPTIONS];

  useEffect(() => {
    postMessage({ type: "CHECK_ANALYTICS_API" });
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage as MainMessage | undefined;
      if (msg?.type === "LUMI_REPORT_SEND_RESULT") {
        setSendStatus(msg.ok ? "success" : "error");
        setSendMessage(msg.message);
      }
      if (msg?.type === "ANALYTICS_API_STATUS") {
        setApiStatus(msg.ok ? "online" : "offline");
        setApiUrl(msg.url);
        setEmailReady(msg.emailReady === true);
        setEmailHint(msg.emailHint ?? "");
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!isAdmin) {
    return (
      <EmptyPanel
        icon="🔒"
        title="Admin only"
        body="Export reports are available to LUMI admins. Use Privacy to export or delete your personal local data."
      />
    );
  }

  const exportData = (type: string) => {
    postMessage({ type: "GET_EXPORT", exportType: type, includeEmails });
  };

  const addRecipient = () => {
    const email = selectedRecipient.trim().toLowerCase();
    if (!email || recipients.includes(email)) return;
    setRecipients([...recipients, email]);
    setSelectedRecipient("");
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const sendReport = (dryRun: boolean) => {
    if (!recipients.length) {
      setSendStatus("error");
      setSendMessage("Select at least one recipient from the dropdown.");
      return;
    }
    setSendStatus("loading");
    setSendMessage(dryRun ? "Generating dry-run report…" : "Sending report…");
    postMessage({
      type: "SEND_LUMI_REPORT",
      period,
      recipients,
      dryRun,
    });
  };

  const availableToAdd = recipientOptions.filter((e) => !recipients.includes(e.toLowerCase()));

  const apiStatusLabel =
    apiStatus === "checking"
      ? "Checking connection…"
      : apiStatus === "online"
        ? emailReady
          ? "Ready to email"
          : "API connected"
        : "API offline";

  const apiStatusHint =
    apiStatus === "online"
      ? emailReady
        ? "SMTP ready — Send report will deliver to inboxes."
        : emailHint || `API at ${apiUrl}. Configure SMTP in .env for live email.`
      : apiStatus === "offline"
        ? "Dry-run downloads from plugin data. Run npm run analytics-api for email."
        : "Verifying analytics API…";

  return (
    <div className="export-page">
      <PageSection
        title="Download reports"
        subtitle="Export local session data. Emails are excluded by default."
        className="export-section"
      >
        <div className="export-toolbar">
          <label className="export-toggle">
            <input
              type="checkbox"
              checked={includeEmails}
              onChange={(e) => setIncludeEmails(e.target.checked)}
            />
            <span className="export-toggle-track" aria-hidden="true" />
            <span className="export-toggle-label">Include emails in exports</span>
          </label>
        </div>

        <div className="export-groups">
          {EXPORT_GROUPS.map((group) => (
            <div key={group.title} className="export-group">
              <h4 className="export-group-title">{group.title}</h4>
              <div className="export-grid">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="export-card"
                    onClick={() => exportData(item.id)}
                  >
                    <span className="export-card-format">{item.format}</span>
                    <span className="export-card-label">{item.label}</span>
                    <span className="export-card-action">Download</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        title="Send performance report"
        subtitle="Choose period and recipients. Nothing is emailed until you send."
        className="export-section"
      >
        <div
          className={`export-api-status export-api-status--${apiStatus}${
            emailReady ? " export-api-status--email-ready" : ""
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="export-api-status-dot" aria-hidden="true" />
          <div className="export-api-status-text">
            <strong>{apiStatusLabel}</strong>
            <span>{apiStatusHint}</span>
          </div>
        </div>

        <div className="export-form">
          <div className="export-field">
            <label className="export-field-label" htmlFor="report-period">Period</label>
            <select
              id="report-period"
              className="export-select"
              value={period}
              onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>

          <div className="export-field export-field--grow">
            <label className="export-field-label" htmlFor="report-recipient">Add recipient</label>
            <div className="export-recipient-row">
              <select
                id="report-recipient"
                className="export-select"
                value={selectedRecipient}
                onChange={(e) => setSelectedRecipient(e.target.value)}
              >
                <option value="">Select email…</option>
                {availableToAdd.map((email) => (
                  <option key={email} value={email.toLowerCase()}>
                    {email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary export-add-btn"
                onClick={addRecipient}
                disabled={!selectedRecipient}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="export-recipients">
          {recipients.length > 0 ? (
            <ul className="export-recipient-list">
              {recipients.map((email) => (
                <li key={email} className="export-recipient-chip">
                  <span className="export-recipient-email">{email}</span>
                  <button
                    type="button"
                    className="export-recipient-remove"
                    onClick={() => removeRecipient(email)}
                    aria-label={`Remove ${email}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="export-recipients-empty">No recipients selected yet.</p>
          )}
        </div>

        <div className="export-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={sendStatus === "loading"}
            onClick={() => sendReport(true)}
          >
            Dry-run
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={sendStatus === "loading" || recipients.length === 0}
            onClick={() => sendReport(false)}
          >
            {sendStatus === "loading" ? "Working…" : `Send ${PERIOD_LABELS[period]} report`}
          </button>
        </div>

        {sendMessage ? (
          <div
            className={`export-alert export-alert--${
              sendStatus === "error" ? "error" : sendStatus === "success" ? "success" : "info"
            }`}
            role="alert"
          >
            {sendMessage}
          </div>
        ) : null}

        <div className="export-callout">
          <p>
            <strong>Live email</strong> — Google Workspace: <code>LUMI_SMTP_HOST=smtp.gmail.com</code>, your
            @nykaa.com email as <code>LUMI_SMTP_USER</code>, a Google App Password as <code>LUMI_SMTP_PASS</code> (not
            your login password), and <code>LUMI_REPORT_DRY_RUN=false</code>. Test with{" "}
            <code>npm run report:test-smtp -- --to you@nykaa.com</code>.
          </p>
        </div>
      </PageSection>
    </div>
  );
}
