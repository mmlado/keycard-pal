/** Messages that mean "the card left the field", not "the card said no".
 *
 *  These strings are NOT ours. They are, in order: the Android framework's own
 *  TagLostException message (mirrored by the bridge's TAG_LOST constant), the
 *  bridge's SecurityException wrapper, keycard-sdk's truncated-response throw, and
 *  react-native-status-keycard's "<domain>:<code>" iOS rejection format. Changing
 *  any of them here without changing the emitter silently disables classification.
 *  Port of status-legacy `tag-lost?` (contexts/keycard/utils.cljs:16-24), corrected
 *  per R18. Keep this list closed: a false positive traps the user in a reconnect wait.
 *
 *  Deliberately EXCLUDED, do not add without evidence:
 *    NFCError:103  session already invalidated — restartPolling cannot recover it,
 *                  so a reconnect wait would burn the whole watchdog for nothing.
 *    NFCError:104  tagNotConnected — outside the {100,102} set the field-proven
 *                  implementation matches; unproven (R18).
 *    'Malformed card response'   now means a malformed OUTBOUND apdu, i.e. a
 *                  programmer error, not tag loss (see the plan's Rejected table).
 *    'Invalid APDUResponse' / 'Error sending command'  cause-erasing constants that
 *                  fire for EVERY apdu error on iOS / Android respectively.
 */
const TAG_LOST_MESSAGE =
  /tag was lost|tag disconnected|apdu response must be at least 2 bytes|nfcerror:(100|101|102)\b/i;
// The \b guards against longer codes: without it, `nfcerror:100` would
// prefix-match a hypothetical NFCError:1002. Three-digit codes like 103 are
// already excluded by the alternation itself.

/** True when an APDU failed because the card left the field. */
export function isTagLostError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; name?: unknown; message?: unknown };
  // Forward-compat only: nothing emits either of these today (R15). Keep them cheap
  // and inert rather than relying on them — CardIOError discards `code` entirely.
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
