import { useCallback } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { cardGeneration, Generation } from '@/utils/cardGeneration';
import {
  useNFCOperation,
  type CardPresence,
  type NFCSessionPhase,
} from './useNFCOperation';

/** Shown when a tap selected the applet but told us nothing about the card. */
export const UNREADABLE_CARD_STATUS = 'Could not read this Keycard. Try again.';

export interface UseIdentifyCard {
  phase: NFCSessionPhase;
  status: string;
  cardPresence: CardPresence;
  /** Null until a tap has completed. Never kept beyond this hook instance. */
  generation: Generation | null;
  start: () => void;
  /** Same as `start`: after an error the reader is off, so a re-tap emits nothing. */
  retry: () => void;
  cancel: () => void;
  openNFCSettings: (() => void) | undefined;
}

/**
 * The first tap of an identify-then-operate flow (ADR-0012): SELECT only, so no retry counter
 * can move. The session sends SELECT and enforces the floor; this hook sends nothing.
 */
export function useIdentifyCard(): UseIdentifyCard {
  const handleConnected = useCallback(
    async (cmdSet: Commandset): Promise<Generation> => {
      // The SDK can throw from select() after filling this in, so read only applicationInfo.
      const appInfo = cmdSet.applicationInfo;
      const generation = appInfo ? cardGeneration(appInfo) : null;
      if (generation === null) {
        throw new Error(UNREADABLE_CARD_STATUS);
      }
      return generation;
    },
    [],
  );

  const {
    phase,
    status,
    cardPresence,
    result,
    start,
    cancel,
    openNFCSettings,
  } = useNFCOperation<Generation>(handleConnected, {
    // Reading the SELECT response changes nothing on the card.
    retryOnTagLoss: true,
    // Apple's sheet lingers over the next screen, so this must not read as the whole operation done.
    successMessage: 'Keycard read.',
  });

  return {
    phase,
    status,
    cardPresence,
    generation: result,
    start,
    retry: start,
    cancel,
    openNFCSettings,
  };
}
