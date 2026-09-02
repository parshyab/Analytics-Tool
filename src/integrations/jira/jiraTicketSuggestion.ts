import type { FigmaContextForJira } from "../../types";
import type { JiraIssue, JiraTicketSuggestion } from "./types";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "into", "your", "this", "that", "flow",
  "improve", "update", "design", "figma", "page", "frame", "section",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsKey(text: string | undefined, key: string): boolean {
  if (!text) return false;
  return new RegExp(`\\b${escapeRegExp(key)}\\b`, "i").test(text);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function keywordOverlapScore(source: string, target: string, cap: number): number {
  const sourceTokens = new Set(tokenize(source));
  const targetTokens = tokenize(target);
  if (sourceTokens.size === 0 || targetTokens.length === 0) return 0;
  let matches = 0;
  for (const token of targetTokens) {
    if (sourceTokens.has(token)) matches++;
  }
  if (matches === 0) return 0;
  return Math.min(cap, matches * 15);
}

function hoursSince(iso?: string): number {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function scoreToConfidence(score: number): JiraTicketSuggestion["confidence"] {
  if (score >= 90) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function isDone(issue: JiraIssue): boolean {
  if (issue.statusCategory === "Done") return true;
  return ["done", "closed", "resolved", "cancelled"].includes(issue.status.toLowerCase());
}

function isInProgress(issue: JiraIssue): boolean {
  const status = issue.status.toLowerCase();
  return status === "in progress" || status.includes("in progress");
}

export function suggestJiraTicketForCurrentContext(input: {
  issues: JiraIssue[];
  figmaContext: FigmaContextForJira;
  detectedFlow?: string;
  myAssigneeName?: string;
}): JiraTicketSuggestion[] {
  const scored = input.issues.map((issue) => {
    const key = issue.key.toUpperCase();
    let score = 0;
    const reasons: string[] = [];

    if (containsKey(input.figmaContext.selectedNodeName, key)) {
      score += 100;
      reasons.push("Ticket key found in selected node name");
    } else if (input.figmaContext.parentPath.some((name) => containsKey(name, key))) {
      score += 90;
      reasons.push("Ticket key found in parent path");
    } else if (containsKey(input.figmaContext.pageName, key)) {
      score += 80;
      reasons.push("Ticket key found in page name");
    }

    if (input.figmaContext.selectedNodeName) {
      const nodeKw = keywordOverlapScore(issue.summary, input.figmaContext.selectedNodeName, 70);
      if (nodeKw > 0) {
        score += nodeKw;
        reasons.push("Ticket summary matches selected node keywords");
      }
    }

    const pageKw = keywordOverlapScore(issue.summary, input.figmaContext.pageName, 60);
    if (pageKw > 0) {
      score += pageKw;
      reasons.push("Ticket summary matches page name keywords");
    }

    const flow = (input.detectedFlow ?? input.figmaContext.flowName ?? "").toLowerCase();
    if (flow) {
      if (issue.components.some((c) => c.toLowerCase().includes(flow))) {
        score += 50;
        reasons.push("Jira component matches detected flow");
      }
      if (issue.labels.some((l) => l.toLowerCase().includes(flow))) {
        score += 40;
        reasons.push("Jira label matches detected flow");
      }
    }

    if (isInProgress(issue)) {
      score += 30;
      reasons.push("Ticket is in progress");
    }
    if (isDone(issue)) {
      score -= 50;
      reasons.push("Ticket is done");
    }
    if (!issue.assigneeName || issue.assigneeName === "Unassigned") {
      score -= 20;
      reasons.push("Ticket is unassigned");
    }
    if (hoursSince(issue.updatedAt) <= 48) {
      score += 20;
      reasons.push("Ticket updated recently");
    }

    if (
      input.myAssigneeName &&
      issue.assigneeName &&
      issue.assigneeName.toLowerCase() === input.myAssigneeName.toLowerCase()
    ) {
      score += 15;
      reasons.push("Assigned to you");
    }

    return {
      issue,
      score: Math.max(0, score),
      reasons: reasons.length ? reasons : ["No strong Figma context match"],
      confidence: scoreToConfidence(Math.max(0, score)),
      autoSelected: false,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0 && scored[0].score >= 90) {
    scored[0].autoSelected = true;
    scored[0].confidence = "high";
  } else if (scored.length > 0 && scored[0].score >= 60) {
    scored[0].confidence = "medium";
  }

  return scored;
}
