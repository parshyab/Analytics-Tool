import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Platform,
  PluginState,
  ScanScope,
  SessionMetadataSource,
  WorkComplexity,
  WorkType,
} from "../../types";
import {
  COMPLEXITY_OPTIONS,
  FLOW_OPTIONS,
  PLATFORM_OPTIONS,
  PROJECT_OPTIONS,
  SCAN_SCOPE_OPTIONS,
  WORK_TYPE_OPTIONS,
} from "../../types";
import { parseJiraTicket, issueToSessionFields } from "../../productivity/jiraParser";
import { detectFlow } from "../../productivity/startSessionInference";
import { JiraTicketSection, type SelectedJiraTicket } from "./JiraTicketPicker";
import { ActiveSessionGate } from "./ActiveSessionGate";
import { postMessage, usePluginState } from "../hooks";

type Props = {
  state: PluginState;
  onStarted: () => void;
};

export function StartSession({ state, onStarted }: Props) {
  const { startSessionContext, startSessionLoading, refreshStartSession, setTab } = usePluginState();

  const [selectedTicket, setSelectedTicket] = useState<SelectedJiraTicket | null>(null);
  const [ticketSource, setTicketSource] = useState<SessionMetadataSource["ticket"]>("none");
  const [flowName, setFlowName] = useState("");
  const [flowManual, setFlowManual] = useState(false);
  const [scanScope, setScanScope] = useState<ScanScope>("current-page");
  const [scanScopeManual, setScanScopeManual] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualJiraInput, setManualJiraInput] = useState("");
  const [projectName, setProjectName] = useState("");
  const [ticketTitle, setTicketTitle] = useState("");
  const [workType, setWorkType] = useState<WorkType>("iteration");
  const [complexity, setComplexity] = useState<WorkComplexity>("medium");
  const [platform, setPlatform] = useState<Platform>("ios");
  const [workTypeManual, setWorkTypeManual] = useState(false);
  const [complexityManual, setComplexityManual] = useState(false);
  const [projectManual, setProjectManual] = useState(false);
  const [ticketSkipped, setTicketSkipped] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);

  const applyContext = useCallback((context: NonNullable<typeof startSessionContext>) => {
    if (!scanScopeManual) {
      setScanScope(context.suggestedScanScope);
    }
    if (!flowManual && context.detectedFlow) {
      setFlowName(context.detectedFlow.flowName);
    }
    if (!projectManual && context.inferredProject) {
      setProjectName(context.inferredProject);
    }
    if (!workTypeManual && context.inferredWorkType) {
      setWorkType(context.inferredWorkType);
    }
    if (!complexityManual && context.inferredComplexity) {
      setComplexity(context.inferredComplexity.complexity);
    }

    const top = context.suggestedJiraTicket;
    if (top && !ticketSkipped) {
      const fields = issueToSessionFields(top.issue);
      setSelectedTicket(fields);
      setTicketTitle(fields.ticketTitle ?? fields.jiraSummary ?? "");
      setManualJiraInput(fields.jiraTicketId ?? "");
      setTicketSource(top.autoSelected ? "jira-auto" : "jira-suggested");
    }
  }, [scanScopeManual, flowManual, projectManual, workTypeManual, complexityManual, ticketSkipped]);

  useEffect(() => {
    refreshStartSession(flowName || undefined);
  }, []);

  useEffect(() => {
    if (startSessionContext) applyContext(startSessionContext);
  }, [startSessionContext, applyContext]);

  const flowHint = useMemo(() => {
    const source = startSessionContext?.detectedFlow;
    if (!source || flowManual) return "Select the product flow for benchmark matching";
    return source.reasons[0] ?? `Detected from ${source.source.replace(/-/g, " ")}`;
  }, [startSessionContext, flowManual]);

  const scanScopeHint = useMemo(() => {
    if (!startSessionContext) return "Scan scope follows your Figma selection";
    const label = startSessionContext.scanScopeLabel ?? startSessionContext.pageName;
    const option = SCAN_SCOPE_OPTIONS.find((o) => o.value === scanScope);
    return `Selected ${option?.label.toLowerCase() ?? "scope"}: ${label}`;
  }, [startSessionContext, scanScope]);

  const handleTicketSelect = (ticket: SelectedJiraTicket | null, source: SessionMetadataSource["ticket"]) => {
    setSelectedTicket(ticket);
    setTicketSource(source);
    setTicketSkipped(source === "none");
    if (!ticket) {
      setManualJiraInput("");
      setTicketTitle("");
      return;
    }
    setManualJiraInput(ticket.jiraTicketId ?? "");
    setTicketTitle(ticket.ticketTitle ?? ticket.jiraSummary ?? "");
    if (!flowManual && startSessionContext) {
      const detected = detectFlow({
        figmaContext: {
          fileName: startSessionContext.fileName,
          pageName: startSessionContext.pageName,
          selectedNodeName: startSessionContext.selectedNodeName,
          selectedNodeType: startSessionContext.selectedNodeType,
          parentPath: startSessionContext.parentPath,
          nearestSectionName: startSessionContext.nearestSectionName,
          nearestFrameName: startSessionContext.nearestFrameName,
        },
        jiraIssue: {
          key: ticket.jiraTicketId ?? "",
          summary: ticket.jiraSummary ?? ticket.ticketTitle ?? "",
          status: ticket.jiraStatus ?? "",
          updatedAt: new Date().toISOString(),
          url: ticket.jiraTicketUrl ?? "",
          storyPoints: ticket.jiraStoryPoints,
          projectKey: ticket.jiraProjectKey,
        },
      });
      if (detected) setFlowName(detected.flowName);
      if (!complexityManual && ticket.jiraStoryPoints !== undefined) {
        setComplexity(
          ticket.jiraStoryPoints <= 2
            ? "low"
            : ticket.jiraStoryPoints <= 5
              ? "medium"
              : ticket.jiraStoryPoints <= 8
                ? "high"
                : "very-high"
        );
      }
    }
  };

  const start = (withoutTicket = false) => {
    if (!flowName.trim()) {
      setFlowError("Flow is required to calculate benchmark-based hours saved.");
      return;
    }
    setFlowError(null);

    const parsed = parseJiraTicket(manualJiraInput);
    const hasTicket = !withoutTicket && !!(selectedTicket?.jiraTicketId || parsed.valid || manualJiraInput.trim());

    const metadataSource: SessionMetadataSource = {
      ticket: withoutTicket
        ? "none"
        : hasTicket
          ? ticketSource === "none"
            ? "manual"
            : ticketSource
          : "none",
      flow: flowManual ? "manual" : "auto",
      complexity: complexityManual
        ? "manual"
        : startSessionContext?.inferredComplexity?.source === "jira-story-points"
          ? "jira-story-points"
          : startSessionContext?.inferredComplexity
            ? "figma-analysis"
            : "none",
      scanScope: scanScopeManual ? "manual" : "auto",
    };

    postMessage({
      type: "START_SESSION",
      session: {
        projectName: projectName || undefined,
        jiraTicketId: hasTicket
          ? selectedTicket?.jiraTicketId ?? parsed.ticketId ?? manualJiraInput.trim().toUpperCase()
          : undefined,
        jiraTicketUrl: hasTicket ? selectedTicket?.jiraTicketUrl ?? parsed.url : undefined,
        jiraIssueKey: hasTicket
          ? selectedTicket?.jiraTicketId ?? parsed.ticketId ?? manualJiraInput.trim().toUpperCase()
          : undefined,
        jiraIssueUrl: hasTicket ? selectedTicket?.jiraTicketUrl ?? parsed.url : undefined,
        ticketTitle: hasTicket ? ticketTitle : undefined,
        jiraSummary: hasTicket ? ticketTitle : undefined,
        jiraStatus: hasTicket ? selectedTicket?.jiraStatus : undefined,
        jiraPriority: hasTicket ? selectedTicket?.jiraPriority : undefined,
        jiraProjectKey: selectedTicket?.jiraProjectKey,
        jiraStoryPoints: selectedTicket?.jiraStoryPoints,
        jiraAssigneeName: hasTicket ? selectedTicket?.jiraAssigneeName : undefined,
        jiraAssigneeEmail: hasTicket ? selectedTicket?.jiraAssigneeEmail : undefined,
        jiraComponents: hasTicket ? selectedTicket?.jiraComponents : undefined,
        jiraLabels: hasTicket ? selectedTicket?.jiraLabels : undefined,
        flowName,
        workType,
        complexity,
        platform,
        scanScope,
        notes: notes.trim() || undefined,
        metadataSource,
        fileName: state.fileName,
      },
    });
    onStarted();
  };

  if (state.activeSession) {
    return (
      <div className="start-session start-session--gate">
        <header className="start-session__header">
          <h2>Active session running</h2>
          <p>
            You already have a session in progress. Continue working, finish it, or discard it before
            starting another.
          </p>
        </header>
        <ActiveSessionGate
          session={state.activeSession}
          recentSessions={state.sessions}
          onOpenSession={() => setTab("active-session")}
        />
      </div>
    );
  }

  return (
    <div className="start-session">
      <header className="start-session__header">
        <h2>Start work session</h2>
        <p>
          LUMI will track time, scan your selected design, and calculate productivity when you finish.
        </p>
      </header>

      <div className="start-session__card">
        {startSessionLoading && !startSessionContext && (
          <p className="start-session__loading">Analyzing Figma context and Jira tickets…</p>
        )}

        <section className="start-session__section">
          <div className="start-session__section-head">
            <h3>1. Jira ticket</h3>
            {!selectedTicket && !ticketSkipped && (
              <span className="start-session__badge">Recommended</span>
            )}
          </div>
          <p className="start-session__hint">Select the Jira ticket you are working on.</p>
          {startSessionContext?.jiraSynced && (
            <p className="start-session__hint start-session__hint--muted">
              {startSessionContext.jiraIssueCount ?? 0} UX tickets available
              {startSessionContext.jiraCacheSyncedAt
                ? ` · Updated ${new Date(startSessionContext.jiraCacheSyncedAt).toLocaleDateString()}`
                : ""}
            </p>
          )}
          <JiraTicketSection
            context={startSessionContext}
            loading={startSessionLoading}
            selectedTicket={selectedTicket}
            manualInput={manualJiraInput}
            onManualInputChange={setManualJiraInput}
            onSelect={handleTicketSelect}
            onRefresh={() => refreshStartSession(flowName || undefined)}
          />
          {ticketSkipped && (
            <p className="start-session__hint start-session__hint--warn">
              You can start without a Jira ticket, but ticket-level reporting will be unavailable.
            </p>
          )}
        </section>

        <section className="start-session__section">
          <div className="start-session__section-head">
            <h3>2. Flow</h3>
            {startSessionContext?.detectedFlow && !flowManual && (
              <span className={`start-session__confidence start-session__confidence--${startSessionContext.detectedFlow.confidence}`}>
                {startSessionContext.detectedFlow.confidence}
              </span>
            )}
          </div>
          <div className="start-session__flow-row">
            {flowName && !flowManual ? (
              <span className="start-session__pill">{flowName}</span>
            ) : null}
            <select
              value={flowName}
              onChange={(e) => {
                setFlowName(e.target.value);
                setFlowManual(true);
                setFlowError(null);
              }}
            >
              <option value="">Select flow</option>
              {FLOW_OPTIONS.map((flow) => (
                <option key={flow} value={flow}>{flow}</option>
              ))}
            </select>
          </div>
          <p className="start-session__hint">{flowHint}</p>
          {flowError && <p className="start-session__error">{flowError}</p>}
        </section>

        <section className="start-session__section">
          <div className="start-session__section-head">
            <h3>3. Scan scope</h3>
          </div>
          <div className="start-session__segmented">
            {SCAN_SCOPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`start-session__segment ${scanScope === option.value ? "start-session__segment--active" : ""}`}
                onClick={() => {
                  setScanScope(option.value);
                  setScanScopeManual(true);
                }}
              >
                {option.short}
              </button>
            ))}
          </div>
          <p className="start-session__hint">{scanScopeHint}</p>
        </section>

        <section className="start-session__section start-session__section--compact">
          {!notesOpen ? (
            <button type="button" className="start-session__link" onClick={() => setNotesOpen(true)}>
              + Add notes
            </button>
          ) : (
            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Context for this session…"
              />
            </div>
          )}
        </section>

        <section className="start-session__section start-session__section--compact">
          <button
            type="button"
            className="start-session__link"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            {advancedOpen ? "− Hide advanced options" : "+ Advanced options"}
          </button>
          {advancedOpen && (
            <div className="start-session__advanced">
              <div className="form-group">
                <label>Project</label>
                <select
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value);
                    setProjectManual(true);
                  }}
                >
                  <option value="">Auto-detected</option>
                  {PROJECT_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Ticket title</label>
                <input
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                  placeholder="Auto-filled from Jira"
                />
              </div>
              <div className="form-group">
                <label>Work type</label>
                <select
                  value={workType}
                  onChange={(e) => {
                    setWorkType(e.target.value as WorkType);
                    setWorkTypeManual(true);
                  }}
                >
                  {WORK_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Complexity</label>
                <select
                  value={complexity}
                  onChange={(e) => {
                    setComplexity(e.target.value as WorkComplexity);
                    setComplexityManual(true);
                  }}
                >
                  {COMPLEXITY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {startSessionContext?.inferredComplexity && !complexityManual && (
                  <p className="start-session__hint">{startSessionContext.inferredComplexity.reasons[0]}</p>
                )}
              </div>
              <div className="form-group">
                <label>Platform</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
                  {PLATFORM_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        <footer className="start-session__footer">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => start(false)}>
            Start session
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => start(true)}>
            Start without ticket
          </button>
        </footer>
      </div>
    </div>
  );
}