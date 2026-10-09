const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  DEFAULT_PACKAGES,
  main,
  missingPackages,
  parseArgs,
  versionNameFromTag,
} = require('../scripts/check-fdroid-index');

const index = versionsByPackage => ({
  packages: Object.fromEntries(
    Object.entries(versionsByPackage).map(([id, names]) => [
      id,
      {
        versions: Object.fromEntries(
          names.map((versionName, i) => [
            `sha${i}`,
            { manifest: { versionName, versionCode: 1 } },
          ]),
        ),
      },
    ]),
  ),
});

function withIndex(contents, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdroid-index-'));
  const file = path.join(dir, 'index-v2.json');
  fs.writeFileSync(file, JSON.stringify(contents));
  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('check-fdroid-index', () => {
  it('strips the v from a release tag', () => {
    expect(versionNameFromTag('v1.13.0')).toBe('1.13.0');
    expect(versionNameFromTag('1.13.0')).toBe('1.13.0');
  });

  it('expects both application ids by default', () => {
    expect(DEFAULT_PACKAGES).toEqual([
      'com.keycardpal',
      'com.keycardpal.offline',
    ]);
  });

  it('passes when every package carries the release', () => {
    const idx = index({
      'com.keycardpal': ['1.13.0', '1.12.0'],
      'com.keycardpal.offline': ['1.12.0', '1.13.0'],
    });
    expect(missingPackages(idx, '1.13.0')).toEqual([]);
  });

  it('names every package that lacks the release', () => {
    const idx = index({
      'com.keycardpal': ['1.8.0'],
      'com.keycardpal.offline': ['1.8.0'],
    });
    expect(missingPackages(idx, '1.13.0')).toEqual([
      'com.keycardpal',
      'com.keycardpal.offline',
    ]);
  });

  it('names only the package that lacks it', () => {
    const idx = index({
      'com.keycardpal': ['1.13.0'],
      'com.keycardpal.offline': ['1.12.0'],
    });
    expect(missingPackages(idx, '1.13.0')).toEqual(['com.keycardpal.offline']);
  });

  it('counts a package absent from the index as missing', () => {
    const idx = index({ 'com.keycardpal.offline': ['1.13.0'] });
    expect(missingPackages(idx, '1.13.0')).toEqual(['com.keycardpal']);
    expect(missingPackages({}, '1.13.0')).toEqual(DEFAULT_PACKAGES);
  });

  it('checks only the packages it is given', () => {
    const idx = index({ 'com.keycardpal.offline': ['1.13.0'] });
    expect(missingPackages(idx, '1.13.0', ['com.keycardpal.offline'])).toEqual(
      [],
    );
  });
});

describe('parseArgs', () => {
  it('reads the index, the tag and a package list', () => {
    expect(
      parseArgs([
        '--index',
        'repo/index-v2.json',
        '--tag',
        'v1.13.0',
        '--packages',
        'a,b,',
      ]),
    ).toEqual({
      index: 'repo/index-v2.json',
      tag: 'v1.13.0',
      packages: ['a', 'b'],
    });
  });

  it('leaves out what was not given and ignores unknown flags', () => {
    expect(parseArgs(['--tag', 'v1.0.0', '--verbose'])).toEqual({
      tag: 'v1.0.0',
    });
    expect(parseArgs([])).toEqual({});
  });
});

describe('main', () => {
  let error;
  let log;

  beforeEach(() => {
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    error.mockRestore();
    log.mockRestore();
  });

  it('returns 2 and prints usage without an index or a tag', () => {
    expect(main(['--tag', 'v1.13.0'])).toBe(2);
    expect(main(['--index', 'x.json'])).toBe(2);
    expect(error).toHaveBeenCalledTimes(2);
    expect(error.mock.calls[0][0]).toMatch(/^Usage:/);
  });

  it('returns 0 when the index carries the release for both ids', () => {
    const idx = index({
      'com.keycardpal': ['1.13.0'],
      'com.keycardpal.offline': ['1.13.0', '1.12.0'],
    });
    const status = withIndex(idx, file =>
      main(['--index', file, '--tag', 'v1.13.0']),
    );
    expect(status).toBe(0);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        'carries 1.13.0 for com.keycardpal, com.keycardpal.offline',
      ),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('returns 1 and names the packages that lack the release', () => {
    const idx = index({
      'com.keycardpal': ['1.8.0'],
      'com.keycardpal.offline': ['1.8.0'],
    });
    const status = withIndex(idx, file =>
      main(['--index', file, '--tag', 'v1.13.0']),
    );
    expect(status).toBe(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(
        /1\.13\.0 is missing from .* for: com\.keycardpal, com\.keycardpal\.offline$/,
      ),
    );
    expect(log).not.toHaveBeenCalled();
  });

  it('checks only the packages given on the command line', () => {
    const idx = index({ 'com.keycardpal.offline': ['1.13.0'] });
    const status = withIndex(idx, file =>
      main([
        '--index',
        file,
        '--tag',
        'v1.13.0',
        '--packages',
        'com.keycardpal.offline',
      ]),
    );
    expect(status).toBe(0);
  });
});
