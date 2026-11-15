import { readdirSync } from 'fs';
import { join } from 'path';

import logoIndex from '../src/data/token-logos-index.json';
import tokensData from '../src/data/tokens.json';

const LOGOS_DIR = join(
  __dirname,
  '..',
  'android/app/src/offline/assets/token-logos',
);

const tokens = (
  tokensData as { tokens: { chainId: number; address: string }[] }
).tokens;

describe('bundled token data', () => {
  it('holds only Ethereum addresses, lowercased', () => {
    const others = tokens.filter(t => !/^0x[0-9a-f]{40}$/.test(t.address));
    expect(others).toEqual([]);
  });

  it('indexes a logo only for a bundled token', () => {
    const bundled = new Set(tokens.map(t => `${t.chainId}:${t.address}`));
    const orphans = Object.keys(logoIndex).filter(key => !bundled.has(key));
    expect(orphans).toEqual([]);
  });

  it('ships exactly the indexed logo files', () => {
    const indexed = Object.entries(logoIndex as Record<string, string>).map(
      ([key, ext]) => `${key.replace(':', '-')}.${ext}`,
    );
    expect(readdirSync(LOGOS_DIR).sort()).toEqual(indexed.sort());
  });
});
