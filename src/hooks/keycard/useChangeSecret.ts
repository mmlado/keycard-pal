import { useCallback, useRef } from 'react';

import type { SecretType } from '@/navigation/types';

import {
  useKeycardOperation,
  UseKeycardOperation,
} from './useKeycardOperation';

export type UseChangeSecretOperation = Omit<
  UseKeycardOperation<void>,
  'execute'
> & {
  start: (newSecret: string) => void;
};

/** Keep equal to ChangeSecretScreen's toasts. */
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
          // Catches a different card being tapped the second time.
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
