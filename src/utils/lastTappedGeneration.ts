import type { Generation } from './cardGeneration';

/**
 * The last tapped card's generation, in memory only, for one reader: the dashboard reminder.
 * Nothing else may consult it. Every edit of the selection forgets it, so the reminder follows a
 * tap and never a Settings change. An external store because the writer runs outside providers.
 */
let lastTapped: Generation | null = null;
const listeners = new Set<() => void>();

export function noteTappedGeneration(generation: Generation): void {
  if (generation === lastTapped) {
    return;
  }
  lastTapped = generation;
  listeners.forEach(listener => listener());
}

export function getLastTappedGeneration(): Generation | null {
  return lastTapped;
}

export function subscribeLastTappedGeneration(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by every writer of the selection. */
export function resetLastTappedGeneration(): void {
  if (lastTapped === null) {
    return;
  }
  lastTapped = null;
  listeners.forEach(listener => listener());
}
