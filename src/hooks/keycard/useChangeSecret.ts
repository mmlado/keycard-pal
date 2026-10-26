import { useCallback } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';

import type { SecretType } from '@/navigation/types';

import { useKeycardOp, type KeycardOp } from './useKeycardOperation';

export type UseChangeSecretOperation = KeycardOp<void, string>;

const SECRET_CHANGED_MESSAGE: Record<SecretType, string> = {
  pin: 'PIN changed',
  puk: 'PUK changed',
  pairing: 'Pairing secret changed',
};

function sendNewSecret(
  cmdSet: Commandset,
  secretType: SecretType,
  newSecret: string,
) {
  if (secretType === 'pin') {
    return cmdSet.changePIN(newSecret);
  }
  if (secretType === 'puk') {
    return cmdSet.changePUK(newSecret);
  }
  return cmdSet.changePairingPassword(newSecret);
}

export function useChangeSecret(
  secretType: SecretType,
): UseChangeSecretOperation {
  return useKeycardOp(
    useCallback(
      async (cmdSet: Commandset, newSecret: string) => {
        const resp = await sendNewSecret(cmdSet, secretType, newSecret);
        resp.checkOK();
      },
      [secretType],
    ),
    {
      requiresMasterKey: false,
      // Catches a different card being tapped the second time.
      requiresRoute:
        secretType === 'pairing' ? 'ChangePairingSecret' : undefined,
      successMessage: SECRET_CHANGED_MESSAGE[secretType],
    },
  );
}
