import { useCallback, useRef } from 'react';

import {
  useKeycardOperation,
  UseKeycardOperation,
} from './useKeycardOperation';
import type { SecretType } from '../../navigation/types';

export type UseChangeSecretOperation = Omit<
  UseKeycardOperation<void>,
  'execute'
> & {
  start: (newSecret: string) => void;
};

/** Kept in step with ChangeSecretScreen's SecretConfig toasts — the sheet and
 *  the toast describe the same outcome and must not diverge. */
const SECRET_CHANGED_MESSAGE: Record<SecretType, string> = {
  pin: 'PIN changed',
  puk: 'PUK changed',
  pairing: 'Pairing secret changed',
};

export function useChangeSecret(
  secretType: SecretType,
): UseChangeSecretOperation {
  const newSecretRef = useRef('');

  const keycard = useKeycardOperation<void>();
  const { execute, ...rest } = keycard;

  const start = useCallback(
    (newSecret: string) => {
      newSecretRef.current = newSecret;
      execute(
        async cmdSet => {
          let resp;
          if (secretType === 'pin') {
            resp = await cmdSet.changePIN(newSecretRef.current);
          } else if (secretType === 'puk') {
            resp = await cmdSet.changePUK(newSecretRef.current);
          } else {
            resp = await cmdSet.changePairingPassword(newSecretRef.current);
          }
          newSecretRef.current = '';
          resp.checkOK();
        },
        {
          requiresMasterKey: false,
          // Only the pairing secret went away with newer cards. The screen
          // identifies the card first; this catches a different card being
          // tapped the second time.
          requiresRoute:
            secretType === 'pairing' ? 'ChangePairingSecret' : undefined,
          // Mirrors ChangeSecretScreen's per-secret done toast.
          successMessage: SECRET_CHANGED_MESSAGE[secretType],
        },
      );
    },
    [execute, secretType],
  );

  return { ...rest, start };
}
