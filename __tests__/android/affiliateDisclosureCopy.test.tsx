import { render, screen } from '@testing-library/react-native';

import AffiliateDisclosure from '../../src/components/AffiliateDisclosure';
import {
  AFFILIATE_DISCLOSURE,
  AFFILIATE_DISCLOSURE_SHORT,
} from '../../src/constants/purchaseLink';

/**
 * The Android arm, which is the only arm these rules can be stated on.
 *
 * The disclosure copy used to sit beside the component test in `__tests__/`,
 * but that project resolves modules the way Metro resolves the iOS bundle,
 * where `purchaseLink.ios.ts` exports no disclosure strings and
 * `AffiliateDisclosure.ios.tsx` renders null. There is no name to import and
 * no label to read there, and no amount of Platform.OS pinning changes that:
 * resolution decides, not runtime. So the wording rules live here, in the
 * project that resolves the files the affiliate link actually ships in.
 *
 * What is being defended is the legal shape of a paid placement, not a tone of
 * voice. Every rule below is load bearing on the builds that carry the coupon:
 * Android and the GitHub APKs, neither of which can be corrected after the
 * fact on a device that never goes online.
 */
describe('affiliate disclosure copy where the link pays a commission', () => {
  it('renders the full wording by default', () => {
    render(<AffiliateDisclosure />);

    expect(screen.getByText(AFFILIATE_DISCLOSURE)).toBeTruthy();
    expect(screen.getByTestId('affiliate-disclosure')).toBeTruthy();
  });

  it('renders the short wording when asked', () => {
    render(<AffiliateDisclosure short />);

    expect(screen.getByText(AFFILIATE_DISCLOSURE_SHORT)).toBeTruthy();
  });

  // Both forms are held to the same rules: the short one exists for rows and
  // sheets that cannot fit a sentence, not for surfaces that may disclose less.
  const forms: [string, string][] = [
    ['the full wording', AFFILIATE_DISCLOSURE],
    ['the short wording', AFFILIATE_DISCLOSURE_SHORT],
  ];

  it.each(forms)('leads %s with the word Advertisement', (_label, copy) => {
    // Regulator guidance rejects "partnership", "sponsored" and the like, so
    // the first word is not a style choice. It has to be the first word too:
    // a disclosure the reader reaches only at the end of the line has already
    // let them read the placement as neutral advice.
    expect(copy.startsWith('Advertisement')).toBe(true);
  });

  it.each(forms)('names the commission in %s', (_label, copy) => {
    // Saying "affiliate link" alone assumes the reader knows what that pays.
    // Naming the commission is what identifies who benefits from the tap.
    expect(copy).toMatch(/commission/i);
  });

  it.each(forms)(
    'quotes no price, percentage or currency in %s',
    (_label, copy) => {
      // A figure here would turn the placement into an invitation to purchase,
      // which carries a duty to publish the advertised trader's identity and
      // address that this app has no surface for. The coupon is also Status's
      // to change, and air-gapped builds and sideloaded APKs never auto-update,
      // so any number baked into this copy can outlive the offer it quotes on
      // devices that cannot be reached.
      expect(copy).not.toMatch(/\d/);
      expect(copy).not.toMatch(/%/);
      // \p{Sc} is every currency symbol, so a euro or yen sign fails this the
      // same way a dollar sign does, and the file itself stays ASCII.
      expect(copy).not.toMatch(/\p{Sc}/u);
    },
  );
});
