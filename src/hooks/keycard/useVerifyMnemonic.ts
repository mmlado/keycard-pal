import { BIP32KeyPair } from 'keycard-sdk/dist/bip32key';

import { pubKeyFingerprint } from '../../utils/cryptoAccount';
import { deriveMnemonicSeed } from '../../utils/mnemonic';

export function deriveMnemonicFingerprint(
  words: string[],
  passphrase = '',
): number {
  const seed = deriveMnemonicSeed(words, passphrase);
  const masterKeyPair = BIP32KeyPair.fromBinarySeed(seed);
  return pubKeyFingerprint(masterKeyPair.publicKey);
}
