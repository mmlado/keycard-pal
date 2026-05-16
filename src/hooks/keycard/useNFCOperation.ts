import { useCallback, useRef, useState } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';
import useNFCSession, { Phase } from './useNFCSession';

export type { Phase };

export interface UseNFCOperation<T> {
  phase: Phase;
  status: string;
  result: T | null;
  start: () => void;
  cancel: () => void;
  reset: () => void;
}

export function useNFCOperation<T>(
  onConnected: (
    cmdSet: Commandset,
    setStatus: (status: string) => void,
  ) => Promise<T>,
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
    startNFC,
    reset: nfcReset,
  } = useNFCSession(handleCardConnected, handleCardDisconnected);

  const cancel = useCallback(() => {
    runIdRef.current++;
    nfcReset();
  }, [nfcReset]);

  const reset = useCallback(() => {
    runIdRef.current++;
    nfcReset();
    setResult(null);
  }, [nfcReset]);

  return { phase, status, result, start: startNFC, cancel, reset };
}
