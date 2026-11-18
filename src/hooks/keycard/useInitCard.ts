import { useCallback, useRef, useState } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { PAIRING_PASSWORD } from '@/constants/keycard';

import { secureChannelVersion } from '@/utils/cardGeneration';
import { getCardKey } from '@/utils/cardIdentity';
import { drawPuk, platformRandomBytes } from '@/utils/puk';
import { useCertificateApprovals } from './useCertificateApprovals';
import type { KeycardPhase } from './useKeycardOperation';
import {
  useNFCOperation,
  UseNFCOperation,
  type SelectedCard,
} from './useNFCOperation';

interface InitInput {
  pin: string;
  duressPin: string | null;
}

export type UseInitCardOperation = Omit<
  UseNFCOperation<void, InitInput>,
  'start' | 'phase'
> & {
  phase: KeycardPhase;
  /** The PUK the card is set up with; empty until a tap has drawn it. */
  puk: string;
  /** INIT went out and the card has not answered: it may hold the PUK. Survives cancel and retry. */
  initSent: boolean;
  start: (pin: string, duressPin?: string | null) => void;
  /** The second tap, after the genuine warning. */
  proceedWithNonGenuine: () => void;
};

/** Thrown, not returned: a tap that returns ends in "Card initialized". */
export const UNVERIFIED_CARD_STATUS =
  'This Keycard could not be verified. Nothing was written to it.';

export const CARD_RANDOM_FAILED =
  'Reading random bytes from the Keycard failed';

async function cardRandomBytes(
  cmdSet: Commandset,
  length: number,
): Promise<Uint8Array> {
  const resp = await cmdSet.getChallenge(length);
  resp.checkOK(CARD_RANDOM_FAILED);
  return resp.data;
}

export function useInitCard(): UseInitCardOperation {
  // One per screen, so a retry sends the digits done will show.
  const [puk, setPuk] = useState('');
  const pukRef = useRef<string | null>(null);
  const pukOnce = useCallback(async (draw: () => Promise<string>) => {
    if (pukRef.current === null) {
      pukRef.current = await draw();
      setPuk(pukRef.current);
    }
    return pukRef.current;
  }, []);
  // INIT is the tap's last command: a loss inside it leaves the card's state unknown (#430).
  const [initSent, setInitSent] = useState(false);

  // A card with a certificate is judged before anything is written to it (ADR-0013).
  const [showGenuineWarning, setShowGenuineWarning] = useState(false);
  const pendingCardKeyRef = useRef<string | null>(null);
  const { whitelistedCardKeys, approve, handshakeSucceeded } =
    useCertificateApprovals();

  const {
    start: startNFC,
    retry,
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
        { pin, duressPin: chosenDuressPin }: InitInput,
      ) => {
        const appInfo = cmdSet.applicationInfo;
        if (appInfo?.initializedCard) {
          throw new Error(
            'This card is already set up. Use a blank card to initialize.',
          );
        }
        const duressPin = chosenDuressPin || undefined;

        if (appInfo && secureChannelVersion(appInfo) === 'v2') {
          const cardKey = getCardKey(appInfo);
          if (card.untrustedCertificate) {
            pendingCardKeyRef.current = cardKey;
            setShowGenuineWarning(true);
            throw new Error(UNVERIFIED_CARD_STATUS);
          }
          setStatus('Initializing...');
          // GET CHALLENGE needs a channel; init() then opens a fresh one.
          const cardPuk = await pukOnce(async () => {
            await cmdSet.autoOpenSecureChannel();
            return drawPuk(length => cardRandomBytes(cmdSet, length));
          });
          setInitSent(true);
          // No pairing on 4.0.
          const resp = await cmdSet.init(pin, cardPuk, undefined, duressPin);
          // An answer, refusal included, ends the unknown window.
          setInitSent(false);
          resp.checkOK('Initializing the Keycard failed');
          // INIT was accepted, so the handshake succeeded.
          if (cardKey !== null) {
            handshakeSucceeded(cardKey);
          }
        } else {
          // A 3.x card has no GET CHALLENGE.
          const phonePuk = await pukOnce(() => drawPuk(platformRandomBytes));
          setInitSent(true);
          await cmdSet.init(pin, phonePuk, PAIRING_PASSWORD, duressPin);
          setInitSent(false);
        }
      },
      [handshakeSucceeded, pukOnce],
    ),
    { successMessage: 'Card initialized', whitelistedCardKeys },
  );

  const start = useCallback(
    (pin: string, duressPin?: string | null) => {
      startNFC({ pin, duressPin: duressPin || null });
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
    retry();
  }, [approve, retry]);

  const clearWarning = useCallback(() => {
    setShowGenuineWarning(false);
    pendingCardKeyRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    nfcCancel();
    clearWarning();
  }, [nfcCancel, clearWarning]);

  // Cancel keeps initSent: dismissing the error is how the screen reaches the PUK.
  const reset = useCallback(() => {
    nfcReset();
    clearWarning();
    setInitSent(false);
  }, [nfcReset, clearWarning]);

  // The warning outranks the error the interrupted tap ended in.
  const phase: KeycardPhase = showGenuineWarning ? 'genuine_warning' : nfcPhase;

  return {
    ...rest,
    phase,
    puk,
    initSent,
    start,
    retry,
    cancel,
    reset,
    proceedWithNonGenuine,
  };
}
