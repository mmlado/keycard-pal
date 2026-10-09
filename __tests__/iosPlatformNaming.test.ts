import { readFileSync } from 'fs';
import { join } from 'path';

import { ROOT, filesShipping, graphFor } from './platformGraph.testUtils';

/**
 * App Store guideline 2.3.10: an iOS app may not name another mobile platform,
 * in the binary or in its metadata. One sentence on the About screen did, and
 * nothing would have caught the next one.
 */

// Capitalised on purpose. `Platform.OS === 'android'` ships the lowercase
// string and is not a mention of anything.
const OTHER_PLATFORMS = [
  'Android',
  'Google Play',
  'Play Store',
  'F-Droid',
  'FDroid',
  'Obtainium',
  'sideload',
  'APK',
];

describe('naming other mobile platforms', () => {
  describe('in the iOS binary', () => {
    it.each(OTHER_PLATFORMS)('ships no string naming %s', term => {
      expect(filesShipping('ios', term)).toEqual([]);
    });

    it('reads a graph that actually has files in it', () => {
      // Without this, a broken graph helper would make every case above pass.
      expect(graphFor('ios').length).toBeGreaterThan(100);
    });

    it('leaves the Android build alone', () => {
      // The Android graph may say whatever it likes, and does.
      expect(filesShipping('android', 'android').length).toBeGreaterThan(0);
    });
  });

  describe('in the App Store listing', () => {
    const description = readFileSync(
      join(ROOT, 'fastlane', 'metadata', 'ios', 'en-US', 'description.txt'),
      'utf8',
    );

    it.each(OTHER_PLATFORMS)('names no %s', term => {
      expect(description).not.toContain(term);
    });

    it('is the listing it claims to be', () => {
      expect(description).toContain('Keycard Pal');
    });
  });
});
