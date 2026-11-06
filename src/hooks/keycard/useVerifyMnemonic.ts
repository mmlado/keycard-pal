import { BIP32KeyPair } from 'keycard-sdk/dist/bip32key';

import { pubKeyFingerprint } from '@/utils/cryptoAccount';
import { deriveMnemonicSeed } from '@/utils/mnemonic';
import { zeroKeyPair } from '@/utils/zeroize';

export function deriveMnemonicFingerprint(
  words: string[],
  passphrase = '',
): number {
  const seed = deriveMnemonicSeed(words, passphrase);
  let keyPair: BIP32KeyPair | undefined;
  try {
    keyPair = BIP32KeyPair.fromBinarySeed(seed);
    return pubKeyFingerprint(keyPair.publicKey);
  } finally {
    seed.fill(0);
    if (keyPair) {
      zeroKeyPair(keyPair);
    }
  }
}
