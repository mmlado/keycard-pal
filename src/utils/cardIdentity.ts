import type { ApplicationInfo } from 'keycard-sdk/dist/application-info';

import { secureChannelVersion } from './cardGeneration';
import { toHex } from './hex';

/** The first 33 bytes of a V2 card's certificate: a compressed key. */
const CARD_IDENTITY_PUBLIC_KEY_LENGTH = 33;

/**
 * What identifies the tapped card, for anything trust-shaped (pairings, approvals). Instance UID
 * on V1, so stored pairings keep resolving; certificate identity key on V2. Null for a blank 3.x card.
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

/** Names the seed, not the card (SHA-256 of the master public key). For anything about derived keys. Null without a key. */
export function getKeyUid(appInfo: ApplicationInfo): string | null {
  const keyUID = appInfo.keyUID;
  return keyUID && keyUID.length > 0 ? toHex(keyUID) : null;
}
