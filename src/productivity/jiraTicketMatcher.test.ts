import {
  suggestJiraTicketForCurrentContext,
  groupIssuesByAssignee,
} from "../integrations/jira/jiraTicketMapper";
import { getTopJiraSuggestion } from "./jiraTicketMatcher";
import type { JiraIssue } from "../types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const issue458: JiraIssue = {
  id: "10001",
  key: "UX-458",
  summary: "Improve Checkout Address Flow",
  status: "In Progress",
  priority: "High",
  updatedAt: new Date().toISOString(),
  url: "https://nykmage.atlassian.net/browse/UX-458",
  components: ["Checkout"],
  labels: ["design"],
  assigneeName: "Rahul Sharma",
};

const issue471: JiraIssue = {
  id: "10002",
  key: "UX-471",
  summary: "Update PDP gallery",
  status: "In Progress",
  priority: "Medium",
  updatedAt: new Date().toISOString(),
  url: "https://nykmage.atlassian.net/browse/UX-471",
  labels: [],
  components: [],
  assigneeName: "Priya Mehta",
};

const issue480: JiraIssue = {
  id: "10003",
  key: "UX-480",
  summary: "Search filters experiment",
  status: "In Progress",
  priority: "Low",
  updatedAt: new Date().toISOString(),
  url: "https://nykmage.atlassian.net/browse/UX-480",
  labels: [],
  components: [],
};

// 1. Frame name contains key -> high auto-select
const t1 = suggestJiraTicketForCurrentContext({
  issues: [issue458, issue471],
  figmaContext: {
    fileName: "Nykaa App",
    pageName: "Checkout",
    selectedNodeName: "UX-458 Address Form",
    selectedNodeType: "FRAME",
    parentPath: ["Checkout", "UX-458 Address Form"],
  },
});
assert(t1[0].issue.key === "UX-458", "Test 1: top match should be UX-458");
assert(t1[0].confidence === "high", "Test 1: confidence should be high");
assert(t1[0].autoSelected === true, "Test 1: should auto-select");

// 2. Page Checkout + summary keyword match -> medium
const t2 = suggestJiraTicketForCurrentContext({
  issues: [issue458],
  figmaContext: {
    fileName: "Nykaa App",
    pageName: "Checkout",
    selectedNodeName: "Address Form",
    parentPath: ["Checkout", "Address Form"],
  },
});
assert(t2[0].issue.key === "UX-458", "Test 2: should suggest UX-458");
assert(t2[0].confidence === "medium", "Test 2: should be medium confidence");
assert(t2[0].autoSelected === false, "Test 2: should not auto-select");

// 3. No context -> low confidence
const t3 = suggestJiraTicketForCurrentContext({
  issues: [issue458],
  figmaContext: {
    fileName: "Nykaa App",
    pageName: "Home",
    parentPath: ["Home"],
  },
});
assert(t3[0].confidence === "low", "Test 3: no context should be low");

// 4. Multiple tickets, no context -> picker
const t4 = suggestJiraTicketForCurrentContext({
  issues: [issue458, issue471, issue480],
  figmaContext: {
    fileName: "Nykaa App",
    pageName: "Misc",
    parentPath: ["Misc"],
  },
});
assert(t4.every((s) => s.score < 60), "Test 4: all scores should be below 60");
assert(t4[0].confidence === "low", "Test 4: top confidence should be low");

// 5. Top suggestion preserved
assert(getTopJiraSuggestion(t1)?.issue.key === "UX-458", "Test 5: key preserved");

// 6. Group by assignee
const workloads = groupIssuesByAssignee([issue458, issue471, issue480]);
assert(workloads.some((w) => w.designerName === "Rahul Sharma"), "Test 6: Rahul group");
assert(workloads.some((w) => w.designerName === "Unassigned"), "Test 6: Unassigned group");

console.log("All Jira ticket matcher acceptance tests passed.");
