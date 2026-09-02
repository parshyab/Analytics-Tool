import assert from "node:assert/strict";
import {
  needsRestorePrompt,
  shouldAutoContinueSession,
  RESTORE_PROMPT_GAP_MS,
} from "./sessionHeartbeat";
import type { WorkSession } from "../types";

function makeSession(lastSeenAt: string): WorkSession {
  return {
    id: "s1",
    designerUserId: "u1",
    designerName: "Designer",
    status: "active",
    startedAt: lastSeenAt,
    lastSeenAt,
    createdAt: lastSeenAt,
    updatedAt: lastSeenAt,
    pauseIntervals: [],
    autoStarted: true,
    scanScope: "current-page",
    fileName: "File",
    eligibleForReporting: false,
  } as WorkSession;
}

function testShortGapAutoContinues(): void {
  const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const session = makeSession(recent);
  assert.equal(shouldAutoContinueSession(session), true);
  assert.equal(needsRestorePrompt(session), false);
}

function testLongGapNeedsRestore(): void {
  const old = new Date(Date.now() - (RESTORE_PROMPT_GAP_MS + 60_000)).toISOString();
  const session = makeSession(old);
  assert.equal(shouldAutoContinueSession(session), false);
  assert.equal(needsRestorePrompt(session), true);
}

function main(): void {
  testShortGapAutoContinues();
  testLongGapNeedsRestore();
  console.log("All session heartbeat restore tests passed.");
}

main();
