const { Buffer } = require('buffer');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  FORBIDDEN_MARKERS,
  findMarkers,
} = require('../scripts/check-offline-bundle');

const SCRIPT = path.resolve(__dirname, '../scripts/check-offline-bundle.js');
const SRC = path.resolve(__dirname, '../src');

function runOnBundle(content, ...flags) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-bundle-'));
  const filePath = path.join(dir, 'index.android.bundle');
  fs.writeFileSync(filePath, content);
  try {
    return spawnSync(
      process.execPath,
      [SCRIPT, '--bundle', filePath, ...flags],
      { encoding: 'utf8' },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
    expect(result.stdout).toContain('passed');
  });

  it.each(FORBIDDEN_MARKERS)('fails on a bundle containing %s', marker => {
    const result = runOnBundle(`var s="${marker}";`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(marker);
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
      expect(result.stderr).toContain(stale);
    });
  });

  it('fails without --bundle or --apk', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage');
  });

  it('fails when the bundle does not exist', () => {
    const result = spawnSync(
      process.execPath,
      [SCRIPT, '--bundle', '/nonexistent/bundle.js'],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
  });
});
