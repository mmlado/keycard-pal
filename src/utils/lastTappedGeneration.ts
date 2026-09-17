import type { Generation } from './cardGeneration';

/**
 * The generation of the card most recently tapped, held in memory for as long
 * as the app runs and never written anywhere.
 *
 * It exists for one reader: the dashboard reminder that a card outside the
 * user's selection was tapped. Nothing else may consult it. The reminder has to
 * follow a tap and nothing else, so whoever edits the selection forgets the
 * last tap: otherwise unticking the generation of the card last used would
 * raise the reminder from a Settings change alone. A card's generation
 * is otherwise resolved from its own tap and forgotten (ADR-0012), and this is
 * a pending question to the user, not a fact the app acts on.
 *
 * An external store rather than context, because the writer is the NFC session
 * hook, which runs outside any provider in most of its tests.
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

/**
 * Forgets the last tap. Called when the user edits the selection themselves,
 * which answers whatever question the last tap had raised.
 */
export function resetLastTappedGeneration(): void {
  if (lastTapped === null) {
    return;
  }
  lastTapped = null;
  listeners.forEach(listener => listener());
}
