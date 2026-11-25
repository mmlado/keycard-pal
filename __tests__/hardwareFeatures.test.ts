import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

function manifest(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

function features(xml: string): Map<string, string | undefined> {
  const declared = new Map<string, string | undefined>();
  for (const [, attributes] of xml.matchAll(/<uses-feature\s([^>]*)\/>/g)) {
    const name = /android:name="([^"]+)"/.exec(attributes)?.[1];
    if (name) {
      declared.set(name, /android:required="([^"]+)"/.exec(attributes)?.[1]);
    }
  }
  return declared;
}

const APP_MANIFESTS = ['main', 'full', 'offline', 'debug']
  .map(source => `android/app/src/${source}/AndroidManifest.xml`)
  .filter(path => existsSync(join(ROOT, path)));

describe('hardware features', () => {
  it('requires NFC', () => {
    expect(
      features(manifest('android/app/src/main/AndroidManifest.xml')).get(
        'android.hardware.nfc',
      ),
    ).toBe('true');
  });

  it('requires no other feature it declares', () => {
    const required = APP_MANIFESTS.flatMap(path =>
      [...features(manifest(path))]
        .filter(([, value]) => value !== 'false')
        .map(([name]) => name),
    );
    expect(required).toEqual(['android.hardware.nfc']);
  });

  it('keeps Wi-Fi optional where netinfo asks for the Wi-Fi state', () => {
    const netinfo = manifest(
      'node_modules/@react-native-community/netinfo/android/src/main/AndroidManifest.xml',
    );
    expect(netinfo).toContain('android.permission.ACCESS_WIFI_STATE');
    expect(
      features(manifest('android/app/src/full/AndroidManifest.xml')).get(
        'android.hardware.wifi',
      ),
    ).toBe('false');
  });
});
