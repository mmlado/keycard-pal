import { useCallback, useRef, useState } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { PAIRING_PASSWORD } from '@/constants/keycard';

import { secureChannelVersion } from '@/utils/cardGeneration';
import { getCardKey } from '@/utils/cardIdentity';
import { useCertificateApprovals } from './useCertificateApprovals';
import type { KeycardPhase } from './useKeycardOperation';
import {
  useNFCOperation,
  UseNFCOperation,
  type SelectedCard,
} from './useNFCOperation';

export type UseInitCardOperation = Omit<
  UseNFCOperation<string>,
  'start' | 'phase'
> & {
  phase: KeycardPhase;
  start: (pin: string, duressPin?: string | null) => void;
  /** Accepts the card the warning is about and starts the tap that sets it up. */
  proceedWithNonGenuine: () => void;
};

/** Thrown, not returned: a tap that returns ends in "Card initialized". */
export const UNVERIFIED_CARD_STATUS =
  'This Keycard could not be verified. Nothing was written to it.';

function generatePUK(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b % 10)
    .join('');
}

export function useInitCard(): UseInitCardOperation {
  const pinRef = useRef('');
  const duressPinRef = useRef<string | null>(null);

  // A card with a certificate is judged before anything is written to it (ADR-0013).
  const [showGenuineWarning, setShowGenuineWarning] = useState(false);
  const pendingCardKeyRef = useRef<string | null>(null);
  const { whitelistedCardKeys, approve, handshakeSucceeded } =
    useCertificateApprovals();

  const {
    start: startNFC,
    cancel: nfcCancel,
    reset: nfcReset,
    phase: nfcPhase,
    ...rest
  } = useNFCOperation(
    useCallback(
      async (
        cmdSet: Commandset,
        setStatus: (status: string) => void,
        card: SelectedCard,
      ) => {
        const appInfo = cmdSet.applicationInfo;
        if (appInfo?.initializedCard) {
          throw new Error(
            'This card is already set up. Use a blank card to initialize.',
          );
        }
        const puk = generatePUK();
        const duressPin = duressPinRef.current || undefined;

        if (appInfo && secureChannelVersion(appInfo) === 'v2') {
          const cardKey = getCardKey(appInfo);
          if (card.untrustedCertificate) {
            pendingCardKeyRef.current = cardKey;
            setShowGenuineWarning(true);
            throw new Error(UNVERIFIED_CARD_STATUS);
          }
          // No pairing secret, and the SDK opens the channel inside init(). Needs the pinned SDK fix.
          setStatus('Initializing...');
          const resp = await cmdSet.init(
            pinRef.current,
            puk,
            undefined,
            duressPin,
          );
          resp.checkOK('Initializing the Keycard failed');
          // INIT was accepted, so the handshake succeeded.
          if (cardKey !== null) {
            handshakeSucceeded(cardKey);
          }
        } else {
          await cmdSet.init(pinRef.current, puk, PAIRING_PASSWORD, duressPin);
        }

        pinRef.current = '';
        duressPinRef.current = null;
        return puk;
      },
      [handshakeSucceeded],
    ),
    // Mirrors InitCardScreen's done toast.
    { successMessage: 'Card initialized', whitelistedCardKeys },
  );

  const start = useCallback(
    (pin: string, duressPin?: string | null) => {
      pinRef.current = pin;
      duressPinRef.current = duressPin || null;
      startNFC();
    },
    [startNFC],
  );

  // The PIN is still held, so the second tap needs nothing typed.
  const proceedWithNonGenuine = useCallback(() => {
    const cardKey = pendingCardKeyRef.current;
    if (cardKey) {
      approve(cardKey);
      pendingCardKeyRef.current = null;
    }
    setShowGenuineWarning(false);
    startNFC();
  }, [approve, startNFC]);

  const clearWarning = useCallback(() => {
    setShowGenuineWarning(false);
    pendingCardKeyRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    nfcCancel();
    clearWarning();
  }, [nfcCancel, clearWarning]);

  const reset = useCallback(() => {
    nfcReset();
    clearWarning();
  }, [nfcReset, clearWarning]);

  // The warning outranks the error the interrupted tap ended in.
  const phase: KeycardPhase = showGenuineWarning ? 'genuine_warning' : nfcPhase;

  return { ...rest, phase, start, cancel, reset, proceedWithNonGenuine };
}
