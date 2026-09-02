import type {
  ComplexitySuggestion,
  FigmaContextForJira,
  FigmaScopeMetrics,
  FlowSuggestion,
  FlowSuggestionSource,
  JiraConfidence,
  JiraIssue,
  ScanScope,
  WorkComplexity,
  WorkType,
} from "../types";
import { FLOW_OPTIONS } from "../types";

type FlowKeywordRule = {
  flowName: string;
  keywords: string[];
};

const FLOW_KEYWORD_RULES: FlowKeywordRule[] = [
  { flowName: "Checkout", keywords: ["checkout", "payment", "address", "delivery"] },
  { flowName: "PDP", keywords: ["pdp", "product detail", "product page"] },
  { flowName: "Cart", keywords: ["cart", "bag"] },
  { flowName: "Search", keywords: ["search"] },
  { flowName: "Login", keywords: ["login", "signup", "auth"] },
  { flowName: "Payment", keywords: ["payment", "pay", "upi", "card"] },
  { flowName: "Wishlist", keywords: ["wishlist"] },
  { flowName: "Order Tracking", keywords: ["order", "tracking"] },
  { flowName: "PLP", keywords: ["plp", "listing", "category"] },
  { flowName: "Home Page", keywords: ["home", "homepage"] },
  { flowName: "Address", keywords: ["address", "shipping"] },
];

const FORM_MODAL_TABLE_KEYWORDS = ["form", "modal", "dialog", "drawer", "table", "sheet"];

function normalizeText(value?: string): string {
  return (value ?? "").toLowerCase().trim();
}

function includesKeyword(text: string, keyword: string): boolean {
  const haystack = normalizeText(text);
  const needle = normalizeText(keyword);
  if (!haystack || !needle) return false;
  return haystack.includes(needle);
}

function scoreFlowMatch(text: string, rule: FlowKeywordRule): number {
  let score = 0;
  for (const keyword of rule.keywords) {
    if (includesKeyword(text, keyword)) score += keyword.includes(" ") ? 3 : 2;
  }
  return score;
}

function pickFlowFromText(
  text: string,
  source: FlowSuggestionSource,
  baseConfidence: JiraConfidence
): FlowSuggestion | undefined {
  let best: FlowSuggestion | undefined;
  let bestScore = 0;

  for (const rule of FLOW_KEYWORD_RULES) {
    const score = scoreFlowMatch(text, rule);
    if (score > bestScore) {
      bestScore = score;
      best = {
        flowName: rule.flowName,
        confidence: baseConfidence,
        source,
        reasons: [`Matched "${rule.flowName}" from ${source.replace(/-/g, " ")}`],
      };
    }
  }

  return best;
}

export function detectFlow(input: {
  figmaContext: FigmaContextForJira;
  jiraIssue?: JiraIssue;
}): FlowSuggestion | undefined {
  const candidates: FlowSuggestion[] = [];

  if (input.jiraIssue) {
    for (const label of input.jiraIssue.labels ?? []) {
      const match = pickFlowFromText(label, "jira-label", "high");
      if (match) candidates.push(match);
    }
    for (const component of input.jiraIssue.components ?? []) {
      const match = pickFlowFromText(component, "jira-component", "high");
      if (match) candidates.push(match);
    }
    const summaryMatch = pickFlowFromText(input.jiraIssue.summary, "jira-summary", "medium");
    if (summaryMatch) candidates.push(summaryMatch);
  }

  const figmaTexts = [
    { text: input.figmaContext.pageName, source: "figma-page" as const, confidence: "medium" as const },
    { text: input.figmaContext.nearestSectionName ?? "", source: "figma-section" as const, confidence: "medium" as const },
    { text: input.figmaContext.nearestFrameName ?? "", source: "figma-frame" as const, confidence: "medium" as const },
    { text: input.figmaContext.selectedNodeName ?? "", source: "figma-frame" as const, confidence: "low" as const },
  ];

  for (const item of figmaTexts) {
    const match = pickFlowFromText(item.text, item.source, item.confidence);
    if (match) candidates.push(match);
  }

  for (const name of input.figmaContext.parentPath) {
    const match = pickFlowFromText(name, "figma-section", "low");
    if (match) candidates.push(match);
  }

  if (candidates.length === 0) return undefined;

  const rank: Record<JiraConfidence, number> = { high: 3, medium: 2, low: 1 };
  candidates.sort((a, b) => rank[b.confidence] - rank[a.confidence]);
  return candidates[0];
}

export function suggestScanScope(context: FigmaContextForJira): ScanScope {
  const type = context.selectedNodeType;
  const selection = context.selectedNodeName;

  if (!selection || !type || type === "PAGE") {
    return "current-page";
  }

  if (type === "SECTION") return "selected-section";
  if (type === "FRAME" || type === "COMPONENT" || type === "COMPONENT_SET") {
    return "selected-frame";
  }

  if (context.nearestSectionName) return "selected-section";
  if (context.nearestFrameName) return "selected-frame";
  return "current-page";
}

