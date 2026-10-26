import { useCallback, useState } from 'react';
import { WrongPINException } from 'keycard-sdk/dist/apdu-exception';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { attemptsLeft } from '@/utils/keycardErrors';
import {
  useKeycardOp,
  type KeycardOp,
  type KeycardOperationHelpers,
  type KeycardPhase,
} from './useKeycardOperation';

export type UseUnblockPinOperation = Omit<KeycardOp<void>, 'start'> & {
  start: (puk: string, newPin: string) => void;
  /** The card refused the PUK and still has attempts left; the screen asks for it again. */
  pukError: string | null;
};

export const PIN_UNBLOCKED_MESSAGE = 'PIN unblocked';
export const PUK_BLOCKED_STATUS =
  'The PUK is blocked. This Keycard can only be factory reset, which erases its key.';
export const PIN_NOT_BLOCKED_STATUS =
  "This Keycard's PIN is not blocked. Nothing was changed.";

// The applet's answer to UNBLOCK PIN while the PIN still has attempts.
const SW_CONDITIONS_NOT_SATISFIED = 0x6985;

interface UnblockInput {
  puk: string;
  newPin: string;
}

export function useUnblockPin(): UseUnblockPinOperation {
  const [pukError, setPukError] = useState<string | null>(null);

  const {
    start: startOp,
    phase: nfcPhase,
    ...rest
  } = useKeycardOp(
    useCallback(
      async (
        cmdSet: Commandset,
        { puk, newPin }: UnblockInput,
        { discardInput }: KeycardOperationHelpers,
      ) => {
        const resp = await cmdSet.unblockPIN(puk, newPin);
        if (resp.sw === SW_CONDITIONS_NOT_SATISFIED) {
          throw new Error(PIN_NOT_BLOCKED_STATUS);
        }
        try {
          resp.checkAuthOK();
        } catch (e) {
          if (!(e instanceof WrongPINException)) {
            throw e;
          }
          const attempts = e.getRetryAttempts();
          if (attempts === 0) {
            throw new Error(PUK_BLOCKED_STATUS);
          }
          // No retry may spend another attempt on the same digits.
          discardInput();
          const message = `PUK is not valid. ${attemptsLeft(attempts)}.`;
          setPukError(message);
          throw new Error(message);
        }
      },
      [],
    ),
    {
      // The PIN is what is blocked. A key may or may not be on the card.
      requiresPin: false,
      requiresMasterKey: false,
      successMessage: PIN_UNBLOCKED_MESSAGE,
    },
  );

  const start = useCallback(
    (puk: string, newPin: string) => {
      setPukError(null);
      startOp({ puk, newPin });
    },
    [startOp],
  );

  // A refused PUK goes back to the pad: Try again has nothing left to send.
  const phase: KeycardPhase =
    pukError !== null && nfcPhase === 'error' ? 'idle' : nfcPhase;

  return { ...rest, phase, start, pukError };
}
