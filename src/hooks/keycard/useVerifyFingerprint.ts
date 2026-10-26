import Keycard from 'keycard-sdk';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { pubKeyFingerprint } from '@/utils/cryptoAccount';
import { useKeycardOp } from './useKeycardOperation';

export type VerifyFingerprintResult = 'match' | 'mismatch';

async function compareFingerprint(
  cmdSet: Commandset,
  expectedFingerprint: number,
): Promise<VerifyFingerprintResult> {
  const resp = await cmdSet.exportKey(0, true, 'm', false);
  resp.checkOK();
  const cardFingerprint = pubKeyFingerprint(
    Keycard.BIP32KeyPair.fromTLV(resp.data).publicKey,
  );
  return expectedFingerprint === cardFingerprint ? 'match' : 'mismatch';
}

export function useVerifyFingerprint() {
  // Read-only master-key export: safe to re-run from SELECT on a re-tap.
  return useKeycardOp(compareFingerprint, {
    requiresPin: true,
    retryOnTagLoss: true,
    // Either outcome: the tap did its job, and the result screen gives the answer.
    successMessage: 'Compared with Keycard',
  });
}
