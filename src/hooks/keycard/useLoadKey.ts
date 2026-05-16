import { useCallback, useRef } from 'react';
import { BIP32KeyPair } from 'keycard-sdk/dist/bip32key';
import { Mnemonic } from 'keycard-sdk/dist/mnemonic';

import { useKeycardOp } from './useKeycardOperation';

export function useLoadKey() {
  const keyPairRef = useRef<BIP32KeyPair | null>(null);

  const clearKeyPair = useCallback(() => {
    keyPairRef.current = null;
  }, []);

  const {
    start: startOp,
    cancel: cancelOp,
    reset: resetOp,
    ...rest
  } = useKeycardOp<void>(
    useCallback(async cmdSet => {
      const appInfo = cmdSet.applicationInfo;
      if (appInfo?.hasMasterKey()) {
        throw new Error('Card already has a key. Factory reset required.');
      }
      try {
        const response = await cmdSet.loadBIP32KeyPair(keyPairRef.current!);
        response.checkOK();
      } finally {
        keyPairRef.current = null;
      }
    }, []),
    { requiresPin: true, requiresMasterKey: false },
  );

  const start = useCallback(
    (keyPair: BIP32KeyPair) => {
      keyPairRef.current = keyPair;
      startOp();
    },
    [startOp],
  );

  const cancel = useCallback(() => {
    clearKeyPair();
    cancelOp();
  }, [clearKeyPair, cancelOp]);

  const reset = useCallback(() => {
    clearKeyPair();
    resetOp();
  }, [clearKeyPair, resetOp]);

  return { ...rest, start, cancel, reset };
}

export function deriveMnemonicKeyPair(
  words: string[],
  passphrase?: string,
): BIP32KeyPair {
  const phrase = words.join(' ');
  const seed = Mnemonic.toBinarySeed(phrase, passphrase);
  return BIP32KeyPair.fromBinarySeed(seed);
}
