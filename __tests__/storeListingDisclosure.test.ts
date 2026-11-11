import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), 'utf8');
}

// The Description block only: the per-version Ads entries name the releases that carried the link.
function fdroidDescription(appId: string): string {
  const yml = read('fdroid', 'metadata', `${appId}.yml`);
  const block = yml.slice(yml.indexOf('Description: |'));
  const end = block.search(/\n\S/);
  return end === -1 ? block : block.slice(0, end);
}

const LISTINGS: [string, string][] = [
  [
    'the Play listing',
    read('fastlane', 'metadata', 'android', 'en-US', 'full_description.txt'),
  ],
  [
    'the App Store listing',
    read('fastlane', 'metadata', 'ios', 'en-US', 'description.txt'),
  ],
  ['the F-Droid full listing', fdroidDescription('com.keycardpal')],
  ['the F-Droid offline listing', fdroidDescription('com.keycardpal.offline')],
];

describe.each(LISTINGS)('%s', (_name, description) => {
  it('claims no affiliate link, because no build carries one', () => {
    expect(description).not.toMatch(/affiliate/i);
    expect(description).not.toMatch(/commission/i);
    expect(description).not.toMatch(/advertisement/i);
    expect(description).not.toContain('get.keycard.tech');
    expect(description).not.toContain('vuxxnf');
  });
});

it('the store listings still name the hardware the app needs', () => {
  for (const [, description] of LISTINGS.slice(0, 2)) {
    expect(description).toMatch(/Requires a Keycard/);
    expect(description).toContain('keycard.tech');
  }
});
