/** One-shot flag: open finish modal when navigating to Active Session. */
let finishSessionRequested = false;

export function requestFinishSession(): void {
  finishSessionRequested = true;
}

export function takeFinishSessionIntent(): boolean {
  if (!finishSessionRequested) return false;
  finishSessionRequested = false;
  return true;
}
