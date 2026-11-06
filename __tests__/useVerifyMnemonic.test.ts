import { deriveMnemonicFingerprint } from '../src/hooks/keycard/useVerifyMnemonic';

const mockToBinarySeed = jest.fn<Buffer, any[]>(() => Buffer.from('seed'));
// Copies, because the seed and the key pair are zeroed once the fingerprint is taken.
let seedAtDerivation: Buffer | null = null;
const mockFromBinarySeed = jest.fn<unknown, any[]>((seed: Uint8Array) => {
  seedAtDerivation = Buffer.from(seed);
  return {
    privateKey: new Uint8Array(32).fill(1),
    chainCode: new Uint8Array(32).fill(2),
    publicKey: new Uint8Array([4, 1, 2]),
  };
});
const mockPubKeyFingerprint = jest.fn().mockReturnValue(0xdeadbeef);
jest.mock('keycard-sdk/dist/mnemonic', () => ({
  Mnemonic: { toBinarySeed: (...args: any[]) => mockToBinarySeed(...args) },
}));

jest.mock('keycard-sdk/dist/bip32key', () => ({
  BIP32KeyPair: {
    fromBinarySeed: (...args: any[]) => mockFromBinarySeed(...args),
  },
}));

jest.mock('@/utils/cryptoAccount', () => ({
  pubKeyFingerprint: (...args: any[]) => mockPubKeyFingerprint(...args),
}));

const WORDS = Array(12).fill('word');

describe('deriveMnemonicFingerprint', () => {
  beforeEach(() => {
    mockToBinarySeed.mockClear();
    mockFromBinarySeed.mockClear();
    seedAtDerivation = null;
    mockPubKeyFingerprint.mockClear();
    mockPubKeyFingerprint.mockReturnValue(0xdeadbeef);
  });

  it('derives the mnemonic fingerprint from words and passphrase', () => {
    const fingerprint = deriveMnemonicFingerprint(WORDS, 'secret');

    expect(fingerprint).toBe(0xdeadbeef);
    expect(mockToBinarySeed).toHaveBeenCalledWith(WORDS.join(' '), 'secret');
    expect(seedAtDerivation).toEqual(Buffer.from('seed'));
    expect(mockPubKeyFingerprint).toHaveBeenCalledWith(
      new Uint8Array([4, 1, 2]),
    );
  });

  it('zeroes the seed and the derived key pair', () => {
    deriveMnemonicFingerprint(WORDS);

    const seed: Buffer = mockToBinarySeed.mock.results[0].value;
    const keyPair = mockFromBinarySeed.mock.results[0].value;
    expect(seed.every(b => b === 0)).toBe(true);
    expect(keyPair.privateKey).toEqual(new Uint8Array(32));
    expect(keyPair.chainCode).toEqual(new Uint8Array(32));
  });

  it('normalizes Unicode before deriving the seed', () => {
    deriveMnemonicFingerprint(['あおぞら'], 'ＴＲＥＺＯＲ café');

    expect(mockToBinarySeed).toHaveBeenCalledWith(
      'あおそ\u3099ら',
      'TREZOR cafe\u0301',
    );
  });

  it('uses empty string passphrase when omitted', () => {
    deriveMnemonicFingerprint(WORDS);

    expect(mockToBinarySeed).toHaveBeenCalledWith(WORDS.join(' '), '');
  });
});
