import type { BIP32KeyPair } from 'keycard-sdk/dist/bip32key';

// The public key is a separate buffer and stays usable.
export function zeroKeyPair(keyPair: BIP32KeyPair) {
  keyPair.privateKey.fill(0);
  keyPair.chainCode.fill(0);
}
