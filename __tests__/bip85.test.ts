import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { HDKey } from '@scure/bip32';
import { KeyPath } from 'keycard-sdk/dist/key-path';

import {
  BIP85_FORMATS,
  BIP85_MAX_INDEX,
  bip85Format,
  bip85Path,
  type Bip85Format,
} from '../src/utils/bip85';
import { fromHex, toHex } from '../src/utils/hex';

// The BIP85 test vectors' root key.
const XPRV_TV =
  'xprv9s21ZrQH143K2LBWUUQRFXhucrQqBpKdRRxNVq2zBqsx8HVqFk2uYo8kmbaLLHRdqtQpUm98uKfu3vca1LqdGhUtyoFnCNkfmXRyPXLjbKb';

// What EXPORT BIP85 returns: the first `bytes` of the HMAC over the derived key.
function card(path: string, bytes: number): Uint8Array {
  const key = HDKey.fromExtendedKey(XPRV_TV).derive(path).privateKey!;
  return hmac(sha512, utf8ToBytes('bip-entropy-from-k'), key).slice(0, bytes);
}

function derive(format: Bip85Format, index: number): string | null {
  const { bytes, encode } = bip85Format(format);
  return encode(card(bip85Path(format, index), bytes));
}

// Secp256k1's group order: the first value that is not a private key.
const CURVE_ORDER = fromHex(
  'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
);

describe('bip85 formats', () => {
  it('lists the formats in menu order', () => {
    expect(BIP85_FORMATS).toEqual([
      'words12',
      'words18',
      'words24',
      'wif',
      'xprv',
      'hex32',
      'hex64',
      'password',
    ]);
  });

  // Written out, so a slip in the path template cannot pass against itself.
  it.each([
    ['words12', "m/83696968'/39'/0'/12'/7'", 16],
    ['words18', "m/83696968'/39'/0'/18'/7'", 24],
    ['words24', "m/83696968'/39'/0'/24'/7'", 32],
    ['wif', "m/83696968'/2'/7'", 32],
    ['xprv', "m/83696968'/32'/7'", 64],
    ['hex32', "m/83696968'/128169'/32'/7'", 32],
    ['hex64', "m/83696968'/128169'/64'/7'", 64],
    ['password', "m/83696968'/707764'/21'/7'", 64],
  ] as const)('derives %s at %s from %i bytes', (format, path, bytes) => {
    expect(bip85Path(format, 7)).toBe(path);
    expect(bip85Format(format).bytes).toBe(bytes);
  });

  it.each([-1, 2 ** 31, 1.5, NaN])('refuses index %p', index => {
    expect(() => bip85Path('hex32', index)).toThrow(/0 to 2147483647/);
  });

  it('accepts the highest hardened index', () => {
    expect(BIP85_MAX_INDEX).toBe(2147483647);
    expect(bip85Path('wif', BIP85_MAX_INDEX)).toBe(
      "m/83696968'/2'/2147483647'",
    );
  });

  // What EXPORT BIP85 receives: the SDK's encoding of the path, all hardened.
  it('reaches the card as hardened path components', () => {
    const { data } = new KeyPath(bip85Path('wif', BIP85_MAX_INDEX));
    expect(toHex(data)).toBe('84fd1d48' + '80000002' + 'ffffffff');
  });
});

// The test vectors of BIP85 itself, all at index 0.
describe('bip85 spec vectors', () => {
  it.each([
    [
      'words12',
      'girl mad pet galaxy egg matter matrix prison refuse sense ordinary nose',
    ],
    [
      'words18',
      'near account window bike charge season chef number sketch tomorrow ' +
        'excuse sniff circle vital hockey outdoor supply token',
    ],
    [
      'words24',
      'puppy ocean match cereal symbol another shed magic wrap hammer bulb ' +
        'intact gadget divorce twin tonight reason outdoor destroy simple ' +
        'truth cigar social volcano',
    ],
    ['wif', 'Kzyv4uF39d4Jrw2W7UryTHwZr1zQVNk4dAFyqE6BuMrMh1Za7uhp'],
    [
      'xprv',
      'xprv9s21ZrQH143K2srSbCSg4m4kLvPMzcWydgmKEnMmoZUurYuBuYG46c6P71UGXMzmri' +
        'LzCCBvKQWBUv3vPB3m1SATMhp3uEjXHJ42jFg7myX',
    ],
    [
      'hex64',
      '492db4698cf3b73a5a24998aa3e9d7fa96275d85724a91e71aa2d645442f8785' +
        '55d078fd1f1f67e368976f04137b1f7a0d19232136ca50c44614af72b5582a5c',
    ],
    ['password', 'dKLoepugzdVJvdL56ogNV'],
  ] as const)('%s', (format, expected) => {
    expect(derive(format, 0)).toBe(expected);
  });
});

