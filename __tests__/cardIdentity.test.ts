import { getCardKey, getKeyUid } from '../src/utils/cardIdentity';
import { toHex } from '../src/utils/hex';

import {
  blankV3Select,
  filler,
  v3Select,
  v4Select,
} from './selectResponse.testUtils';

const INSTANCE_UID = [
  0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xab, 0xac,
  0xad, 0xae, 0xaf,
];

// 33-byte identity key, then the CA's signature (64 bytes and a recovery id).
const IDENTITY_KEY = filler(33, 0x02);
const CERTIFICATE = [...IDENTITY_KEY, ...filler(65, 0x09)];

const SEED_KEY_UID = filler(32, 0x5e);

describe('getCardKey', () => {
  // Pairings are stored under the instance UID hex; a different string would orphan them.
  it('is exactly the instance UID hex on a 3.x card', () => {
    const appInfo = v3Select(0x0302, { instanceUID: INSTANCE_UID });
    expect(getCardKey(appInfo)).toBe(toHex(new Uint8Array(INSTANCE_UID)));
    expect(getCardKey(appInfo)).toBe('a0a1a2a3a4a5a6a7a8a9aaabacadaeaf');
  });

  it('is the card identity public key on a 4.0 card, without the CA signature', () => {
    const appInfo = v4Select(0x0400, { certificate: CERTIFICATE });
    expect(getCardKey(appInfo)).toBe('02'.repeat(33));
  });

  it('is null for an uninitialized 3.x card, which reports neither', () => {
    expect(getCardKey(blankV3Select())).toBeNull();
  });

  it('is null for a 4.0 card that carries no certificate', () => {
    expect(getCardKey(v4Select(0x0400, { certificate: null }))).toBeNull();
  });
});

describe('getKeyUid', () => {
  it('is the key UID hex when a key is loaded', () => {
    expect(getKeyUid(v3Select(0x0302, { keyUID: SEED_KEY_UID }))).toBe(
      '5e'.repeat(32),
    );
  });

  it('names the seed, not the card, so it matches across generations', () => {
    const onV3 = v3Select(0x0302, { keyUID: SEED_KEY_UID });
    const onV4 = v4Select(0x0400, { keyUID: SEED_KEY_UID });
    expect(getKeyUid(onV3)).toBe(getKeyUid(onV4));
  });

  it('is null when no key is loaded', () => {
    expect(getKeyUid(v3Select(0x0302, { keyUID: [] }))).toBeNull();
    expect(getKeyUid(v4Select(0x0400, { keyUID: [] }))).toBeNull();
  });

  it('is null for an uninitialized 3.x card', () => {
    expect(getKeyUid(blankV3Select())).toBeNull();
  });
});
