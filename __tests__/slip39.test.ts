import { BIP32KeyPair } from 'keycard-sdk/dist/bip32key';

import {
  decodeSlip39ShareMetadata,
  generateSlip39SharesFromKeycardEntropy,
  getSlip39ShareProgress,
  previewSlip39ShareMetadata,
  recoverSlip39Secret,
  slip39SecretFromKeycardEntropy,
  slip39SecretToKeyPair,
} from '../src/utils/slip39';

const SHARES = [
  'very graduate academic acid best smith recall exclude apart company amount junior alive believe withdraw alien company hospital payroll lend',
  'very graduate academic agency dish traveler veteran facility hormone camera kind hearing debut carve either demand valuable diminish triumph treat',
  'very graduate academic always admit license float squeeze exercise fantasy maximum float dance always loyalty humidity manager guest carve remind',
];

describe('slip39 utilities', () => {
  it('decodes shell-compatible single-group share metadata', () => {
    const metadata = decodeSlip39ShareMetadata(SHARES[0]);

    expect(metadata.groupThreshold).toBe(1);
    expect(metadata.groupIndex).toBe(0);
    expect(metadata.memberThreshold).toBe(2);
  });

  it('previews share metadata from the first four words', () => {
    const metadata = previewSlip39ShareMetadata(
      SHARES[0].split(' ').slice(0, 4).join(' '),
    );

    expect(metadata).toMatchObject({
      groupThreshold: 1,
      groupIndex: 0,
      memberThreshold: 2,
    });
  });

  it('tracks share progress using the first share threshold', () => {
    const progress = getSlip39ShareProgress(SHARES.slice(0, 1));

    expect(progress.acceptedShares).toHaveLength(1);
    expect(progress.requiredShares).toBe(2);
    expect(progress.complete).toBe(false);
  });

  it('recovers a 16-byte SLIP39 secret', () => {
    const secret = recoverSlip39Secret(SHARES.slice(0, 2), 'TREZOR');

    expect(Buffer.from(secret).toString('utf8')).toBe('ABCDEFGHIJKLMNOP');
  });

  it('recovers from the threshold number of shares when extra shares are present', () => {
    const secret = recoverSlip39Secret(SHARES, 'TREZOR');

    expect(Buffer.from(secret).toString('utf8')).toBe('ABCDEFGHIJKLMNOP');
  });

  it('normalizes the passphrase to NFKD before recovery', () => {
    const secret = recoverSlip39Secret(SHARES.slice(0, 2), 'ＴＲＥＺＯＲ');

    expect(Buffer.from(secret).toString('utf8')).toBe('ABCDEFGHIJKLMNOP');
  });

  it('recovers the same secret from equivalent passphrase forms', () => {
    expect(recoverSlip39Secret(SHARES.slice(0, 2), 'caf\u00e9')).toEqual(
      recoverSlip39Secret(SHARES.slice(0, 2), 'cafe\u0301'),
    );
  });

  it('rejects duplicate shares', () => {
    expect(() => getSlip39ShareProgress([SHARES[0], SHARES[0]])).toThrow(
      /Duplicate SLIP39 share/,
    );
  });

  it('rejects non-20-word shares', () => {
    expect(() => decodeSlip39ShareMetadata('abandon abandon')).toThrow(
      /exactly 20 words/,
    );
  });

  it('derives generated SLIP39 shares from Keycard entropy like keycard-shell', () => {
    const entropy = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const shares = generateSlip39SharesFromKeycardEntropy(entropy, {
      shareCount: 3,
      threshold: 2,
    });
    const secret = slip39SecretFromKeycardEntropy(entropy);

    expect(recoverSlip39Secret(shares)).toEqual(secret);
    expect(shares).toHaveLength(3);
    expect(shares[0].split(' ')).toHaveLength(20);
  });

  it('rejects invalid generation threshold', () => {
    expect(() =>
      generateSlip39SharesFromKeycardEntropy(new Uint8Array(36), {
        shareCount: 3,
        threshold: 1,
      }),
    ).toThrow(/at least 2/);
  });

  it('derives the same BIP32 keypair as the Keycard SDK seed path', () => {
    const secret = recoverSlip39Secret(SHARES.slice(0, 2), 'TREZOR');

    const keyPair = slip39SecretToKeyPair(secret);

    expect(keyPair.privateKey).toEqual(
      BIP32KeyPair.fromBinarySeed(secret).privateKey,
    );
    expect(keyPair.chainCode).toEqual(
      BIP32KeyPair.fromBinarySeed(secret).chainCode,
    );
  });
});
