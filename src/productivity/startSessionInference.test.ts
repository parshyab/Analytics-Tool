import {
  complexityFromStoryPoints,
  detectFlow,
  inferComplexity,
  inferWorkType,
  suggestScanScope,
} from "./startSessionInference";
import type { FigmaContextForJira, JiraIssue } from "../types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const issue458: JiraIssue = {
  id: "10001",
  key: "UX-458",
  summary: "Improve Checkout Address Flow",
  status: "In Progress",
  updatedAt: new Date().toISOString(),
  url: "https://example.atlassian.net/browse/UX-458",
  components: ["Checkout"],
  labels: [],
  storyPoints: 8,
};

const figmaSectionContext: FigmaContextForJira = {
  fileName: "Nykaa App",
  pageName: "Checkout",
  selectedNodeName: "UX-458 Checkout Address",
  selectedNodeType: "SECTION",
  parentPath: ["Checkout", "UX-458 Checkout Address"],
  nearestSectionName: "UX-458 Checkout Address",
};

// Test 1: section with key -> checkout flow + selected-section scope
assert(suggestScanScope(figmaSectionContext) === "selected-section", "Test 1: scan scope");
const flow1 = detectFlow({ figmaContext: figmaSectionContext, jiraIssue: issue458 });
assert(flow1?.flowName === "Checkout", "Test 1: flow should be Checkout");

// Test 2: payment frame + checkout summary ticket
const paymentFrame: FigmaContextForJira = {
  fileName: "Nykaa App",
  pageName: "Checkout",
  selectedNodeName: "Payment screen",
  selectedNodeType: "FRAME",
  parentPath: ["Checkout", "Payment screen"],
  nearestFrameName: "Payment screen",
};
const paymentIssue: JiraIssue = {
  id: "10002",
  key: "UX-471",
  summary: "Checkout payment improvements",
  status: "In Progress",
  updatedAt: new Date().toISOString(),
  url: "https://example.atlassian.net/browse/UX-471",
  labels: [],
  components: [],
};
const flow2 = detectFlow({ figmaContext: paymentFrame, jiraIssue: paymentIssue });
assert(
  flow2?.flowName === "Checkout" || flow2?.flowName === "Payment",
  "Test 2: flow should be Checkout or Payment"
);

// Test 3: no selection -> current page
const noSelection: FigmaContextForJira = {
  fileName: "Nykaa App",
  pageName: "Home",
  parentPath: ["Home"],
};
assert(suggestScanScope(noSelection) === "current-page", "Test 3: default page scope");

// Test 5: story points 8 -> high complexity
assert(complexityFromStoryPoints(8) === "high", "Test 5: story points 8");
const complexity5 = inferComplexity({ storyPoints: 8 });
assert(complexity5.complexity === "high", "Test 5: inferred high complexity");

// Test 6: figma analysis for heavy scope
const complexity6 = inferComplexity({
  metrics: {
    layerCount: 120,
    frameCount: 8,
    instanceCount: 20,
    uniqueComponentCount: 12,
    textNodeCount: 40,
    variantCount: 6,
    hasFormsModalsTables: true,
  },
});
assert(
  complexity6.complexity === "high" || complexity6.complexity === "very-high",
  "Test 6: heavy figma scope"
);

// Test 10 helper: work type defaults to iteration
assert(inferWorkType(issue458) === "iteration", "Test 10: default work type");

console.log("All start session inference acceptance tests passed.");
