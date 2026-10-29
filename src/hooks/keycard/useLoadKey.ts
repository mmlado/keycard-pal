import { sha256 } from '@noble/hashes/sha2.js';
import { BIP32KeyPair } from 'keycard-sdk/dist/bip32key';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { deriveMnemonicSeed } from '@/utils/mnemonic';
import { useKeycardOp } from './useKeycardOperation';

// The card's key UID is the SHA-256 of its master public key.
function holdsKeyPair(keyUID: Uint8Array, keyPair: BIP32KeyPair): boolean {
  const uid = sha256(keyPair.publicKey);
  return keyUID.length === uid.length && uid.every((b, i) => b === keyUID[i]);
}

async function loadKeyPair(cmdSet: Commandset, keyPair: BIP32KeyPair) {
  const info = cmdSet.applicationInfo;
  if (info?.hasMasterKey()) {
    // A load lost after the card took it leaves this very key, so Try again has nothing left to do.
    if (holdsKeyPair(info.keyUID, keyPair)) {
      return;
    }
    throw new Error('Card already has a key. Factory reset required.');
  }
  const response = await cmdSet.loadBIP32KeyPair(keyPair);
  response.checkOK();
}

export function useLoadKey() {
  return useKeycardOp(loadKeyPair, {
    requiresPin: true,
    requiresMasterKey: false,
    successMessage: 'Key pair has been added to Keycard',
  });
}

export function deriveMnemonicKeyPair(
  words: string[],
  passphrase?: string,
): BIP32KeyPair {
  const seed = deriveMnemonicSeed(words, passphrase);
  return BIP32KeyPair.fromBinarySeed(seed);
}
