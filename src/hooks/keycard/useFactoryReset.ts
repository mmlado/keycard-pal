import { useCallback } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { useNFCOperation, UseNFCOperation } from './useNFCOperation';

export type UseFactoryResetOperation = UseNFCOperation<string>;

export function useFactoryReset(): UseFactoryResetOperation {
  return useNFCOperation(
    useCallback(async (cmdSet: Commandset) => {
      if (!cmdSet.applicationInfo?.initializedCard) {
        throw new Error('This card is already empty.');
      }
      await cmdSet.factoryReset();
      return '';
    }, []),
    { successMessage: 'Factory reset done' },
  );
}
