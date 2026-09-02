import { buildDesignerWorkloadSummaries } from "./designerWorkloadSummary";
import type { JiraIssue } from "../integrations/jira/types";
import type { ProductivityResult, WorkSession } from "../types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const issues: JiraIssue[] = [
  {
    id: "1",
    key: "UX-458",
    summary: "Improve Checkout Address Flow",
    status: "In Progress",
    statusCategory: "In Progress",
    assigneeName: "Anupama Sharma",
    labels: [],
    components: ["Checkout"],
    updatedAt: new Date().toISOString(),
    url: "https://example.atlassian.net/browse/UX-458",
  },
  {
    id: "2",
    key: "UX-500",
    summary: "Empty State Cleanup",
    status: "Done",
    statusCategory: "Done",
    assigneeName: "Anupama Sharma",
    labels: [],
    components: [],
    updatedAt: new Date().toISOString(),
    url: "https://example.atlassian.net/browse/UX-500",
  },
];

const sessions: WorkSession[] = [
  {
    id: "s1",
    designerUserId: "u1",
    designerName: "Anupama Sharma",
    anonymous: false,
    jiraIssueKey: "UX-458",
    fileName: "Checkout",
    scanScope: "current-page",
    status: "finished",
    autoStarted: false,
    startedAt: "2026-06-01T10:00:00.000Z",
    lastSeenAt: "2026-06-01T11:00:00.000Z",
    pauseIntervals: [],
    metadataComplete: true,
    eligibleForReporting: true,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T11:00:00.000Z",
  },
];

const results: ProductivityResult[] = [
  {
    id: "r1",
    sessionId: "s1",
    designerUserId: "u1",
    designerName: "Anupama Sharma",
    jiraTicketId: "UX-458",
    actualMinutes: 60,
    lumiAdoptionRate: 91,
    tokenAdoptionRate: 80,
    styleAdoptionRate: 75,
    lumiComponentInstances: 12,
    uniqueLumiComponents: 4,
    detachedCandidates: 0,
    customColors: 0,
    qualityScore: 92,
    designSystemLeverageScore: 88,
    confidence: { label: "high", score: 0.9, reasons: [] },
    confidenceNotes: [],
    observedHoursSaved: 2,
    createdAt: "2026-06-01T11:00:00.000Z",
  },
];

const summaries = buildDesignerWorkloadSummaries({ issues, sessions, results });
assert(summaries.length === 1, "One designer summary expected");
assert(summaries[0].activeTickets === 1, "One active ticket");
assert(summaries[0].doneTickets === 1, "One done ticket");
assert(summaries[0].sessions === 1, "One linked session");
assert(summaries[0].observedHoursSaved === 2, "Hours saved aggregated");

console.log("All designer workload summary tests passed.");
