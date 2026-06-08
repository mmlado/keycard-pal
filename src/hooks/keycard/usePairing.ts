import { useCallback, useRef, useState } from 'react';
import { APDUException } from 'keycard-sdk/dist/apdu-exception';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { PAIRING_PASSWORD } from '@/constants/keycard';
import { savePairing } from '@/storage/pairingStorage';

export function usePairing() {
  const [waitingForPairingPassword, setWaitingForPairingPassword] =
    useState(false);
  const [pairingPasswordError, setPairingPasswordError] = useState<
    string | null
  >(null);
  const customPairingPasswordRef = useRef<string | null>(null);

  // Runs autoPair. Returns true on success (pairing saved), false if interrupted for password entry.
  const runAutoPair = useCallback(
    async (cmdSet: Commandset, uid: string): Promise<boolean> => {
      const password = customPairingPasswordRef.current;
      try {
        await cmdSet.autoPair(password ?? PAIRING_PASSWORD);
      } catch (e) {
        if (
          e instanceof APDUException &&
          e.message.includes('Invalid card cryptogram')
        ) {
          if (customPairingPasswordRef.current !== null) {
            setPairingPasswordError('Wrong pairing password. Try again.');
          }
          setWaitingForPairingPassword(true);
          return false;
        }
        if (
          e instanceof APDUException &&
          (e.message.includes('Pairing failed on step 1') ||
            e.message.includes('Pairing failed on step 2'))
        ) {
          throw new Error(
            'This Keycard has no free pairing slots. Use another device to unpair a slot first.',
          );
        }
        throw e;
      }
      const pairing = cmdSet.getPairing();
      console.log(
        `[Keycard] autoPair OK (index: ${pairing.pairingIndex}) — saving to storage`,
      );
      await savePairing(uid, pairing);
      return true;
    },
    [],
  );

  // Stores the custom password and calls onRestart to retry the NFC operation.
  const submitPairingPassword = useCallback(
    (password: string, onRestart: () => void) => {
      customPairingPasswordRef.current = password;
      setPairingPasswordError(null);
      setWaitingForPairingPassword(false);
      onRestart();
    },
    [],
  );

  const resetPairingState = useCallback(() => {
    setWaitingForPairingPassword(false);
    setPairingPasswordError(null);
    customPairingPasswordRef.current = null;
  }, []);

  return {
    waitingForPairingPassword,
    pairingPasswordError,
    runAutoPair,
    submitPairingPassword,
    resetPairingState,
  };
}
