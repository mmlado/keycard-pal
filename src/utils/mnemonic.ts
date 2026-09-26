import { Mnemonic } from 'keycard-sdk/dist/mnemonic';

export function deriveMnemonicSeed(words: string[], passphrase?: string) {
  // BIP39 requires NFKD for both inputs; keycard-sdk does not normalize them.
  return Mnemonic.toBinarySeed(
    words.join(' ').normalize('NFKD'),
    passphrase?.normalize('NFKD'),
  );
}