export function scanScopeContextLabel(scope: ScanScope, context: FigmaContextForJira): string {
  switch (scope) {
    case "selected-section":
      return context.nearestSectionName ?? context.selectedNodeName ?? "Selected section";
    case "selected-frame":
      return context.nearestFrameName ?? context.selectedNodeName ?? "Selected frame";
    case "whole-file":
      return context.fileName;
    default:
      return context.pageName;
  }
}

export function complexityFromStoryPoints(storyPoints: number): WorkComplexity {
  if (storyPoints <= 2) return "low";
  if (storyPoints <= 5) return "medium";
  if (storyPoints <= 8) return "high";
  return "very-high";
}

export function inferComplexity(input: {
  storyPoints?: number;
  metrics?: FigmaScopeMetrics;
}): ComplexitySuggestion {
  if (input.storyPoints !== undefined && !Number.isNaN(input.storyPoints)) {
    return {
      complexity: complexityFromStoryPoints(input.storyPoints),
      source: "jira-story-points",
      score: input.storyPoints,
      reasons: [`Jira story points: ${input.storyPoints}`],
    };
  }

  const metrics = input.metrics;
  if (!metrics) {
    return {
      complexity: "medium",
      source: "figma-scope-analysis",
      reasons: ["Default complexity — no scope metrics available"],
    };
  }

  let score = 0;
  const reasons: string[] = [];

  score += Math.min(30, Math.floor(metrics.layerCount / 20));
  if (metrics.layerCount > 40) reasons.push(`${metrics.layerCount} layers in scope`);

  score += Math.min(20, metrics.frameCount * 4);
  if (metrics.frameCount > 2) reasons.push(`${metrics.frameCount} frames`);

  score += Math.min(20, metrics.instanceCount * 2);
  if (metrics.instanceCount > 5) reasons.push(`${metrics.instanceCount} component instances`);

  score += Math.min(15, metrics.uniqueComponentCount * 3);
  if (metrics.uniqueComponentCount > 3) {
    reasons.push(`${metrics.uniqueComponentCount} unique components`);
  }

  if (metrics.variantCount > 2) {
    score += 10;
    reasons.push(`${metrics.variantCount} variants`);
  }

  if (metrics.hasFormsModalsTables) {
    score += 12;
    reasons.push("Forms, modals, or tables detected");
  }

  let complexity: WorkComplexity = "low";
  if (score >= 55) complexity = "very-high";
  else if (score >= 38) complexity = "high";
  else if (score >= 20) complexity = "medium";

  if (reasons.length === 0) {
    reasons.push("Light scope based on Figma selection");
  }

  return {
    complexity,
    source: "figma-scope-analysis",
    score,
    reasons,
  };
}

export function inferWorkType(jiraIssue?: JiraIssue): WorkType {
  if (!jiraIssue) return "iteration";

  const issueType = normalizeText(jiraIssue.issueType);
  const labels = (jiraIssue.labels ?? []).map(normalizeText);
  const summary = normalizeText(jiraIssue.summary);

  if (labels.some((l) => l.includes("experiment"))) return "experiment";
  if (labels.some((l) => l.includes("migration"))) return "component-migration";
  if (labels.some((l) => l.includes("qa") || l.includes("bug"))) return "design-qa-fix";
  if (issueType.includes("bug")) return "design-qa-fix";
  if (issueType.includes("story") || issueType.includes("task")) return "iteration";
  if (summary.includes("new flow") || summary.includes("new screen")) return "new-flow";
  if (summary.includes("refine") || summary.includes("polish")) return "visual-refinement";

  return "iteration";
}

export function inferProject(input: {
  jiraIssue?: JiraIssue;
  fileName: string;
}): string | undefined {
  if (input.jiraIssue?.projectKey) {
    return input.jiraIssue.projectKey;
  }

  const file = normalizeText(input.fileName);
  for (const project of ["Nykaa App", "Nykaa Web", "Nykaa Fashion", "Nykaa Beauty"]) {
    if (file.includes(normalizeText(project))) return project;
  }

  for (const flow of FLOW_OPTIONS) {
    if (file.includes(normalizeText(flow))) return flow;
  }

  return input.fileName || undefined;
}

export function metricsFromNodeNames(names: string[]): FigmaScopeMetrics {
  const joined = names.join(" ").toLowerCase();
  return {
    layerCount: names.length,
    frameCount: names.filter((n) => /frame|screen|page/i.test(n)).length,
    instanceCount: names.filter((n) => /instance|component/i.test(n)).length,
    uniqueComponentCount: new Set(names.map((n) => n.toLowerCase())).size,
    textNodeCount: names.filter((n) => /text|label|title|heading/i.test(n)).length,
    variantCount: names.filter((n) => /variant|state|size/i.test(n)).length,
    hasFormsModalsTables: FORM_MODAL_TABLE_KEYWORDS.some((k) => joined.includes(k)),
  };
}
