import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The two store listings say different things, and the iOS one is edited by
 * hand in App Store Connect from whatever is here. The obvious mistake is to
 * copy the Play text across, which would put an affiliate declaration on a
 * build that carries no affiliate link and contradict the non-trader
 * declaration the listing sits under. That is what this catches.
 *
 * The Play listing must keep its declaration for the opposite reason: the
 * Android builds do earn a commission, so leaving it out would be the
 * undisclosed placement the app has always been careful not to be.
 */

const ROOT = join(__dirname, '..');

function listing(platform: 'android' | 'ios', file: string): string {
  return readFileSync(
    join(ROOT, 'fastlane', 'metadata', platform, 'en-US', file),
    'utf8',
  );
}

describe('store listings', () => {
  describe('the Play listing', () => {
    const description = listing('android', 'full_description.txt');

    it('declares the affiliate links as an advertisement', () => {
      expect(description).toMatch(/Advertisement:/);
      expect(description).toMatch(/affiliate link/i);
      expect(description).toMatch(/commission/i);
    });
  });

  describe('the App Store listing', () => {
    const description = listing('ios', 'description.txt');

    it('claims no affiliate link, because the build carries none', () => {
      expect(description).not.toMatch(/affiliate/i);
      expect(description).not.toMatch(/commission/i);
      expect(description).not.toMatch(/advertisement/i);
    });

    // The shop URL and its coupon are spelled out rather than imported from
    // `constants/purchaseLink`, which resolves to a different URL per platform:
    // an import would pin whatever twin this run resolved, and this listing has
    // to stay clear of the Android one in particular. The bare product domain
    // is not listed here on purpose, because the test below requires it.
    it('carries no referral code', () => {
      expect(description).not.toContain('get.keycard.tech');
      expect(description).not.toContain('vuxxnf');
    });

    it('still names the hardware the app needs', () => {
      expect(description).toMatch(/Requires a Keycard/);
      expect(description).toContain('keycard.tech');
    });
  });
});
