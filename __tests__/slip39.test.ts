import { BIP32KeyPair } from 'keycard-sdk/dist/bip32key';
import Slip39 from 'slip39';

import {
  decodeSlip39ShareMetadata,
  generateSlip39SharesFromKeycardEntropy,
  getSlip39ShareProgress,
  parseSlip39Share,
  previewSlip39ShareMetadata,
  recoverSlip39Secret,
  slip39SecretFromKeycardEntropy,
  slip39SecretToKeyPair,
} from '../src/utils/slip39';

// Passes through, so a test can reach the digest it returned.
jest.mock('@noble/hashes/sha2.js', () => {
  const actual = jest.requireActual('@noble/hashes/sha2.js');
  return {
    ...actual,
    sha256: Object.assign(
      jest.fn((...args: unknown[]) => actual.sha256(...args)),
      actual.sha256,
    ),
  };
});

const { sha256: mockSha256 } = jest.requireMock('@noble/hashes/sha2.js');

const SHARES = [
  'very graduate academic acid best smith recall exclude apart company amount junior alive believe withdraw alien company hospital payroll lend',
  'very graduate academic agency dish traveler veteran facility hormone camera kind hearing debut carve either demand valuable diminish triumph treat',
  'very graduate academic always admit license float squeeze exercise fantasy maximum float dance always loyalty humidity manager guest carve remind',
];

describe('slip39 utilities', () => {
  it('normalizes a share as typed', () => {
    expect(parseSlip39Share(`  ${SHARES[0].toUpperCase()}\n`)).toBe(SHARES[0]);
  });

  it('asks for a share when nothing is entered', () => {
    expect(() => parseSlip39Share('  ')).toThrow('Enter a SLIP39 share');
  });

  it('names the first word that is not a SLIP39 word', () => {
    expect(() =>
      parseSlip39Share(SHARES[0].replace('graduate', 'nope')),
    ).toThrow('"nope" is not a valid SLIP39 word');
  });

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

  describe('refusals', () => {
    it('rejects a share whose checksum fails', () => {
      expect(() =>
        decodeSlip39ShareMetadata(SHARES[0].replace(/lend$/, 'acid')),
      ).toThrow('Invalid SLIP39 share checksum.');
    });

    it('rejects shares from another backup', () => {
      const entropy = new Uint8Array([1]);
      let other = generateSlip39SharesFromKeycardEntropy(entropy, {
        shareCount: 2,
        threshold: 2,
      })[0];
      // The identifier is random; draw again on the rare collision.
      while (
        decodeSlip39ShareMetadata(other).identifier ===
        decodeSlip39ShareMetadata(SHARES[0]).identifier
      ) {
        other = generateSlip39SharesFromKeycardEntropy(entropy, {
          shareCount: 2,
          threshold: 2,
        })[0];
      }

      expect(() => getSlip39ShareProgress([SHARES[0], other])).toThrow(
        'SLIP39 share identifier does not match.',
      );
    });

    it('asks for at least one share', () => {
      expect(() => getSlip39ShareProgress([])).toThrow(
        'Add at least one SLIP39 share.',
      );
    });

    it('asks for the shares still missing', () => {
      expect(() => recoverSlip39Secret([SHARES[0]])).toThrow(
        'Add 1 more SLIP39 share(s).',
      );
    });

    it.each([
      [{ shareCount: 2.5, threshold: 2 }, /must be numbers/],
      [{ shareCount: 17, threshold: 2 }, /between 1 and 16/],
      [{ shareCount: 3, threshold: 4 }, /between 1 and share count/],
    ])('rejects generation arguments %j', (args, message) => {
      expect(() =>
        generateSlip39SharesFromKeycardEntropy(new Uint8Array(36), args),
      ).toThrow(message);
    });

    it('refuses a secret of another length as a key pair', () => {
      expect(() => slip39SecretToKeyPair(new Uint8Array(32))).toThrow(
        'Unsupported SLIP39 secret length.',
      );
    });
  });

  describe('zeroing', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    function isZero(bytes: ArrayLike<number>) {
      return Array.from(bytes).every(b => b === 0);
    }

    it('zeroes the whole entropy digest, not only the secret taken from it', () => {
      mockSha256.mockClear();

      const secret = slip39SecretFromKeycardEntropy(new Uint8Array([1, 2, 3]));

      expect(isZero(mockSha256.mock.results[0].value)).toBe(true);
      expect(isZero(secret)).toBe(false);
    });

    it('zeroes the master secret handed to the slip39 package', () => {
      const fromArray = jest.spyOn(Slip39, 'fromArray');

      const shares = generateSlip39SharesFromKeycardEntropy(
        new Uint8Array([1, 2, 3, 4, 5, 6]),
        { shareCount: 3, threshold: 2 },
      );

      expect(isZero(fromArray.mock.calls[0][0])).toBe(true);
      expect(shares).toHaveLength(3);
    });

    it('zeroes the secret the slip39 package recovers', () => {
      const recoverSecret = jest.spyOn(Slip39, 'recoverSecret');

      const secret = recoverSlip39Secret(SHARES.slice(0, 2), 'TREZOR');

      expect(isZero(recoverSecret.mock.results[0].value)).toBe(true);
      expect(Buffer.from(secret).toString('utf8')).toBe('ABCDEFGHIJKLMNOP');
    });

    it('zeroes a recovered secret of a length it refuses', () => {
      const recovered = new Array(32).fill(7);
      jest.spyOn(Slip39, 'recoverSecret').mockReturnValue(recovered);

      expect(() => recoverSlip39Secret(SHARES.slice(0, 2), 'TREZOR')).toThrow(
        /Unsupported SLIP39 secret length/,
      );
      expect(isZero(recovered)).toBe(true);
    });
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
