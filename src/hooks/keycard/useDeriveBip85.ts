import { Commandset } from 'keycard-sdk/dist/commandset';

import { bip85Format, bip85Path, type Bip85Format } from '@/utils/bip85';
import { useKeycardOp } from './useKeycardOperation';

export type Bip85Request = { format: Bip85Format; index: number };

export const UNEXPECTED_BIP85_LENGTH =
  'The Keycard answered with the wrong length. Try again.';

async function deriveBip85(
  cmdSet: Commandset,
  { format, index }: Bip85Request,
): Promise<Uint8Array> {
  const { bytes } = bip85Format(format);
  const response = await cmdSet.exportBIP85(bip85Path(format, index), bytes);
  response.checkOK();
  if (response.data.length !== bytes) {
    throw new Error(UNEXPECTED_BIP85_LENGTH);
  }
  return response.data;
}

export function useDeriveBip85() {
  // Read-only and deterministic: safe to re-run from SELECT on a re-tap.
  return useKeycardOp(deriveBip85, {
    requiresPin: true,
    requiresRoute: 'Bip85',
    retryOnTagLoss: true,
  });
}
