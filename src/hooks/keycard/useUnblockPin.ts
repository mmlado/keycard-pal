import { useCallback, useRef, useState } from 'react';
import { WrongPINException } from 'keycard-sdk/dist/apdu-exception';

import { attemptsLeft } from '@/utils/keycardErrors';
import {
  useKeycardOperation,
  type KeycardPhase,
  type UseKeycardOperation,
} from './useKeycardOperation';

export type UseUnblockPinOperation = Omit<
  UseKeycardOperation<void>,
  'execute'
> & {
  start: (puk: string, newPin: string) => void;
  /** The card refused the PUK and still has attempts left; the screen asks for it again. */
  pukError: string | null;
};

/** Keep equal to UnblockPinScreen's done toast. */
export const PIN_UNBLOCKED_MESSAGE = 'PIN unblocked';
export const PUK_BLOCKED_STATUS =
  'The PUK is blocked. This Keycard can only be factory reset, which erases its key.';
export const PIN_NOT_BLOCKED_STATUS =
  "This Keycard's PIN is not blocked. Nothing was changed.";

// The applet's answer to UNBLOCK PIN while the PIN still has attempts.
const SW_CONDITIONS_NOT_SATISFIED = 0x6985;

export function useUnblockPin(): UseUnblockPinOperation {
  const pukRef = useRef('');
  const newPinRef = useRef('');
  const [pukError, setPukError] = useState<string | null>(null);

  const { execute, phase: nfcPhase, ...rest } = useKeycardOperation<void>();

  const start = useCallback(
    (puk: string, newPin: string) => {
      pukRef.current = puk;
      newPinRef.current = newPin;
      setPukError(null);
      execute(
        async cmdSet => {
          const resp = await cmdSet.unblockPIN(
            pukRef.current,
            newPinRef.current,
          );
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
            // Dropped so that no retry can spend another attempt on the same digits.
            pukRef.current = '';
            const message = `PUK is not valid. ${attemptsLeft(attempts)}.`;
            setPukError(message);
            throw new Error(message);
          }
          pukRef.current = '';
          newPinRef.current = '';
        },
        {
          // The PIN is what is blocked. A key may or may not be on the card.
          requiresPin: false,
          requiresMasterKey: false,
          successMessage: PIN_UNBLOCKED_MESSAGE,
        },
      );
    },
    [execute],
  );

  // A refused PUK goes back to the pad, not to an error sheet whose Try again
  // would resend it.
  const phase: KeycardPhase =
    pukError !== null && nfcPhase === 'error' ? 'idle' : nfcPhase;

  return { ...rest, phase, start, pukError };
}
