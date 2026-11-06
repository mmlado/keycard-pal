import { BIP32KeyPair } from 'keycard-sdk/dist/bip32key';

import { pubKeyFingerprint } from '@/utils/cryptoAccount';
import { deriveMnemonicSeed } from '@/utils/mnemonic';
import { zeroKeyPair } from '@/utils/zeroize';

export function deriveMnemonicFingerprint(
  words: string[],
  passphrase = '',
): number {
  const seed = deriveMnemonicSeed(words, passphrase);
  try {
    const keyPair = BIP32KeyPair.fromBinarySeed(seed);
    const fingerprint = pubKeyFingerprint(keyPair.publicKey);
    zeroKeyPair(keyPair);
    return fingerprint;
  } finally {
    seed.fill(0);
  }
}
