import { useCallback, useRef, useState } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';
import useNFCSession, {
  CardPresence,
  NFCSessionPhase,
  UseNFCSessionOptions,
} from './useNFCSession';

export type { CardPresence };
export type { NFCSessionPhase };
export type { UseNFCSessionOptions };

export interface UseNFCOperation<T> {
  phase: NFCSessionPhase;
  status: string;
  cardPresence: CardPresence;
  result: T | null;
  start: () => void;
  /**
   * Opens the reader again after an error, for the NFC sheet's "Try again".
   * After an error the reader is off, so tapping the card alone does nothing.
   * Same as `start`: a caller keeps its inputs in refs until the operation has
   * succeeded, and checks the card's state when it connects, so running again
   * after a lost connection corrects itself.
   */
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
  ) => Promise<T>,
  options: UseNFCSessionOptions = {},
): UseNFCOperation<T> {
  const [result, setResult] = useState<T | null>(null);
  const runIdRef = useRef(0);

  const handleCardConnected = useCallback(
    async (cmdSet: Commandset, setStatus: (status: string) => void) => {
      const runId = ++runIdRef.current;
      const value = await onConnected(cmdSet, setStatus);
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
    result,
    start: startNFC,
    retry: startNFC,
    cancel,
    reset,
    openNFCSettings,
    retryUnsafeRef,
  };
}
