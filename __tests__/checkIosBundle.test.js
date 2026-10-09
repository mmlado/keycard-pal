const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  findMarkers,
  literal,
  main,
  markersFrom,
  run,
} = require('../scripts/check-ios-bundle');

const SCRIPT = path.resolve(__dirname, '../scripts/check-ios-bundle.js');
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

    it('refuses to pass when it cannot read the purchase link at all', () => {
      const { status, lines } = withBundle('var a=1;', file =>
        run(['--bundle', file], '/nope/no-such-purchase-link.ts'),
      );

      expect(status).toBe(1);
      expect(lines.join('\n')).toMatch(/checks nothing/);
    });

    it('fails when the bundle path is not a readable file', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ios-bundle-dir-'));
      try {
        expect(run(['--bundle', dir]).status).toBe(1);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
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

  describe('as a command', () => {
    // main() is what the CLI guard calls; exercised in-process so the routing
    // of lines to stdout or stderr is covered, then once more as a real child
    // process so the exit code is proven end to end.
    it('routes a clean result to stdout and returns 0', () => {
      const log = jest.fn();
      const error = jest.fn();
      const status = withBundle('var url="https://keycard.tech";', file =>
        main(['--bundle', file], { log, error }),
      );

      expect(status).toBe(0);
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/passed/));
      expect(error).not.toHaveBeenCalled();
    });

    it('writes to the console when no streams are given', () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const status = withBundle('var url="https://keycard.tech";', file =>
          main(['--bundle', file]),
        );

        expect(status).toBe(0);
        expect(log).toHaveBeenCalledWith(expect.stringMatching(/passed/));
        expect(error).not.toHaveBeenCalled();
      } finally {
        log.mockRestore();
        error.mockRestore();
      }
    });

    it('routes a failure to stderr and returns 1', () => {
      const log = jest.fn();
      const error = jest.fn();
      const status = withBundle(`var u="${sourceUrl}";`, file =>
        main(['--bundle', file], { log, error }),
      );

      expect(status).toBe(1);
      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(/must not ship on iOS/),
      );
      expect(log).not.toHaveBeenCalled();
    });

    it('exits 0 and prints to stdout when the bundle is clean', () => {
      const result = withBundle('var url="https://keycard.tech";', file =>
        spawnSync(process.execPath, [SCRIPT, '--bundle', file], {
          encoding: 'utf8',
        }),
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('passed');
    });

    it('exits 1 and prints to stderr when a marker is found', () => {
      const result = withBundle(`var u="${sourceUrl}";`, file =>
        spawnSync(process.execPath, [SCRIPT, '--bundle', file], {
          encoding: 'utf8',
        }),
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(sourceHost);
    });
  });
});
