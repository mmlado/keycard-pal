const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  RETIRED_MARKERS,
  findMarkers,
  main,
  run,
} = require('../scripts/check-affiliate-markers');

const SCRIPT = path.resolve(__dirname, '../scripts/check-affiliate-markers.js');
const AFFILIATE_URL = 'https://get.keycard.tech/vuxxnf';

function withBundle(content, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'affiliate-markers-'));
  const file = path.join(dir, 'index.bundle');
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

describe('check-affiliate-markers', () => {
  it('looks for the shop host, the referral code and the label', () => {
    expect(RETIRED_MARKERS).toEqual([
      'get.keycard.tech',
      'vuxxnf',
      'Advertisement',
    ]);
  });

  describe('what it does with a bundle', () => {
    it('passes a bundle carrying only the product site', () => {
      const { status, lines } = runOnBundle(
        'var url="https://keycard.tech";var label="keycard.tech";',
      );

      expect(status).toBe(0);
      expect(lines.join('\n')).toMatch(/none of the 3/);
    });

    it.each([
      ['the affiliate URL', `var u="${AFFILIATE_URL}";`],
      ['the bare shop host', 'var u="get.keycard.tech";'],
      ['the referral code alone', 'var u="/vuxxnf";'],
      ['an Advertisement label', 'var t="Advertisement: sponsored link";'],
    ])('fails a bundle carrying %s', (_label, content) => {
      const { status, lines } = runOnBundle(content);

      expect(status).toBe(1);
      expect(lines.join('\n')).toMatch(/retired affiliate link/);
    });

    it('names every marker it found, not just the first', () => {
      const report = runOnBundle(
        `var u="${AFFILIATE_URL}";var t="Advertisement";`,
      ).lines.join('\n');

      expect(report).toContain('get.keycard.tech');
      expect(report).toContain('vuxxnf');
      expect(report).toContain('Advertisement');
    });
  });

  describe('when it cannot do its job', () => {
    it('fails when the bundle path is not a readable file', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'affiliate-dir-'));
      try {
        expect(run(['--bundle', dir]).status).toBe(1);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('fails on a missing bundle rather than reporting success', () => {
      expect(run(['--bundle', '/nope/does-not-exist.bundle']).status).toBe(1);
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
    it('routes a clean result to stdout and returns 0', () => {
      const log = jest.fn();
      const error = jest.fn();
      const status = withBundle('var url="https://keycard.tech";', file =>
        main(['--bundle', file], { log, error }),
      );

      expect(status).toBe(0);
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/none of the/));
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
        expect(log).toHaveBeenCalledWith(expect.stringMatching(/none of the/));
        expect(error).not.toHaveBeenCalled();
      } finally {
        log.mockRestore();
        error.mockRestore();
      }
    });

    it('routes a failure to stderr and returns 1', () => {
      const log = jest.fn();
      const error = jest.fn();
      const status = withBundle(`var u="${AFFILIATE_URL}";`, file =>
        main(['--bundle', file], { log, error }),
      );

      expect(status).toBe(1);
      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(/retired affiliate link/),
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
      expect(result.stdout).toContain('none of the');
    });

    it('exits 1 and prints to stderr when a marker is found', () => {
      const result = withBundle(`var u="${AFFILIATE_URL}";`, file =>
        spawnSync(process.execPath, [SCRIPT, '--bundle', file], {
          encoding: 'utf8',
        }),
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('get.keycard.tech');
    });
  });
});
