import { render, screen } from '@testing-library/react-native';

import AffiliateDisclosure from '../src/components/AffiliateDisclosure';
import {
  AFFILIATE_DISCLOSURE,
  AFFILIATE_DISCLOSURE_SHORT,
} from '../src/constants/keycard';

describe('AffiliateDisclosure', () => {
  it('renders the full wording by default', () => {
    render(<AffiliateDisclosure />);

    expect(screen.getByText(AFFILIATE_DISCLOSURE)).toBeTruthy();
    expect(screen.getByTestId('affiliate-disclosure')).toBeTruthy();
  });

  it('renders the short wording when asked', () => {
    render(<AffiliateDisclosure short />);

    expect(screen.getByText(AFFILIATE_DISCLOSURE_SHORT)).toBeTruthy();
  });

  it('leads with the word Advertisement in both forms', () => {
    // Regulator guidance rejects "partnership", "sponsored" and the like, so
    // the first word is not a style choice.
    expect(AFFILIATE_DISCLOSURE.startsWith('Advertisement')).toBe(true);
    expect(AFFILIATE_DISCLOSURE_SHORT.startsWith('Advertisement')).toBe(true);
  });

  it('names the commission in both forms', () => {
    expect(AFFILIATE_DISCLOSURE).toMatch(/commission/i);
    expect(AFFILIATE_DISCLOSURE_SHORT).toMatch(/commission/i);
  });

  it('quotes no price, percentage or currency anywhere', () => {
    // A price turns a placement into an invitation to purchase, and the
    // coupon can change on builds that never auto-update.
    for (const copy of [AFFILIATE_DISCLOSURE, AFFILIATE_DISCLOSURE_SHORT]) {
      expect(copy).not.toMatch(/[\d%$€£]/);
    }
  });
});
