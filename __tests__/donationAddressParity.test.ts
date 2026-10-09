import { readFileSync } from 'fs';
import { join } from 'path';

import {
  DONATION_INTRO,
  DONATION_STANDING_LINE,
  DONATION_TITLE,
} from '../src/components/about/Donation/copy';

/**
 * The donation addresses exist twice: on the About screen and in DONATE.md,
 * which the repository's Sponsor button points at (#298). Two copies that
 * drift would send money to an address the developer no longer holds, so this
 * asserts DONATE.md lists exactly the addresses the app shows.
 *
 * The standing line exists twice for the same reason, and drifted first: the
 * app went on saying "Buy me a coffee ... helps keep the project maintained"
 * long after DONATE.md said nothing is given in return (#355). So the line is
 * held equal too, and the copy is held to the shape a gift has to have.
 *
 * It also pins the two things FUNDING.yml may not carry: a GitHub Sponsors
 * entry (its terms forbid raising funds involving cryptocurrency) and the
 * Keycard purchase URL (an affiliate link, and GitHub excludes funding links
 * used for advertising).
 */

const root = join(__dirname, '..');

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

/** Markdown wraps sentences across lines; compare them as prose. */
function prose(markdown: string): string {
  return markdown.replace(/\s+/g, ' ');
}

const ADDRESS_PATTERN = /'(0x[0-9a-fA-F]{40}|bc1[0-9a-z]{20,})'/g;

describe('donation addresses', () => {
  const listSource = read('src/components/about/Donation/List.tsx');
  const donateDoc = read('DONATE.md');
  const inAppAddresses = [...listSource.matchAll(ADDRESS_PATTERN)].map(
    match => match[1],
  );

  it('the About screen still lists an Ethereum and a Bitcoin address', () => {
    expect(inAppAddresses).toHaveLength(2);
  });

  it.each(inAppAddresses)('DONATE.md lists %s', address => {
    expect(donateDoc).toContain(address);
  });

  it('DONATE.md adds no address the app does not show', () => {
    const documented = [
      ...donateDoc.matchAll(/`(0x[0-9a-fA-F]{40}|bc1[0-9a-z]{20,})`/g),
    ].map(match => match[1]);
    expect(documented.sort()).toEqual([...inAppAddresses].sort());
  });

  it('DONATE.md carries the standing line the app shows, word for word', () => {
    expect(prose(donateDoc)).toContain(DONATION_STANDING_LINE);
    expect(prose(donateDoc)).toContain(DONATION_INTRO);
  });

  it('DONATE.md warns that a transfer is public and permanent', () => {
    expect(donateDoc).toMatch(/visible to\s+anyone and permanent/);
  });

  it('README points at DONATE.md instead of restating the addresses', () => {
    const readme = read('README.md');
    expect(readme).toContain('DONATE.md');
    inAppAddresses.forEach(address => {
      expect(readme).not.toContain(address);
    });
  });
});

describe('donation copy', () => {
  it('names the section without a purchase verb', () => {
    expect(DONATION_TITLE).not.toMatch(/\b(buy|purchase|shop|order)\b/i);
  });

  it('ties the gift to nothing', () => {
    // A donation "connected to or associated at any point in time with
    // receiving digital content or services" stops being a gift.
    for (const copy of [DONATION_INTRO, DONATION_STANDING_LINE]) {
      // "developer" is who receives it and is fine; "development" is a purpose.
      expect(copy).not.toMatch(
        /maintain|development|developing|feature|keep the project|support|continue|goal|target|campaign/i,
      );
    }
  });

  it('says it is voluntary and that nothing is given in return', () => {
    expect(DONATION_STANDING_LINE).toMatch(/entirely voluntary/);
    expect(DONATION_STANDING_LINE).toMatch(/nothing in the app is unlocked/i);
    expect(DONATION_STANDING_LINE).toMatch(/in return\.$/);
  });
});

describe('F-Droid metadata', () => {
  const bitcoinAddress = [
    ...read('src/components/about/Donation/List.tsx').matchAll(ADDRESS_PATTERN),
  ]
    .map(match => match[1])
    .find(address => address.startsWith('bc1'));

  it.each([
    'fdroiddata-com.keycardpal.yml',
    'fdroiddata-com.keycardpal.offline.yml',
    'fdroid/metadata/com.keycardpal.yml',
    'fdroid/metadata/com.keycardpal.offline.yml',
  ])('%s carries the Bitcoin address the app shows', file => {
    expect(read(file)).toMatch(new RegExp(`^Bitcoin: ${bitcoinAddress}$`, 'm'));
  });
});

describe('FUNDING.yml', () => {
  const funding = read('.github/FUNDING.yml');

  it('points the Sponsor button at DONATE.md', () => {
    expect(funding).toContain('DONATE.md');
  });

  it('declares no GitHub Sponsors account', () => {
    expect(funding).not.toMatch(/^\s*github:/m);
  });

  // Spelled out rather than imported from `constants/purchaseLink`, which now
  // resolves to a different URL per platform: importing it would only ever
  // pin whichever twin this run happened to resolve, and a funding file is one
  // file for every build. What has to be absent is any Keycard shop pointer at
  // all, affiliate or bare, so all three spellings are named here.
  it('carries no affiliate link', () => {
    expect(funding).not.toContain('get.keycard.tech');
    expect(funding).not.toContain('vuxxnf');
    expect(funding).not.toContain('keycard.tech');
  });
});
