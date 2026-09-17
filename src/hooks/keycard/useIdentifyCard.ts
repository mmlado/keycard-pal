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
  /**
   * The same function as `start`, under the name the NFC sheet's error variant
   * calls: after an error the reader is disarmed, so re-tapping emits nothing.
   */
  retry: () => void;
  cancel: () => void;
  openNFCSettings: (() => void) | undefined;
}

/**
 * The first tap of an identify-then-operate flow (ADR-0012): SELECT and
 * nothing else. No secure channel, no pairing and no PIN, so it is the
 * shortest tap the app has and cannot move a retry counter. It exists because
 * the user picks an action before the card is known, and an operation the card
 * does not have must be refused before anything is asked of them.
 *
 * The session issues SELECT and refuses a card below the floor before this
 * hook's callback runs, so the hook itself sends no command at all.
 */
export function useIdentifyCard(): UseIdentifyCard {
  const handleConnected = useCallback(
    async (cmdSet: Commandset): Promise<Generation> => {
      // Read only `applicationInfo`, never SELECT's own return value: on a
      // card with a certificate the SDK can throw from select() after it has
      // filled this in, and that state still has to identify the card.
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
    // Apple's sheet lingers after the tap, over the screen that asks for
    // input next. "Success" there would read as the whole operation done.
    successMessage: 'Keycard read. Continue on your phone.',
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
