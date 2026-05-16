import Keycard from 'keycard-sdk';
import { useCallback, useRef } from 'react';

import { pubKeyFingerprint } from '../../utils/cryptoAccount';
import { useKeycardOp } from './useKeycardOperation';

export type VerifyFingerprintResult = 'match' | 'mismatch';

export function useVerifyFingerprint() {
  const expectedRef = useRef(0);

  const { start: startOp, ...rest } = useKeycardOp<VerifyFingerprintResult>(
    useCallback(async cmdSet => {
      const resp = await cmdSet.exportKey(0, true, 'm', false);
      resp.checkOK();
      const cardFingerprint = pubKeyFingerprint(
        Keycard.BIP32KeyPair.fromTLV(resp.data).publicKey,
      );
      return expectedRef.current === cardFingerprint ? 'match' : 'mismatch';
    }, []),
    { requiresPin: true },
  );

  const start = useCallback(
    (expectedFingerprint: number) => {
      expectedRef.current = expectedFingerprint;
      startOp();
    },
    [startOp],
  );

  return { ...rest, start };
}
