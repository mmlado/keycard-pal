export const PAIRING_PASSWORD = new Uint8Array([
  0x67, 0x5d, 0xea, 0xbb, 0x0d, 0x7c, 0x72, 0x4b, 0x4a, 0x36, 0xca, 0xad, 0x0e,
  0x28, 0x08, 0x26, 0x15, 0x9e, 0x89, 0x88, 0x6f, 0x70, 0x82, 0x53, 0x5d, 0x43,
  0x1e, 0x92, 0x48, 0x48, 0xbc, 0xf1,
]);

// Affiliate link (applies a coupon on the shop side); deliberately not the
// bare get-keycard URL Status Legacy uses. It pays the developer a commission
// on each sale, which makes every surface that shows it a paid placement:
// never render it without an adjacent <AffiliateDisclosure />, or the app is
// hidden advertising (Zakon o oglašavanju čl. 12; UCPD art. 7(2)).
export const KEYCARD_PURCHASE_URL = 'https://get.keycard.tech/vuxxnf';

export const BUY_KEYCARD_LABEL = 'Buy a Keycard';

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

// Keycard CA public key — compressed secp256k1
// Source: https://github.com/keycard-tech/keycard-shell/blob/master/app/storage/keys.c (_KEYCARD_CA_PUB)
export const KEYCARD_CA_PUBLIC_KEY = new Uint8Array([
  0x02, 0x9a, 0xb9, 0x9e, 0xe1, 0xe7, 0xa7, 0x1b, 0xdf, 0x45, 0xb3, 0xf9, 0xc5,
  0x8c, 0x99, 0x86, 0x6f, 0xf1, 0x29, 0x4d, 0x2c, 0x1e, 0x30, 0x4e, 0x22, 0x8a,
  0x86, 0xe1, 0x0c, 0x33, 0x43, 0x50, 0x1c,
]);
