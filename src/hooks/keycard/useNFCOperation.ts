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

/** A tap with no input held: the operation already succeeded, or its input was discarded. */
export const NOTHING_TO_SEND_STATUS =
  'Nothing to send to the card. Start again.';

export interface UseNFCOperation<T, I = void> {
  phase: NFCSessionPhase;
  status: string;
  cardPresence: CardPresence;
  userCancels: number;
  result: T | null;
  /** The input reaches every retry and is gone once the operation succeeds or is cancelled or reset. */
  start: (input: I) => void;
  /** Runs again with the same input, for the sheet's "Try again": after an error the reader is off. */
  retry: () => void;
  cancel: () => void;
  reset: () => void;
  openNFCSettings: (() => void) | undefined;
  /** See UseNFCSessionOperation.retryUnsafeRef. */
  retryUnsafeRef: { current: boolean };
  /** The operation's one success wording: Apple's sheet, the success sheet and the done toast. */
  successMessage: string | undefined;
}

export function useNFCOperation<T, I = void>(
  onConnected: (
    cmdSet: Commandset,
    setStatus: (status: string) => void,
    card: SelectedCard,
    input: I,
  ) => Promise<T>,
  options: UseNFCSessionOptions = {},
): UseNFCOperation<T, I> {
  const [result, setResult] = useState<T | null>(null);
  const runIdRef = useRef(0);
  const inputRef = useRef<{ value: I } | null>(null);

  const handleCardConnected = useCallback(
    async (
      cmdSet: Commandset,
      setStatus: (status: string) => void,
      card: SelectedCard,
    ) => {
      const held = inputRef.current;
      if (!held) {
        throw new Error(NOTHING_TO_SEND_STATUS);
      }
      const runId = ++runIdRef.current;
      const value = await onConnected(cmdSet, setStatus, card, held.value);
      // No retry may resend a finished operation.
      if (inputRef.current === held) {
        inputRef.current = null;
      }
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

  const start = useCallback(
    (input: I) => {
      inputRef.current = { value: input };
      startNFC();
    },
    [startNFC],
  );

  const retry = useCallback(() => {
    if (inputRef.current) {
      startNFC();
    }
  }, [startNFC]);

  const cancel = useCallback(() => {
    runIdRef.current++;
    inputRef.current = null;
    nfcReset();
  }, [nfcReset]);

  const reset = useCallback(() => {
    runIdRef.current++;
    inputRef.current = null;
    nfcReset();
    setResult(null);
  }, [nfcReset]);

  return {
    phase,
    status,
    cardPresence,
    userCancels,
    result,
    start,
    retry,
    cancel,
    reset,
    openNFCSettings,
    retryUnsafeRef,
    successMessage: options.successMessage,
  };
}
