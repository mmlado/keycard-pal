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
    // Reads on Apple's sheet the moment the session ends, ahead of the toast
    // the Dashboard shows once that sheet clears.
    { successMessage: 'Factory reset done' },
  );
}
