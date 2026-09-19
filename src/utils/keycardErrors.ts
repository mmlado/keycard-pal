/**
 * "The card left the field", by message. The literals belong to the emitters (Android, the
 * bridge, keycard-sdk, iOS "NFCError:<code>") and may not be paraphrased (ADR-0006). The list is
 * closed: a false positive traps the user in a reconnect wait. Left out on purpose: NFCError:103
 * and 104, 'Malformed card response', 'Invalid APDUResponse', 'Error sending command'.
 */
const TAG_LOST_MESSAGE =
  /tag was lost|tag disconnected|apdu response must be at least 2 bytes|nfcerror:(100|101|102)\b/i;
// \b keeps `nfcerror:100` from matching a longer code.

/** True when an APDU failed because the card left the field. */
export function isTagLostError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; name?: unknown; message?: unknown };
  // Forward compatibility only: nothing emits these today.
  if (e.code === 'E_KEYCARD_TAG_LOST') return true;
  if (e.name === 'NFCDisconnectedError') return true;
  return typeof e.message === 'string' && TAG_LOST_MESSAGE.test(e.message);
}

export const CARD_NOT_GENUINE_STATUS =
  'This Keycard could not prove it is genuine. If this happens again, do not use the card.';
export const CONNECTION_NOT_PROTECTED_STATUS =
  'Could not set up a protected connection to this Keycard. Try again.';
export const NO_CERTIFICATE_STATUS =
  'This Keycard is missing its certificate and cannot be used.';

// Upstream's literals, like the tag-loss ones (ADR-0006).
const PLAIN_MESSAGES: ReadonlyArray<[RegExp, string]> = [
  [/Card authentication failed: invalid signature/i, CARD_NOT_GENUINE_STATUS],
  [
    /OPEN SECURE CHANNEL failed|Invalid handshake response/i,
    CONNECTION_NOT_PROTECTED_STATUS,
  ],
];

/** The text shown for a failed tap: plain words where the failure is known. */
export function cardErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const known = PLAIN_MESSAGES.find(([pattern]) => pattern.test(raw));
  return known ? known[1] : raw;
}

/** A newer card with no certificate stored answers SELECT itself with 0x6985. */
export function selectFailureMessage(sw: number): string {
  if (sw === 0x6985) {
    return NO_CERTIFICATE_STATUS;
  }
  return `SELECT failed: 0x${sw.toString(16).toUpperCase()}`;
}
