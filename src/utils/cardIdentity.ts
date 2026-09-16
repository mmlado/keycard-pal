import type { ApplicationInfo } from 'keycard-sdk/dist/application-info';

import { secureChannelVersion } from './cardGeneration';
import { toHex } from './hex';

/** The card identity public key is the first 33 bytes of a V2 card's
 *  certificate: a compressed key, followed by the CA's signature over it. */
const CARD_IDENTITY_PUBLIC_KEY_LENGTH = 33;

/**
 * The card key: what identifies the tapped card for this session, as hex. Use
 * it for anything trust-shaped, such as pairings and approved cards.
 *
 * A secure channel V1 card uses its instance UID, which is exactly the string
 * pairings have always been stored under, so existing pairings keep resolving.
 * A V2 card has no instance UID and uses the card identity public key from its
 * certificate instead. Null when the card reports neither, which only happens
 * for an uninitialized 3.x card.
 */
export function getCardKey(appInfo: ApplicationInfo): string | null {
  if (secureChannelVersion(appInfo) === 'v2') {
    const certificate = appInfo.certificateData;
    return certificate
      ? toHex(certificate.subarray(0, CARD_IDENTITY_PUBLIC_KEY_LENGTH))
      : null;
  }
  return appInfo.instanceUID ? toHex(appInfo.instanceUID) : null;
}

/**
 * The key UID as hex. Use it for anything about key material, such as exported
 * keys, rather than the card key.
 *
 * The applet computes it as the SHA-256 of the master public key, so it names
 * the seed, not the card: two cards holding the same seed share it, and loading
 * a different seed onto the same card changes it. Null when no key is loaded.
 */
export function getKeyUid(appInfo: ApplicationInfo): string | null {
  const keyUID = appInfo.keyUID;
  return keyUID && keyUID.length > 0 ? toHex(keyUID) : null;
}
