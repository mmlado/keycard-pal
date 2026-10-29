import { useCallback, useEffect, useRef, useState } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { cardHasRoute } from '@/navigation/generationBoundRoutes';

import type { KeycardScreenKeycard } from '@/hooks/useKeycardScreen';

import { deletePairing, loadPairing } from '@/storage/pairingStorage';
import { cardGeneration } from '@/utils/cardGeneration';
import { getCardKey } from '@/utils/cardIdentity';
import { UNREADABLE_CARD_STATUS } from './useIdentifyCard';
import { useKeycardOperation } from './useKeycardOperation';
import { useNFCOperation } from './useNFCOperation';

const TOTAL_SLOTS = 10;
// Applet 3.1.0 has 5 slots and 3.1.1 has 100 under the same version number; the card refuses an index past its last.
const SW_NO_SUCH_SLOT = 0x6a86;
const MAX_SLOT_INDEX = 127;

export const OTHERS_UNPAIRED = 'Every other device was unpaired';

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
  /** Every slot the card has, except the one this phone's tap uses. */
  unpairOthers: () => void;
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
  const rereadFailedRef = useRef(false);

  const runUnpair = useCallback(
    (
      unpairSlots: (cmdSet: Commandset, ownSlot?: number) => Promise<boolean>,
      message: string,
    ) => {
      if (!slotInfo) {
        return;
      }
      const { cardKey } = slotInfo;
      setUnpairing(true);
      execute(
        async (cmdSet, { setStatus }) => {
          setStatus('Unpairing...');
          // The tap pairs the card when this phone had no pairing, so the read's own slot may be stale.
          const ownSlot = cmdSet.getPairing()?.pairingIndex;
          const ownSlotUnpaired = await unpairSlots(cmdSet, ownSlot);
          if (ownSlotUnpaired) {
            try {
              await deletePairing(cardKey);
            } catch {
              // Card-side unpair already succeeded; local cleanup is best-effort.
            }
          }
          // UNPAIR is done: a failed re-read must not let Try again send it again.
          let reread = false;
          try {
            const selectResp = await cmdSet.select();
            if (selectResp.sw === 0x9000) {
              await readSlotInfo(cmdSet);
              reread = true;
            }
          } catch {
            // A fresh read follows once the tap ends.
          }
          rereadFailedRef.current = !reread;
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

  const unpair = useCallback(
    (slotIndex: number) =>
      runUnpair(async (cmdSet, ownSlot) => {
        const unpairResp = await cmdSet.unpair(slotIndex);
        unpairResp.checkOK('Unpairing failed');
        return slotIndex === ownSlot;
      }, `Slot ${slotIndex + 1} was unpaired`),
    [runUnpair],
  );

  const unpairOthers = useCallback(
    () =>
      runUnpair(async (cmdSet, ownSlot) => {
        if (ownSlot === undefined) {
          throw new Error("Could not tell which slot is this device's.");
        }
        for (let slot = 0; slot <= MAX_SLOT_INDEX; slot++) {
          if (slot === ownSlot) {
            continue;
          }
          const unpairResp = await cmdSet.unpair(slot);
          if (unpairResp.sw === SW_NO_SUCH_SLOT) {
            break;
          }
          unpairResp.checkOK('Unpairing failed');
        }
        return false;
      }, OTHERS_UNPAIRED),
    [runUnpair],
  );

  useEffect(() => {
    if (unpairPhase !== 'done') {
      return;
    }
    resetUnpair();
    if (rereadFailedRef.current) {
      rereadFailedRef.current = false;
      checkSlots();
    } else {
      resetRead();
    }
  }, [unpairPhase, resetUnpair, resetRead, checkSlots]);

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
    unpairOthers,
  };
}
