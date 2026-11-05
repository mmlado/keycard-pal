import { APP_NAME } from './app';

// The Keycard team supports the app, so the pointer states a requirement and nothing that reads as an offer.
export const KEYCARD_PURCHASE_URL = 'https://keycard.tech';

export const BUY_KEYCARD_LABEL = 'keycard.tech';

export const NO_CARD_EXIT_LABEL = `${APP_NAME} needs a Keycard: ${KEYCARD_PURCHASE_URL.replace(
  'https://',
  '',
)}`;
