const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  findMarkers,
  literal,
  markersFrom,
  run,
} = require('../scripts/check-ios-bundle');

const PURCHASE_LINK = path.resolve(
  __dirname,
  '../src/constants/purchaseLink.ts',
);

function withBundle(content, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ios-bundle-'));
  const file = path.join(dir, 'ios.bundle');
  fs.writeFileSync(file, content);
  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runOnBundle(content) {
  return withBundle(content, file => run(['--bundle', file]));
}

describe('check-ios-bundle', () => {
  const source = fs.readFileSync(PURCHASE_LINK, 'utf8');
  // Fixtures follow the source: a legitimate referral-code change should not
  // fail these, and should not quietly leave them checking a dead code.
  const sourceUrl = literal(source, 'KEYCARD_PURCHASE_URL');
  const sourceHost = new URL(sourceUrl).host;
  const sourceCode = new URL(sourceUrl).pathname
    .split('/')
    .filter(Boolean)
    .pop();

  describe('what it looks for', () => {
    // The referral code is Status's to change. Written down here, this check
    // would keep passing against a code that no longer ships while the new
    // one sat in the bundle, so the markers are read from the source instead.
    it('derives the markers from the Android purchase link', () => {
      const markers = markersFrom(source);

      expect(markers).toContain('https://get.keycard.tech/vuxxnf');
      expect(markers).toContain('get.keycard.tech');
      expect(markers).toContain('vuxxnf');
      expect(markers.some(m => m.startsWith('Advertisement'))).toBe(true);
    });

    it('follows the source when the affiliate URL changes', () => {
      const moved = source.replace(
        'https://get.keycard.tech/vuxxnf',
        'https://shop.example/abc123',
      );

      const markers = markersFrom(moved);

      expect(markers).toContain('shop.example');
      expect(markers).toContain('abc123');
      expect(markers).not.toContain('vuxxnf');
    });

    it('reads a constant written over two lines', () => {
      expect(literal("export const A =\n  'value';", 'A')).toBe('value');
    });

    it('does not mistake a longer name for a shorter one', () => {
      // AFFILIATE_DISCLOSURE must not match AFFILIATE_DISCLOSURE_SHORT.
      const both = [
        "export const A_SHORT = 'short';",
        "export const A = 'long';",
      ].join('\n');

      expect(literal(both, 'A')).toBe('long');
      expect(literal(both, 'A_SHORT')).toBe('short');
    });
  });

  describe('what it does with a bundle', () => {
    it('passes a bundle carrying only the product site', () => {
      const { status, lines } = runOnBundle(
        'var url="https://keycard.tech";var label="keycard.tech";',
      );

      expect(status).toBe(0);
      expect(lines.join('\n')).toMatch(/passed/);
    });

    it.each([
      ['the affiliate URL', `var u="${sourceUrl}";`],
      ['the bare shop host', `var u="${sourceHost}";`],
      ['the referral code alone', `var u="/${sourceCode}";`],
      [
        'the disclosure copy',
        'var t="Advertisement: affiliate link, pays the developer a commission.";',
      ],
      // Neither exact string, so only the bare word catches it.
      ['a relabelled disclosure', 'var t="Advertisement: sponsored link";'],
    ])('fails a bundle carrying %s', (_label, content) => {
      const { status, lines } = runOnBundle(content);

      expect(status).toBe(1);
      expect(lines.join('\n')).toMatch(/must not ship on iOS/);
    });

    it('names every marker it found, not just the first', () => {
      const { lines } = runOnBundle(
        `var u="${sourceUrl}";var t="Advertisement: affiliate link. The developer earns a commission if you buy a Keycard.";`,
      );

      const report = lines.join('\n');
      expect(report).toContain(sourceHost);
      expect(report).toContain(sourceCode);
      expect(report).toMatch(/Advertisement/);
    });
  });

  describe('when it cannot do its job', () => {
    // A check that quietly stops checking is worse than no check at all.
    it('refuses to pass when the purchase link cannot be read', () => {
      expect(() => markersFrom('export const SOMETHING_ELSE = 1;')).toThrow(
        /KEYCARD_PURCHASE_URL/,
      );
    });

    it('refuses to pass when the URL carries no referral code', () => {
      const bare = source.replace(
        'https://get.keycard.tech/vuxxnf',
        'https://get.keycard.tech',
      );

      expect(() => markersFrom(bare)).toThrow(/referral code/);
    });

    it('refuses to pass when the disclosure copy is missing', () => {
      const stripped = source.replace('AFFILIATE_DISCLOSURE_SHORT', 'GONE');

      expect(() => markersFrom(stripped)).toThrow(/AFFILIATE_DISCLOSURE_SHORT/);
    });

    it('fails on a missing bundle rather than reporting success', () => {
      const { status } = run(['--bundle', '/nope/does-not-exist.bundle']);

      expect(status).toBe(1);
    });

    it('fails without the --bundle flag', () => {
      expect(run([]).status).toBe(1);
    });
  });

  it('matches markers as substrings of the bundle', () => {
    expect(findMarkers('abc-needle-def', ['needle'])).toEqual(['needle']);
    expect(findMarkers('nothing here', ['needle'])).toEqual([]);
  });
});
