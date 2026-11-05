// iOS bundles purchaseLink.ios.ts instead, which deliberately has no disclosure copy; do not add it there.

// Pays a commission, so every surface showing it renders <AffiliateDisclosure /> or it is hidden advertising.
// Standing rules: these labels are never removed as tidy-up, and any benefit from Keycard is named in them.
export const KEYCARD_PURCHASE_URL = 'https://get.keycard.tech/vuxxnf';

export const BUY_KEYCARD_LABEL = 'Buy a Keycard';

export const NO_CARD_EXIT_LABEL = "Don't have a Keycard?";

// "Advertisement" leads, and no price, percentage or currency appears: a price makes this an invitation to purchase.
export const AFFILIATE_DISCLOSURE =
  'Advertisement: affiliate link. The developer earns a commission if you buy a Keycard and has received equipment from the Keycard team.';

export const AFFILIATE_DISCLOSURE_SHORT =
  'Advertisement: affiliate link. Pays the developer a commission; the Keycard team has provided equipment.';

// Offline the QR screen is the whole placement, so it carries the label.
export const PURCHASE_QR_NOTE: string | undefined = AFFILIATE_DISCLOSURE;
