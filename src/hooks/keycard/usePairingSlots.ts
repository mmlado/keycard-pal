import { useCallback, useState } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { cardHasRoute } from '@/navigation/generationBoundRoutes';
import { loadPairing } from '@/storage/pairingStorage';
import { cardGeneration } from '@/utils/cardGeneration';
import { getCardKey } from '@/utils/cardIdentity';
import { UNREADABLE_CARD_STATUS } from './useIdentifyCard';
import {
  useNFCOperation,
  type CardPresence,
  type NFCSessionPhase,
} from './useNFCOperation';

const TOTAL_SLOTS = 10;

export interface SlotInfo {
  totalSlots: number;
  freeSlots: number;
  ourSlotIndex: number | null;
  cardKey: string;
}

export interface UsePairingSlots {
  phase: NFCSessionPhase;
  cardPresence: CardPresence;
  slotInfo: SlotInfo | null;
  /**
   * True once a tap has shown a card that has no pairing slots at all. The
   * read still ends in 'done': nothing failed, there is just nothing to list.
   */
  noPairingSlots: boolean;
  status: string;
  checkSlots: () => void;
  cancel: () => void;
  reset: () => void;
  resetNFCOnly: () => void;
  readSlotInfoFromCmdSet: (cmdSet: Commandset) => Promise<void>;
}

export function usePairingSlots(): UsePairingSlots {
  const [slotInfo, setSlotInfo] = useState<SlotInfo | null>(null);
  const [noPairingSlots, setNoPairingSlots] = useState(false);

  const readSlotInfo = useCallback(async (cmdSet: Commandset) => {
    const appInfo = cmdSet.applicationInfo;
    if (!appInfo) {
      throw new Error(UNREADABLE_CARD_STATUS);
    }
    // Before the card key: a card without pairing reports no free slot count
    // and must not be mistaken for one that is merely not initialized.
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

  const handleConnected = useCallback(
    async (cmdSet: Commandset) => {
      await readSlotInfo(cmdSet);
    },
    [readSlotInfo],
  );

  const {
    start,
    cancel: nfcCancel,
    reset: nfcReset,
    phase,
    status,
    cardPresence,
  } = useNFCOperation(handleConnected, {
    // Read-only SELECT-response read: safe to re-run on a re-tap.
    retryOnTagLoss: true,
  });

  const checkSlots = useCallback(() => {
    setSlotInfo(null);
    setNoPairingSlots(false);
    start();
  }, [start]);

  const cancel = useCallback(() => {
    nfcCancel();
  }, [nfcCancel]);

  const reset = useCallback(() => {
    setSlotInfo(null);
    setNoPairingSlots(false);
    nfcReset();
  }, [nfcReset]);

  // Resets NFC state only — keeps slotInfo so screen stays populated.
  const resetNFCOnly = useCallback(() => {
    nfcReset();
  }, [nfcReset]);

  // Re-reads slot info from an already-connected cmdSet (e.g. after unpair).
  // Calls SELECT to get fresh applicationInfo before reading.
  const readSlotInfoFromCmdSet = useCallback(
    async (cmdSet: Commandset) => {
      const selectResp = await cmdSet.select();
      if (selectResp.sw !== 0x9000) {
        throw new Error(
          `SELECT failed: 0x${selectResp.sw.toString(16).toUpperCase()}`,
        );
      }
      await readSlotInfo(cmdSet);
    },
    [readSlotInfo],
  );

  return {
    phase,
    cardPresence,
    slotInfo,
    noPairingSlots,
    status,
    checkSlots,
    cancel,
    reset,
    resetNFCOnly,
    readSlotInfoFromCmdSet,
  };
}
