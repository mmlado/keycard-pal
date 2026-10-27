import { useCallback, useEffect, useRef, useState } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { cardHasRoute } from '@/navigation/generationBoundRoutes';

import type { KeycardScreenKeycard } from '@/hooks/useKeycardScreen';

import { deletePairing, loadPairing } from '@/storage/pairingStorage';
import { cardGeneration } from '@/utils/cardGeneration';
import { getCardKey } from '@/utils/cardIdentity';
import { selectFailureMessage } from '@/utils/keycardErrors';
import { UNREADABLE_CARD_STATUS } from './useIdentifyCard';
import { useKeycardOperation } from './useKeycardOperation';
import { useNFCOperation } from './useNFCOperation';

const TOTAL_SLOTS = 10;

export interface SlotInfo {
  totalSlots: number;
  freeSlots: number;
  ourSlotIndex: number | null;
  cardKey: string;
}

export interface UsePairingSlots {
  /** The tap under way, the read or the unpair, for useKeycardScreen. */
  tap: KeycardScreenKeycard;
  /** From the unpair's start until its tap ends. */
  unpairing: boolean;
  slotInfo: SlotInfo | null;
  /** A tap showed a card without pairing slots. The read still ends in 'done'. */
  noPairingSlots: boolean;
  /** The last unpair's success wording, until dismissed. */
  unpaired: string | null;
  dismissUnpaired: () => void;
  checkSlots: () => void;
  unpair: (slotIndex: number) => void;
}

export function usePairingSlots(): UsePairingSlots {
  const [slotInfo, setSlotInfo] = useState<SlotInfo | null>(null);
  const [noPairingSlots, setNoPairingSlots] = useState(false);
  const [unpairing, setUnpairing] = useState(false);
  const [unpaired, setUnpaired] = useState<string | null>(null);

  const readSlotInfo = useCallback(async (cmdSet: Commandset) => {
    const appInfo = cmdSet.applicationInfo;
    if (!appInfo) {
      throw new Error(UNREADABLE_CARD_STATUS);
    }
    // Before the card key, so such a card is not mistaken for an uninitialized one.
    if (!cardHasRoute('PairingSlots', cardGeneration(appInfo))) {
      setNoPairingSlots(true);
      setSlotInfo(null);
      return;
    }
    const cardKey = getCardKey(appInfo);
    if (cardKey === null) {
      throw new Error('This Keycard is not initialized. Initialize it first.');
    }
    const existingPairing = await loadPairing(cardKey);
    setSlotInfo({
      totalSlots: TOTAL_SLOTS,
      freeSlots: appInfo.freePairingSlots,
      ourSlotIndex: existingPairing?.pairingIndex ?? null,
      cardKey,
    });
  }, []);

  const read = useNFCOperation(readSlotInfo, {
    // Read-only SELECT-response read: safe to re-run on a re-tap.
    retryOnTagLoss: true,
  });
  const { start: startRead, reset: resetRead } = read;

  const checkSlots = useCallback(() => {
    setSlotInfo(null);
    setNoPairingSlots(false);
    startRead();
  }, [startRead]);

  const unpairOp = useKeycardOperation<void>();
  const { phase: unpairPhase, execute, reset: resetUnpair } = unpairOp;

  const unpair = useCallback(
    (slotIndex: number) => {
      if (!slotInfo) {
        return;
      }
      const { cardKey } = slotInfo;
      const message = `Slot ${slotIndex + 1} was unpaired`;
      setUnpairing(true);
      execute(
        async cmdSet => {
          // The tap pairs the card when this phone had no pairing, so the read's own slot may be stale.
          const ownSlot = cmdSet.getPairing()?.pairingIndex;
          await cmdSet.unpair(slotIndex);
          if (slotIndex === ownSlot) {
            try {
              await deletePairing(cardKey);
            } catch {
              // Card-side unpair already succeeded; local cleanup is best-effort.
            }
          }
          // Re-read in the same connection, so no second tap is needed.
          const selectResp = await cmdSet.select();
          if (selectResp.sw !== 0x9000) {
            throw new Error(selectFailureMessage(selectResp.sw));
          }
          await readSlotInfo(cmdSet);
          setUnpaired(message);
        },
        {
          requiresPin: true,
          requiresMasterKey: false,
          // The slots were read from one card; the unpair tap can land on another.
          requiresRoute: 'PairingSlots',
          requiresCardKey: cardKey,
          successMessage: message,
        },
      );
    },
    [slotInfo, execute, readSlotInfo],
  );

  useEffect(() => {
    if (unpairPhase === 'done') {
      resetUnpair();
      resetRead();
    }
  }, [unpairPhase, resetUnpair, resetRead]);

  // When the unpair tap ends, not while it waits for its NFC check.
  const lastUnpairPhaseRef = useRef(unpairPhase);
  useEffect(() => {
    const last = lastUnpairPhaseRef.current;
    lastUnpairPhaseRef.current = unpairPhase;
    if (last !== 'idle' && unpairPhase === 'idle') {
      setUnpairing(false);
    }
  }, [unpairPhase]);

  const dismissUnpaired = useCallback(() => setUnpaired(null), []);

  const tap: KeycardScreenKeycard = unpairing
    ? unpairOp
    : {
        phase: read.phase,
        status: read.status,
        cardPresence: read.cardPresence,
        userCancels: read.userCancels,
        cancel: read.cancel,
        retry: checkSlots,
        openNFCSettings: read.openNFCSettings,
      };

  return {
    tap,
    unpairing,
    slotInfo,
    noPairingSlots,
    unpaired,
    dismissUnpaired,
    checkSlots,
    unpair,
  };
}
