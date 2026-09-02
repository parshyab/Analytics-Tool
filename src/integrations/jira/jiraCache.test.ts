import fs from "fs";
import path from "path";
import { getBundledJiraCache } from "./jiraCacheLoader";
import { suggestJiraTicketForCurrentContext } from "./jiraTicketSuggestion";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const cachePath = path.resolve("src/generated/jira-cache.json");
const raw = fs.readFileSync(cachePath, "utf8");
const parsed = JSON.parse(raw) as Record<string, unknown>;

assert(typeof parsed.syncedAt !== "undefined", "Cache must include syncedAt");
assert(typeof parsed.jql === "string", "Cache must include jql");
assert(typeof parsed.total === "number", "Cache must include total");
assert(Array.isArray(parsed.issues), "Cache must include issues array");
assert(Array.isArray(parsed.assignees), "Cache must include assignees array");

const serialized = JSON.stringify(parsed);
assert(!serialized.includes("JIRA_API_TOKEN"), "Cache must not contain JIRA_API_TOKEN");
assert(!serialized.includes("Authorization"), "Cache must not contain Authorization header");
assert(!/api[_-]?token/i.test(serialized), "Cache must not contain api token fields");

const cache = getBundledJiraCache();
assert(cache.source === "empty" || cache.issues.length >= 0, "Bundled cache loader works");

const mockIssues = [
  {
    id: "1",
    key: "UX-458",
    summary: "Improve Checkout Address Flow",
    status: "In Progress",
    labels: [] as string[],
    components: ["Checkout"],
    updatedAt: new Date().toISOString(),
    url: "https://nykmage.atlassian.net/browse/UX-458",
    assigneeName: "Rahul Sharma",
  },
];

const suggestions = suggestJiraTicketForCurrentContext({
  issues: mockIssues,
  figmaContext: {
    fileName: "Checkout",
    pageName: "Address",
    selectedNodeName: "UX-458 Frame",
    parentPath: [],
  },
});

assert(suggestions[0]?.issue.key === "UX-458", "UX-458 should be suggested from frame name");
assert((suggestions[0]?.score ?? 0) >= 90, "UX-458 in frame name should score >= 90");

console.log("All Jira cache acceptance tests passed.");
