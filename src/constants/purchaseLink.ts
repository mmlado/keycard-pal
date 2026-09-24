// iOS resolves purchaseLink.ios.ts instead and never bundles this file. The
// twin exports every name a consumer imports, but not the disclosure copy:
// that is the point of the split, so do not "restore parity" by adding it.

// Affiliate link (applies a coupon on the shop side); deliberately not the
// bare get-keycard URL Status Legacy uses. It pays the developer a commission
// on each sale, which makes every surface that shows it a paid placement:
// never render it without an adjacent <AffiliateDisclosure />, or the app is
// hidden advertising (Zakon o oglašavanju čl. 12; UCPD art. 7(2)).
//
// Standing rules: no non-monetary benefit may attach to the iOS pointer
// either, a free device or co-marketing counting the same as money; the
// Advertisement labels here are not to be removed as tidy-up.
export const KEYCARD_PURCHASE_URL = 'https://get.keycard.tech/vuxxnf';

export const BUY_KEYCARD_LABEL = 'Buy a Keycard';

export const NO_CARD_EXIT_LABEL = "Don't have a Keycard?";

// Disclosure copy. "Advertisement" leads deliberately: the CPC Network's
// disclosure principles name "partnership", "sponsored" and "ambassador" as
// inadequate. No price, percentage or currency symbol may ever appear here.
// A price turns the placement into an invitation to purchase (UCPD art. 2(i)),
// which imports the art. 7(4)(b) duty to publish the advertised trader's
// identity and geographic address, and the coupon is Status's to change while
// air-gapped builds and GitHub APKs never auto-update, so any figure can go
// stale on builds that cannot be reached (Apple guideline 2.3.1(a)).
export const AFFILIATE_DISCLOSURE =
  'Advertisement: affiliate link. The developer earns a commission if you buy a Keycard.';

export const AFFILIATE_DISCLOSURE_SHORT =
  'Advertisement: affiliate link, pays the developer a commission.';

// Offline the QR screen is the whole placement, so it carries the label.
export const PURCHASE_QR_NOTE: string | undefined = AFFILIATE_DISCLOSURE;
