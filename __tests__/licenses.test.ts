import { readFileSync } from 'fs';
import { join } from 'path';

import { APP_NAME } from '../src/constants/app';
import { LICENSE_TEXTS, licenses } from '../src/data/licenses';
import { onlineLicenses as offlineStub } from '../src/data/onlineLicenses.offline';
import { onlineLicenses } from '../src/data/onlineLicenses.online';

function installedLicense(name: string): string {
  const manifest = join(__dirname, '..', 'node_modules', name, 'package.json');
  return JSON.parse(readFileSync(manifest, 'utf8')).license;
}

describe('license list', () => {
  it('has a text for every license it names', () => {
    licenses.forEach(entry => {
      expect(LICENSE_TEXTS[entry.licenseType]).toBeTruthy();
    });
  });

  it('puts the app first and sorts the rest by package', () => {
    const [first, ...rest] = licenses.map(entry => entry.package);
    expect(first).toBe(APP_NAME);
    expect(rest).toEqual([...rest].sort());
  });

  it('lists each package once', () => {
    const names = licenses.map(entry => entry.package);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(onlineLicenses)(
    'lists online-only $package under the license it ships with',
    entry => {
      expect(licenses).toContainEqual(entry);
      expect(installedLicense(entry.package)).toBe(entry.licenseType);
    },
  );

  it('claims no online-only package in the offline build', () => {
    expect(offlineStub).toEqual([]);
  });
});
