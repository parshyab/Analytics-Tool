import { groupIssuesByAssignee } from "./jiraTicketMapper";
import type { JiraIssue } from "../../types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const issues: JiraIssue[] = [
  {
    id: "1",
    key: "UX-458",
    summary: "Improve Checkout Address Flow",
    status: "In Progress",
    assigneeName: "Rahul Sharma",
    labels: [],
    components: ["Checkout"],
    updatedAt: new Date().toISOString(),
    url: "https://example.atlassian.net/browse/UX-458",
  },
  {
    id: "2",
    key: "UX-500",
    summary: "Empty State Cleanup",
    status: "To Do",
    labels: [],
    components: [],
    updatedAt: new Date().toISOString(),
    url: "https://example.atlassian.net/browse/UX-500",
  },
];

const workloads = groupIssuesByAssignee(issues);
assert(workloads.length === 2, "Should group into assignee + unassigned");
assert(workloads.some((w) => w.designerName === "Rahul Sharma"), "Rahul group exists");
assert(workloads.some((w) => w.designerName === "Unassigned"), "Unassigned group exists");

console.log("All Jira board sync acceptance tests passed.");
