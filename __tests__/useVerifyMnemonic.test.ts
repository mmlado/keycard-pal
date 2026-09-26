import { deriveMnemonicFingerprint } from '../src/hooks/keycard/useVerifyMnemonic';

const mockToBinarySeed = jest.fn().mockReturnValue(Buffer.from('seed'));
const mockFromBinarySeed = jest
  .fn()
  .mockReturnValue({ publicKey: new Uint8Array([4, 1, 2]) });
const mockPubKeyFingerprint = jest.fn().mockReturnValue(0xdeadbeef);
jest.mock('keycard-sdk/dist/mnemonic', () => ({
  Mnemonic: { toBinarySeed: (...args: any[]) => mockToBinarySeed(...args) },
}));

jest.mock('keycard-sdk/dist/bip32key', () => ({
  BIP32KeyPair: {
    fromBinarySeed: (...args: any[]) => mockFromBinarySeed(...args),
  },
}));

jest.mock('../src/utils/cryptoAccount', () => ({
  pubKeyFingerprint: (...args: any[]) => mockPubKeyFingerprint(...args),
}));

const WORDS = Array(12).fill('word');

describe('deriveMnemonicFingerprint', () => {
  beforeEach(() => {
    mockToBinarySeed.mockClear();
    mockFromBinarySeed.mockClear();
    mockPubKeyFingerprint.mockClear();
    mockPubKeyFingerprint.mockReturnValue(0xdeadbeef);
  });

  it('derives the mnemonic fingerprint from words and passphrase', () => {
    const fingerprint = deriveMnemonicFingerprint(WORDS, 'secret');

    expect(fingerprint).toBe(0xdeadbeef);
    expect(mockToBinarySeed).toHaveBeenCalledWith(WORDS.join(' '), 'secret');
    expect(mockFromBinarySeed).toHaveBeenCalledWith(Buffer.from('seed'));
    expect(mockPubKeyFingerprint).toHaveBeenCalledWith(
      new Uint8Array([4, 1, 2]),
    );
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
