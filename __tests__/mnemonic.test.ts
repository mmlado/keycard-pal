import { deriveMnemonicSeed } from '../src/utils/mnemonic';

const WORDS = [...Array(11).fill('abandon'), 'about'];

describe('deriveMnemonicSeed', () => {
  it('matches the BIP39 ASCII test vector', () => {
    expect(
      Buffer.from(deriveMnemonicSeed(WORDS, 'TREZOR')).toString('hex'),
    ).toBe(
      'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e5349553' +
        '1f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
    );
  });

  it('matches the Japanese normalization vector linked by BIP39', () => {
    // https://github.com/bip32JP/bip32JP.github.io/blob/master/test_JP_BIP39.json
    const words = [...Array(11).fill('あいこくしん'), 'あおぞら'];
    expect(
      Buffer.from(
        deriveMnemonicSeed(words, '㍍ガバヴァぱばぐゞちぢ十人十色'),
      ).toString('hex'),
    ).toBe(
      'a262d6fb6122ecf45be09c50492b31f92e9beb7d9a845987a02cefda57a15f9c4' +
        '67a17872029a9e92299b5cbdf306e3a0ee620245cbd508959b6cb7ca637bd55',
    );
  });

  it.each([
    ['café', 'cafe\u0301'],
    ['ガバ', 'カ\u3099ハ\u3099'],
    ['ＴＲＥＺＯＲ', 'TREZOR'],
    ['㍍', 'メートル'],
  ])('derives identical seeds for equivalent passphrases %s and %s', (a, b) => {
    expect(deriveMnemonicSeed(WORDS, a)).toEqual(deriveMnemonicSeed(WORDS, b));
  });

  it('uses an empty passphrase when omitted', () => {
    expect(deriveMnemonicSeed(WORDS)).toEqual(deriveMnemonicSeed(WORDS, ''));
  });

  it('preserves passphrase whitespace and case', () => {
    const seed = deriveMnemonicSeed(WORDS, 'TREZOR');
    expect(deriveMnemonicSeed(WORDS, ' TREZOR ')).not.toEqual(seed);
    expect(deriveMnemonicSeed(WORDS, 'trezor')).not.toEqual(seed);
  });
});
