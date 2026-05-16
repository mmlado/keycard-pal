import { useCallback } from 'react';
import { Constants } from 'keycard-sdk/dist/constants';
import { Mnemonic } from 'keycard-sdk/dist/mnemonic';
import { wordlist } from '@scure/bip39/wordlists/english.js';

import { useKeycardOp } from './useKeycardOperation';

export function useGenerateKey(size: 12 | 24) {
  const checksum =
    size === 12
      ? Constants.GENERATE_MNEMONIC_12_WORDS
      : Constants.GENERATE_MNEMONIC_24_WORDS;

  return useKeycardOp<string[]>(
    useCallback(
      async cmdSet => {
        const response = await cmdSet.generateMnemonic(checksum);
        response.checkOK();
        const mnemonic = new Mnemonic(response.data);
        mnemonic.setWordlist(wordlist);
        return mnemonic.getWords();
      },
      [checksum],
    ),
    { requiresPin: false, requiresMasterKey: false },
  );
}
