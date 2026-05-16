import { useCallback, useRef } from 'react';

import {
  mergeKeycardNameMetadata,
  validateKeycardName,
} from '../../utils/keycardName';
import { useKeycardOp } from './useKeycardOperation';

export function useSetCardName() {
  const nameRef = useRef('');

  const { start: startOp, ...rest } = useKeycardOp<void>(
    useCallback(async (cmdSet, { setStatus }) => {
      const dataResp = await cmdSet.getData(0x00);
      if (dataResp.sw !== 0x9000) {
        throw new Error(
          `GET DATA failed: 0x${dataResp.sw.toString(16).toUpperCase()}`,
        );
      }
      setStatus('Writing card name...');
      const metadata = mergeKeycardNameMetadata(nameRef.current, dataResp.data);
      const resp = await cmdSet.storeData(metadata, 0x00);
      if (resp.sw !== 0x9000) {
        throw new Error(
          `STORE DATA failed: 0x${resp.sw.toString(16).toUpperCase()}`,
        );
      }
    }, []),
    { requiresPin: true, requiresMasterKey: false },
  );

  const start = useCallback(
    (name: string) => {
      validateKeycardName(name);
      nameRef.current = name;
      startOp();
    },
    [startOp],
  );

  return { ...rest, start };
}
