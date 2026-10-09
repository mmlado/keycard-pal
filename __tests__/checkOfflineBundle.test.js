const { Buffer } = require('buffer');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  BUNDLE_ENTRY,
  FORBIDDEN_MARKERS,
  findMarkers,
  run,
} = require('../scripts/check-offline-bundle');
const { buildZip } = require('./zipFixture.testUtils');

const SCRIPT = path.resolve(__dirname, '../scripts/check-offline-bundle.js');
const SRC = path.resolve(__dirname, '../src');

function withFile(name, content, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-bundle-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content);
  try {
    return fn(filePath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runOnBundle(content, ...flags) {
  return withFile('index.android.bundle', content, file =>
    run(['--bundle', file, ...flags]),
  );
}

function runOnApk(entries, ...flags) {
  return withFile('app.apk', buildZip(entries), file =>
    run(['--apk', file, ...flags]),
  );
}

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('check-offline-bundle', () => {
  it('passes on a bundle without forbidden markers', () => {
    const result = runOnBundle('var x=1;console.log("hello");');
    expect(result.status).toBe(0);
    expect(result.lines.join('\n')).toContain('passed');
  });

  it.each(FORBIDDEN_MARKERS)('fails on a bundle containing %s', marker => {
    const result = runOnBundle(`var s="${marker}";`);
    expect(result.status).toBe(1);
    expect(result.lines).toContain(`  - ${marker}`);
  });

  it('finds a marker inside binary content', () => {
    const bytecode = Buffer.concat([
      Buffer.from([0xc6, 0x1f, 0xbc, 0x03, 0x00, 0xff]),
      Buffer.from('api.tenderly.co'),
      Buffer.from([0x00, 0xfe]),
    ]);
    expect(findMarkers(bytecode)).toEqual(['api.tenderly.co']);
  });

  it('accepts names the offline stubs share with their online twins', () => {
    const result = runOnBundle(
      'function EnsSettingsSection(){return null}' +
        'function WalletConnectSettingsSection(){return null}',
    );
    expect(result.status).toBe(0);
  });

  it('has no marker that an offline stub contains', () => {
    const stubs = sourceFiles(SRC)
      .filter(file => /\.offline\.tsx?$/.test(file))
      .map(file => fs.readFileSync(file, 'utf8'));
    expect(stubs.length).toBeGreaterThan(0);
    FORBIDDEN_MARKERS.forEach(marker => {
      expect(stubs.some(text => text.includes(marker))).toBe(false);
    });
  });

  it('does not import package.json anywhere in src', () => {
    const importers = sourceFiles(SRC).filter(file =>
      /from\s+['"][^'"]*package\.json['"]|require\([^)]*package\.json/.test(
        fs.readFileSync(file, 'utf8'),
      ),
    );
    expect(importers).toEqual([]);
  });

  describe('--expect-present', () => {
    it('passes when every marker is in the bundle', () => {
      const result = runOnBundle(
        FORBIDDEN_MARKERS.join('\n'),
        '--expect-present',
      );
      expect(result.status).toBe(0);
    });

    it('names the markers that have gone stale', () => {
      const [stale, ...rest] = FORBIDDEN_MARKERS;
      const result = runOnBundle(rest.join('\n'), '--expect-present');
      expect(result.status).toBe(1);
      expect(result.lines).toEqual([expect.any(String), `  - ${stale}`]);
    });
  });

  describe('--apk', () => {
    it('reads the bundle out of the APK', () => {
      const result = runOnApk([
        { name: 'classes.dex', data: 'dex' },
        { name: BUNDLE_ENTRY, data: 'x="RNCNetInfo"' },
      ]);
      expect(result.status).toBe(1);
      expect(result.lines).toContain('  - RNCNetInfo');
    });

    it('fails on an APK without a JS bundle', () => {
      const result = runOnApk([{ name: 'classes.dex', data: 'dex' }]);
      expect(result.status).toBe(1);
      expect(result.lines[0]).toContain(BUNDLE_ENTRY);
    });

    it('fails on a file that is not a zip', () => {
      const result = withFile('app.apk', 'not a zip', file =>
        run(['--apk', file]),
      );
      expect(result.status).toBe(1);
      expect(result.lines[0]).toContain('Could not read');
    });
  });

  describe('arguments', () => {
    it.each([
      ['neither --bundle nor --apk', []],
      ['both', ['--bundle', 'a', '--apk', 'b']],
      ['a flag without a value', ['--bundle']],
    ])('prints the usage for %s', (_, argv) => {
      const result = run(argv);
      expect(result.status).toBe(1);
      expect(result.lines[0]).toContain('Usage');
    });

    it('fails when the file does not exist', () => {
      const result = run(['--bundle', '/nonexistent/bundle.js']);
      expect(result.status).toBe(1);
      expect(result.lines[0]).toContain('Not found');
    });
  });

  describe('as a command', () => {
    it('exits 0 and prints to stdout when the bundle is clean', () => {
      const result = withFile('index.android.bundle', 'var x=1;', file =>
        spawnSync(process.execPath, [SCRIPT, '--bundle', file], {
          encoding: 'utf8',
        }),
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('passed');
    });

    it('exits 1 and prints to stderr when a marker is found', () => {
      const result = withFile('index.android.bundle', 'RNCNetInfo', file =>
        spawnSync(process.execPath, [SCRIPT, '--bundle', file], {
          encoding: 'utf8',
        }),
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('RNCNetInfo');
    });
  });
});