// From bipsea, an independent implementation, at an index other than the
// spec's 0 and the BIP39 language's 0.
describe('bip85 at index 7', () => {
  it.each([
    [
      'words12',
      'champion receive cotton inflict put weekend caution awful verify ' +
        'helmet hedgehog twice',
    ],
    [
      'words18',
      'notable online donkey embody any genre pole purpose pride link betray ' +
        'raw frequent canvas stock betray pill arrive',
    ],
    [
      'words24',
      'mask license shadow raise muffin palm hidden doll creek luggage helmet ' +
        'avoid orient odor dice holiday like caught index solution ritual ' +
        'gauge razor bargain',
    ],
    ['wif', 'KzPhP9z3MMQB7EmJB7yPWTqjxD3jB8B8fYBtLE2yWZwfr9VJ57bw'],
    [
      'xprv',
      'xprv9s21ZrQH143K4TkbB1TdaGQx4mtJhpdBarMXvdavufaMHHE61nPnmEM2xK7zyJbgUx' +
        'JENhqUZWM9AtzkHddRn18gkBVWEqQYe365qXNiePM',
    ],
    [
      'hex32',
      '97754cbf30c2ac92284889d875cea616b4b3d2815c27e52498e0da1130a553ba',
    ],
    [
      'hex64',
      'f238c1fde123882792b386dd5bb3f67b155d94c5b700f25fa93beeaa04ff2034' +
        '51074575ab45030d0b0c30041b29fc027564326b60be2172bb5af74275e1786b',
    ],
    ['password', 'T+kGS2zn7ka3VpknablUY'],
  ] as const)('%s', (format, expected) => {
    expect(derive(format, 7)).toBe(expected);
  });
});

// Also from bipsea: the last hardened index, where an off-by-one or sign slip would show.
describe('bip85 at the highest index', () => {
  it.each([
    ['wif', 'KxLtNEze3htrHWWT2gfSDqcjqHm5CcjcfkMX5KP4hgVakN9cX72x'],
    [
      'words12',
      'analyst bomb describe rebel fragile crime rely proud gorilla bring ' +
        'head glance',
    ],
  ] as const)('%s', (format, expected) => {
    expect(derive(format, BIP85_MAX_INDEX)).toBe(expected);
  });
});

// BIP85: such bytes are no key, and the user moves on to the next index.
describe('bip85 invalid keys', () => {
  it.each([
    ['zero', new Uint8Array(32)],
    ['the curve order', CURVE_ORDER],
  ])('gives no WIF for %s', (_, key) => {
    expect(bip85Format('wif').encode(key)).toBeNull();
  });

  it.each([
    ['zero', new Uint8Array(32)],
    ['the curve order', CURVE_ORDER],
  ])('gives no XPRV for a key of %s', (_, key) => {
    const entropy = new Uint8Array(64);
    entropy.fill(1, 0, 32);
    entropy.set(key, 32);
    expect(bip85Format('xprv').encode(entropy)).toBeNull();
  });

  it('reads the XPRV key from the second half', () => {
    const entropy = new Uint8Array(64);
    entropy.fill(1, 32);
    expect(bip85Format('xprv').encode(entropy)).toMatch(/^xprv/);
  });
});

describe('bip85 rows', () => {
  it.each(BIP85_FORMATS)('describes %s', format => {
    const row = bip85Format(format);
    expect(row.section.length).toBeGreaterThan(0);
    expect(row.label.length).toBeGreaterThan(0);
    expect(row.title.length).toBeGreaterThan(0);
    expect(row.icon).toBeTruthy();
  });

  it('lays out only the recovery phrases as words', () => {
    expect(
      BIP85_FORMATS.filter(format => bip85Format(format).layout === 'words'),
    ).toEqual(['words12', 'words18', 'words24']);
  });
});
