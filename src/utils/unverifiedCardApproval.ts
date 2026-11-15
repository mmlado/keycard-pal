/**
 * Whether an approval of an unverified card was kept since the last check, in memory only. An
 * external store because the approval is kept outside any provider; one reader acts on it.
 */
let pending = false;
const listeners = new Set<() => void>();

export function noteUnverifiedCardApproved(): void {
  if (pending) {
    return;
  }
  pending = true;
  listeners.forEach(listener => listener());
}

export function isUnverifiedCardApprovalPending(): boolean {
  return pending;
}

export function subscribeUnverifiedCardApproval(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearUnverifiedCardApproval(): void {
  if (!pending) {
    return;
  }
  pending = false;
  listeners.forEach(listener => listener());
}
