// Metro picks this over purchaseLink.ts, so the affiliate URL and the
// disclosure copy are absent from the iOS bundle rather than unused in it.
//
// Rules for this pointer: keycard.tech, never the shop or a referral
// parameter; no imperative verb in a label, so no "buy", "get", "shop" or
// "order"; no price, currency or discount; no statement about commercial
// status in either direction; and no non-monetary benefit attached to it.

import { APP_NAME } from './app';

export const KEYCARD_PURCHASE_URL = 'https://keycard.tech';

export const BUY_KEYCARD_LABEL = 'keycard.tech';

// "Don't have a Keycard?" would open an offer; this states the requirement.
export const NO_CARD_EXIT_LABEL = `${APP_NAME} needs a Keycard: ${KEYCARD_PURCHASE_URL.replace(
  'https://',
  '',
)}`;

// No commission, so nothing to disclose. Named to match its twin.
export const PURCHASE_QR_NOTE: string | undefined = undefined;
