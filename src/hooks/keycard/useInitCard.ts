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

/**
 * Ends the tap that found a card it may not set up yet. Thrown rather than
 * returned, so the session closes as an error: a tap that returns closes with
 * this hook's success wording, and Apple's sheet would announce "Card
 * initialized" over a card nothing was written to.
 */
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

  // A card with a certificate is judged before a PIN, a PUK or a duress PIN is
  // written to it (ADR-0013). keycard-shell skips the check on a blank card.
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
          // Such a card takes INIT only inside the secure channel, which the
          // SDK opens as part of init(), and it has no pairing secret to set.
          // This needs the SDK fix that awaits that handshake: the 4.0.0
          // release sends INIT, PIN and PUK included, before the channel is
          // open. package.json pins a build that has it.
          setStatus('Initializing...');
          const resp = await cmdSet.init(
            pinRef.current,
            puk,
            undefined,
            duressPin,
          );
          resp.checkOK('Initializing the Keycard failed');
          // INIT was accepted inside the channel, so the handshake succeeded
          // and the card holds its certificate's key.
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

  // The PIN entered for this card is still held, so the second tap needs
  // nothing typed again.
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
