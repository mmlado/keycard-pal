import { useCallback, useRef, useState } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';

import useNFCSession, {
  CardPresence,
  NFCSessionPhase,
  SelectedCard,
  UseNFCSessionOptions,
} from './useNFCSession';

export type { CardPresence };
export type { NFCSessionPhase };
export type { SelectedCard };
export type { UseNFCSessionOptions };

export interface UseNFCOperation<T> {
  phase: NFCSessionPhase;
  status: string;
  cardPresence: CardPresence;
  userCancels: number;
  result: T | null;
  start: () => void;
  /** Same as `start`, for the sheet's "Try again": after an error the reader is off. */
  retry: () => void;
  cancel: () => void;
  reset: () => void;
  openNFCSettings: (() => void) | undefined;
  /** See UseNFCSessionOperation.retryUnsafeRef. */
  retryUnsafeRef: { current: boolean };
}

export function useNFCOperation<T>(
  onConnected: (
    cmdSet: Commandset,
    setStatus: (status: string) => void,
    card: SelectedCard,
  ) => Promise<T>,
  options: UseNFCSessionOptions = {},
): UseNFCOperation<T> {
  const [result, setResult] = useState<T | null>(null);
  const runIdRef = useRef(0);

  const handleCardConnected = useCallback(
    async (
      cmdSet: Commandset,
      setStatus: (status: string) => void,
      card: SelectedCard,
    ) => {
      const runId = ++runIdRef.current;
      const value = await onConnected(cmdSet, setStatus, card);
      if (runId === runIdRef.current) {
        setResult(value);
      }
    },
    [onConnected],
  );

  const handleCardDisconnected = useCallback(async () => {}, []);

  const {
    phase,
    status,
    cardPresence,
    userCancels,
    startNFC,
    reset: nfcReset,
    openNFCSettings,
    retryUnsafeRef,
  } = useNFCSession(handleCardConnected, handleCardDisconnected, options);

  const cancel = useCallback(() => {
    runIdRef.current++;
    nfcReset();
  }, [nfcReset]);

  const reset = useCallback(() => {
    runIdRef.current++;
    nfcReset();
    setResult(null);
  }, [nfcReset]);

  return {
    phase,
    status,
    cardPresence,
    userCancels,
    result,
    start: startNFC,
    retry: startNFC,
    cancel,
    reset,
    openNFCSettings,
    retryUnsafeRef,
  };
}
