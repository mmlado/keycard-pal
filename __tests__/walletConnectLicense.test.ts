import { readFileSync } from 'fs';
import { join } from 'path';

// Non-free from @reown/walletkit 1.2.11 and @walletconnect/core 2.21.9 on (ADR-0014).

const root = join(__dirname, '..');
const FREE_LICENSES = ['Apache-2.0', 'MIT'];
const SCOPED = /(?:^|\/)node_modules\/(@(?:reown|walletconnect)\/[^/]+)$/;

function readJson(rel: string) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

const lockedPaths = Object.keys(readJson('package-lock.json').packages).filter(
  path => SCOPED.test(path),
);

describe('WalletConnect packages stay on a free license', () => {
  it('finds the packages it is guarding', () => {
    const names = lockedPaths.map(path => SCOPED.exec(path)![1]);
    expect(names).toContain('@reown/walletkit');
    expect(names).toContain('@walletconnect/core');
    expect(names).toContain('@walletconnect/react-native-compat');
  });

  it.each(lockedPaths)('%s declares Apache-2.0 or MIT', path => {
    const { license } = readJson(join(path, 'package.json'));
    expect(FREE_LICENSES).toContain(license);
  });

  it.each([
    '@reown/walletkit',
    '@walletconnect/core',
    '@walletconnect/react-native-compat',
  ])('%s is pinned to an exact version', name => {
    const range = readJson('package.json').dependencies[name];
    expect(range).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
