const {
  DEFAULT_PACKAGES,
  missingPackages,
  versionNameFromTag,
} = require('../scripts/check-fdroid-index');

const index = (versionsByPackage) => ({
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

describe('check-fdroid-index', () => {
  it('strips the v from a release tag', () => {
    expect(versionNameFromTag('v1.13.0')).toBe('1.13.0');
    expect(versionNameFromTag('1.13.0')).toBe('1.13.0');
  });

  it('expects both application ids by default', () => {
    expect(DEFAULT_PACKAGES).toEqual(['com.keycardpal', 'com.keycardpal.offline']);
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
    expect(missingPackages(idx, '1.13.0', ['com.keycardpal.offline'])).toEqual([]);
  });
});
