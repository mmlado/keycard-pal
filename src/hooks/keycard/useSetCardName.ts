import { useCallback } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';

import {
  mergeKeycardNameMetadata,
  validateKeycardName,
} from '@/utils/keycardName';
import {
  useKeycardOp,
  type KeycardOperationHelpers,
} from './useKeycardOperation';

async function writeCardName(
  cmdSet: Commandset,
  name: string,
  { setStatus }: KeycardOperationHelpers,
) {
  const dataResp = await cmdSet.getData(0x00);
  if (dataResp.sw !== 0x9000) {
    throw new Error(
      `GET DATA failed: 0x${dataResp.sw.toString(16).toUpperCase()}`,
    );
  }
  setStatus('Writing card name...');
  const metadata = mergeKeycardNameMetadata(name, dataResp.data);
  const resp = await cmdSet.storeData(metadata, 0x00);
  if (resp.sw !== 0x9000) {
    throw new Error(
      `STORE DATA failed: 0x${resp.sw.toString(16).toUpperCase()}`,
    );
  }
}

export function useSetCardName() {
  const { start: startOp, ...rest } = useKeycardOp(writeCardName, {
    requiresPin: true,
    requiresMasterKey: false,
    successMessage: 'Card name updated',
  });

  const start = useCallback(
    (name: string) => {
      validateKeycardName(name);
      startOp(name);
    },
    [startOp],
  );

  return { ...rest, start };
}
