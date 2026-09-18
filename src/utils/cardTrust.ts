import { KEYCARD_CA_PUBLIC_KEY } from '@/constants/keycard';

/**
 * Whether a card is genuine, on cards that carry a certificate (ADR-0013).
 *
 * This is one half of a deliberate split. "Does this certificate chain to the
 * CA" is answered here, by keycard-sdk inside `select()`, which this module
 * configures and whose refusal it recognises. "Parse and challenge-verify an
 * IDENTIFY CARD response" lives in `genuineCheck.ts` and is for cards without
 * a certificate. keycard-shell arrived at the same split as a bug fix, after
 * reusing its IDENTIFY parser on the raw SELECT certificate made the check fail
 * on every card. One verdict sits above both: the card is genuine, or it may
 * not be.
 *
 * A trusted certificate says nothing about whether the card holds the matching
 * private key. That is proven by the secure channel handshake, which verifies
 * the card's signature over the transcript, and nowhere else.
 */

/**
 * The CA keys a card's certificate may chain to. Passed to every `Commandset`
 * rather than left to the SDK's default: on a certificate card this key decides
 * whether a secure channel opens at all, so it is ours to state.
 */
export const TRUSTED_CA_PUBLIC_KEYS: Uint8Array[] = [KEYCARD_CA_PUBLIC_KEY];

/**
 * keycard-sdk's message when a certificate chains to no trusted CA and the card
 * is not whitelisted. It is thrown from inside `select()`, as an
 * `APDUException`, after `applicationInfo` has been filled in.
 *
 * This string is NOT ours. Like the tag-loss literals in `keycardErrors.ts`
 * (ADR-0006) it belongs to upstream and may not be paraphrased: changing it
 * here without the SDK changing silently turns every unapproved card into a
 * plain SELECT failure, with no way to approve it.
 */
const UNKNOWN_CA_MESSAGE = /unknown CA public key and card not whitelisted/i;

/** True when `select()` failed only because the card's CA is not trusted. */
export function isUnknownCaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const { message } = err as { message?: unknown };
  return typeof message === 'string' && UNKNOWN_CA_MESSAGE.test(message);
}
