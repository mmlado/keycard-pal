import { readFileSync } from 'fs';
import { join } from 'path';

import { KEYCARD_SUPPORT_STATEMENT } from '../src/constants/app';

const ROOT = join(__dirname, '..');

function read(...path: string[]): string {
  // Drop Markdown blockquote markers, which wrap a sentence across lines.
  return readFileSync(join(ROOT, ...path), 'utf8')
    .replace(/\n> ?/g, ' ')
    .replace(/\s+/g, ' ');
}

const surfaces: [string, string][] = [
  ['the About screen', KEYCARD_SUPPORT_STATEMENT],
  ['the README', read('README.md')],
  [
    'the Play and f-droid.org description',
    read('fastlane', 'metadata', 'android', 'en-US', 'full_description.txt'),
  ],
  [
    'the App Store description',
    read('fastlane', 'metadata', 'ios', 'en-US', 'description.txt'),
  ],
  [
    'the self-hosted F-Droid listing of the full build',
    read('fdroid', 'metadata', 'com.keycardpal.yml'),
  ],
  [
    'the self-hosted F-Droid listing of the offline build',
    read('fdroid', 'metadata', 'com.keycardpal.offline.yml'),
  ],
];

describe('the Keycard team support statement', () => {
  it.each(surfaces)(
    '%s says the Keycard team provided equipment',
    (_label, text) => {
      expect(text).toMatch(/The Keycard team has (also )?provided equipment/);
    },
  );

  // Keycard endorses the app publicly, so a denial would be false.
  it.each(surfaces)(
    '%s does not deny an affiliation or endorsement',
    (_label, text) => {
      expect(text).not.toMatch(/not (affiliated|endorsed)/i);
    },
  );

  it('puts no figure or currency in the About statement', () => {
    expect(KEYCARD_SUPPORT_STATEMENT).not.toMatch(/\d/);
    expect(KEYCARD_SUPPORT_STATEMENT).not.toMatch(/\p{Sc}/u);
  });
});
