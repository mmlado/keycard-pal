import { BIP32KeyPair } from 'keycard-sdk/dist/bip32key';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { deriveMnemonicSeed } from '@/utils/mnemonic';
import { useKeycardOp } from './useKeycardOperation';

async function loadKeyPair(cmdSet: Commandset, keyPair: BIP32KeyPair) {
  if (cmdSet.applicationInfo?.hasMasterKey()) {
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
