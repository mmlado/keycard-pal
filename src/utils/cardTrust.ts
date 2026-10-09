import { KEYCARD_CA_PUBLIC_KEY } from '@/constants/keycard';

/**
 * Genuineness on cards with a certificate (ADR-0013). keycard-sdk judges the certificate inside
 * `select()`; IDENTIFY CARD for cards without one lives in `genuineCheck.ts`. A trusted
 * certificate proves nothing about the private key: only the handshake does.
 */

/** Passed to every `Commandset`, never left to the SDK default. */
export const TRUSTED_CA_PUBLIC_KEYS: Uint8Array[] = [KEYCARD_CA_PUBLIC_KEY];

/** keycard-sdk's literal, thrown from `select()` after `applicationInfo` is set. Not ours (ADR-0006). */
const UNKNOWN_CA_MESSAGE = /unknown CA public key and card not whitelisted/i;

/** True when `select()` failed only because the card's CA is not trusted. */
export function isUnknownCaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const { message } = err as { message?: unknown };
  return typeof message === 'string' && UNKNOWN_CA_MESSAGE.test(message);
}
