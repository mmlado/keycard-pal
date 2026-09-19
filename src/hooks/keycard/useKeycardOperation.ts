import { useCallback, useRef, useState } from 'react';
import Keycard from 'keycard-sdk';
import {
  APDUException,
  WrongPINException,
} from 'keycard-sdk/dist/apdu-exception';
import { Commandset } from 'keycard-sdk/dist/commandset';
import RNKeycard from 'react-native-keycard';

import { PAIRING_PASSWORD } from '@/constants/keycard';
import {
  cardHasRoute,
  routeAbsence,
  type GenerationBoundRoute,
} from '@/navigation/generationBoundRoutes';

import { loadPairing, savePairing } from '@/storage/pairingStorage';
import { cardGeneration, secureChannelVersion } from '@/utils/cardGeneration';
import { getCardKey } from '@/utils/cardIdentity';
import { pubKeyFingerprint } from '@/utils/cryptoAccount';
import { checkGenuine } from '@/utils/genuineCheck';
import { isTagLostError } from '@/utils/keycardErrors';
import { displayKeycardName, parseKeycardName } from '@/utils/keycardName';
import { useCertificateApprovals } from './useCertificateApprovals';
import {
  useNFCOperation,
  type CardPresence,
  type NFCSessionPhase,
  type SelectedCard,
} from './useNFCOperation';

export type { CardPresence };

/**
 * The one phase vocabulary of a Keycard operation. Never re-declare or rename it downstream.
 */
export type KeycardPhase =
  | NFCSessionPhase
  | 'pin_entry'
  | 'pairing_password'
  | 'genuine_warning';

export type KeycardOperationFn<T> = (
  cmdSet: InstanceType<typeof Keycard.Commandset>,
  helpers: { setStatus: (status: string) => void },
) => Promise<T>;

export interface ExecuteOptions {
  requiresPin?: boolean;
  requiresMasterKey?: boolean;
  /**
   * The route this operation belongs to, when newer cards lack it. Checked right after SELECT.
   */
  requiresRoute?: GenerationBoundRoute;
  /** Wait for a re-tap when the card leaves mid-operation. Read-only operations only. */
  retryOnTagLoss?: boolean;
  /** Shown on success. Keep it equal to the screen's done-toast. */
  successMessage?: string;
}

export interface UseKeycardOperation<T> {
  phase: KeycardPhase;
  status: string;
  cardPresence: CardPresence;
  cardName: string | null;
  cardFingerprint: number | null;
  result: T | null;
  pinError: string | null;
  pairingPasswordError: string | null;
  execute: (op: KeycardOperationFn<T>, options?: ExecuteOptions) => void;
  submitPin: (pin: string) => void;
  submitPairingPassword: (password: string) => void;
  cancel: () => void;
  reset: () => void;
  retry: () => void;
  proceedWithNonGenuine: () => void;
  openNFCSettings: (() => void) | undefined;
}

// An interrupted tap throws: one that returns ends in the success wording.
export const PAIRING_PASSWORD_NEEDED_STATUS =
  'This Keycard needs its pairing password.';
export const NOT_GENUINE_STATUS = 'This Keycard may not be genuine.';

export function useKeycardOperation<T>(): UseKeycardOperation<T> {
  const [waitingForPin, setWaitingForPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [cardName, setCardName] = useState<string | null>(null);
  const [cardFingerprint, setCardFingerprint] = useState<number | null>(null);

  // Custom pairing password (ADR-0005): the first tap interrupts, the second pairs.
  const [waitingForPairingPassword, setWaitingForPairingPassword] =
    useState(false);
  const [pairingPasswordError, setPairingPasswordError] = useState<
    string | null
  >(null);
  const customPairingPasswordRef = useRef<string | null>(null);

  // Genuine check: non-genuine cards need explicit per-card approval.
  const [showGenuineWarning, setShowGenuineWarning] = useState(false);
  const approvedNonGenuineCardKeysRef = useRef<Set<string>>(new Set());
  const pendingGenuineCardKeyRef = useRef<string | null>(null);
  // Cards with a certificate (ADR-0013); see useCertificateApprovals.
  const pendingCertificateRef = useRef(false);
  const {
    whitelistedCardKeys,
    approve: approveCertificate,
    handshakeSucceeded,
  } = useCertificateApprovals();

  const pinRef = useRef('');
  /** The card accepted this PIN in this session, so replaying it is safe. */
  const pinVerifiedRef = useRef(false);
  const operationRef = useRef<KeycardOperationFn<T> | null>(null);
  const requiresPinRef = useRef(true);
  const requiresMasterKeyRef = useRef(true);
  const requiresRouteRef = useRef<GenerationBoundRoute | undefined>(undefined);
  const operationRunningRef = useRef(false);
  const retryOnTagLossRef = useRef(false);
  const successMessageRef = useRef<string | undefined>(undefined);
  // The session's retryUnsafeRef, assigned each render because it only exists further down.
  const retryUnsafeHolderRef = useRef<{ current: boolean } | null>(null);

  const verifyPin = useCallback(
    async (
      cmdSet: Commandset,
      setStatus: (s: string) => void,
    ): Promise<void> => {
      setStatus('Verifying PIN...');
      const pinResp = await cmdSet.verifyPIN(pinRef.current);
      console.log(
        `[Keycard] verifyPIN SW: 0x${pinResp.sw.toString(16).toUpperCase()}`,
      );
      try {
        pinResp.checkAuthOK();
      } catch (e) {
        if (e instanceof WrongPINException) {
          const attempts = e.getRetryAttempts();
          if (attempts === 0) {
            throw new Error('Card is locked. Use Unblock Card option.');
          }
          setPinError(`PIN is not valid. ${attempts} attempts left.`);
        }
        pinRef.current = '';
        throw e;
      }
    },
    [],
  );

  // False when interrupted for the pairing password.
  const runAutoPair = useCallback(
    async (cmdSet: Commandset, cardKey: string): Promise<boolean> => {
      const password = customPairingPasswordRef.current;
      try {
        await cmdSet.autoPair(password ?? PAIRING_PASSWORD);
      } catch (e) {
        if (
          e instanceof APDUException &&
          e.message.includes('Invalid card cryptogram')
        ) {
          if (customPairingPasswordRef.current !== null) {
            setPairingPasswordError('Wrong pairing password. Try again.');
          }
          setWaitingForPairingPassword(true);
          return false;
        }
        if (
          e instanceof APDUException &&
          (e.message.includes('Pairing failed on step 1') ||
            e.message.includes('Pairing failed on step 2'))
        ) {
          throw new Error(
            'This Keycard has no free pairing slots. Use another device to unpair a slot first.',
          );
        }
        throw e;
      }
      // Nullable since SDK 4; a V1 autoPair that returned always leaves one.
      const pairing = cmdSet.getPairing()!;
      console.log(
        `[Keycard] autoPair OK (index: ${pairing.pairingIndex}), saving to storage`,
      );
      await savePairing(cardKey, pairing);
      return true;
    },
    [],
  );

  // False when interrupted for the non-genuine warning.
  const checkOrSkipGenuine = useCallback(
    async (
      cmdSet: Commandset,
      cardKey: string,
      hasExistingPairing: boolean,
      setStatus: (s: string) => void,
    ): Promise<boolean> => {
      if (
        hasExistingPairing ||
        approvedNonGenuineCardKeysRef.current.has(cardKey)
      ) {
        return true;
      }
      setStatus('Verifying card...');
      const isGenuine = await checkGenuine(cmdSet);
      if (!isGenuine) {
        console.log('[Keycard] Genuine check failed, showing warning');
        pendingGenuineCardKeyRef.current = cardKey;
        setShowGenuineWarning(true);
        return false;
      }
      console.log('[Keycard] Genuine check passed');
      return true;
    },
    [],
  );

  const readCardName = useCallback(
    async (
      cmdSet: Commandset,
      setStatus: (s: string) => void,
    ): Promise<string> => {
      const dataResp = await cmdSet.getData(0x00);
      if (dataResp.sw !== 0x9000) {
        throw new Error(
          `GET DATA failed: 0x${dataResp.sw.toString(16).toUpperCase()}`,
        );
      }
      const name = parseKeycardName(dataResp.data);
      setCardName(name);
      setStatus(`Connected to ${displayKeycardName(name)}`);
      return name;
    },
    [],
  );

  /**
   * Everything from the secure channel on, shared by every card. `knownName` is null when the
   * name could not be read before the channel (cards with a certificate).
   */
  const openChannelAndExecute = useCallback(
    async (
      cmdSet: Commandset,
      cardKey: string,
      setStatus: (s: string) => void,
      knownName: string | null,
      hasMasterKey: boolean,
    ): Promise<T | null> => {
      setStatus('Opening secure channel...');
      await cmdSet.autoOpenSecureChannel();
      console.log('[Keycard] Secure channel open');

      // The handshake proved the card holds its key, so a pending approval can be kept.
      handshakeSucceeded(cardKey);

      const name = knownName ?? (await readCardName(cmdSet, setStatus));

      if (requiresPinRef.current) {
        // An unconfirmed PIN costs an attempt before the response is read, so a tag loss here is
        // never replayed. A PIN that already verified is safe: a correct verify resets the counter.
        const retryUnsafeRef = pinVerifiedRef.current
          ? null
          : retryUnsafeHolderRef.current;
        if (retryUnsafeRef) retryUnsafeRef.current = true;
        try {
          await verifyPin(cmdSet, setStatus);
        } catch (e) {
          if (isTagLostError(e) && !pinVerifiedRef.current) {
            pinRef.current = '';
          }
          throw e;
        }
        pinVerifiedRef.current = true;
        if (retryUnsafeRef) retryUnsafeRef.current = false;
      }

      // Unnamed card: show the master fingerprint instead. Display only, failure is not fatal.
      if (name === '' && hasMasterKey) {
        try {
          const masterResp = await cmdSet.exportKey(0, true, 'm', false);
          masterResp.checkOK();
          const fingerprint = pubKeyFingerprint(
            Keycard.BIP32KeyPair.fromTLV(masterResp.data).publicKey,
          );
          setCardFingerprint(fingerprint);
          setStatus(`Connected to ${displayKeycardName(name, fingerprint)}`);
        } catch (e) {
          if (isTagLostError(e)) {
            // The card is gone, not unnamed. Let the session classify it.
            throw e;
          }
          console.warn('[Keycard] master fingerprint export failed', e);
        }
      }

      if (operationRunningRef.current || !operationRef.current) {
        return null;
      }
      operationRunningRef.current = true;
      setStatus('Processing...');
      try {
        return await operationRef.current(cmdSet, { setStatus });
      } finally {
        operationRunningRef.current = false;
      }
    },
    [handshakeSucceeded, readCardName, verifyPin],
  );

  // Cards without a certificate: pair or reuse the pairing, then the shared part.
  const doPairAndExecute = useCallback(
    async (
      cmdSet: Commandset,
      cardKey: string,
      existingPairing: InstanceType<typeof Keycard.Pairing> | null,
      setStatus: (s: string) => void,
      name: string,
      hasMasterKey: boolean,
    ): Promise<T | null> => {
      if (existingPairing) {
        console.log(
          `[Keycard] Pairing found in storage (index: ${existingPairing.pairingIndex})`,
        );
        cmdSet.setPairing(existingPairing);
      } else {
        console.log('[Keycard] No pairing found — running autoPair');
        setStatus('Pairing with card...');
        // PAIR commits a slot before the response is read, so a tag loss here is never replayed.
        // Cleared on success only: a finally would run before the session classifies the throw.
        const retryUnsafeRef = retryUnsafeHolderRef.current;
        if (retryUnsafeRef) retryUnsafeRef.current = true;
        const paired = await runAutoPair(cmdSet, cardKey);
        if (retryUnsafeRef) retryUnsafeRef.current = false;
        if (!paired) throw new Error(PAIRING_PASSWORD_NEEDED_STATUS);
      }
      return await openChannelAndExecute(
        cmdSet,
        cardKey,
        setStatus,
        name,
        hasMasterKey,
      );
    },
    [runAutoPair, openChannelAndExecute],
  );

  const handleCardConnected = useCallback(
    async (
      cmdSet: Commandset,
      setStatus: (status: string) => void,
      card: SelectedCard,
    ): Promise<T | null> => {
      // No PIN yet (back from NFC settings): never send verifyPIN('').
      if (requiresPinRef.current && !pinRef.current) {
        throw new Error('Enter your PIN first — tap Retry to continue.');
      }

      const appInfo = cmdSet.applicationInfo;
      if (!appInfo) {
        throw new Error('No application info in SELECT response');
      }

      // First of all: a card without this operation is sent nothing beyond SELECT.
      const requiredRoute = requiresRouteRef.current;
      if (
        requiredRoute &&
        !cardHasRoute(requiredRoute, cardGeneration(appInfo))
      ) {
        throw new Error(routeAbsence(requiredRoute).sheetError);
      }

      // A blank card without a certificate has no card key; one with a certificate says so in its status.
      const cardKey = getCardKey(appInfo);
      if (cardKey === null || !appInfo.initializedCard) {
        throw new Error(
          'This Keycard is not initialized. Initialize it first.',
        );
      }
      const hasCertificate = secureChannelVersion(appInfo) === 'v2';
      console.log(
        `[Keycard] SELECT OK — card key: ${cardKey}, ` +
          (hasCertificate
            ? `certificate trusted: ${!card.untrustedCertificate}`
            : `freePairingSlots: ${appInfo.freePairingSlots}`) +
          `, hasMasterKey: ${appInfo.hasMasterKey()}`,
      );

      if (requiresMasterKeyRef.current && !appInfo.hasMasterKey()) {
        throw new Error(
          'This card has no master key. Generate or import a key first.',
        );
      }

      // A card with a certificate (ADR-0013): no pairing, no IDENTIFY CARD, and nothing but
      // SELECT outside the channel, so even the name waits for it.
      if (hasCertificate) {
        if (card.untrustedCertificate) {
          // Asked before anything more is sent.
          console.log('[Keycard] Certificate not trusted, showing warning');
          pendingGenuineCardKeyRef.current = cardKey;
          pendingCertificateRef.current = true;
          setShowGenuineWarning(true);
          throw new Error(NOT_GENUINE_STATUS);
        }
        return await openChannelAndExecute(
          cmdSet,
          cardKey,
          setStatus,
          null,
          appInfo.hasMasterKey(),
        );
      }

      const name = await readCardName(cmdSet, setStatus);

      const existingPairing = await loadPairing(cardKey);
      const shouldProceed = await checkOrSkipGenuine(
        cmdSet,
        cardKey,
        !!existingPairing,
        setStatus,
      );
      if (!shouldProceed) throw new Error(NOT_GENUINE_STATUS);

      return await doPairAndExecute(
        cmdSet,
        cardKey,
        existingPairing,
        setStatus,
        name,
        appInfo.hasMasterKey(),
      );
    },
    [checkOrSkipGenuine, doPairAndExecute, openChannelAndExecute, readCardName],
  );

  // NFC came back on: do what retry() does. Through a ref because retry is defined below.
  const retryRef = useRef<() => void>(() => {});
  const {
    phase: nfcPhase,
    status,
    cardPresence,
    result,
    start: startNFC,
    cancel: nfcCancel,
    reset: nfcReset,
    openNFCSettings,
    retryUnsafeRef,
  } = useNFCOperation<T | null>(handleCardConnected, {
    onNFCAvailable: () => retryRef.current(),
    whitelistedCardKeys,
    // Read at render: execute() writes the ref, then re-renders, long before an APDU can fail.
    retryOnTagLoss: retryOnTagLossRef.current,
    // Same read-at-render contract.
    successMessage: successMessageRef.current,
  });
  retryUnsafeHolderRef.current = retryUnsafeRef;

  // 'genuine_warning' takes priority over all other phase overrides.
  const phase: KeycardPhase = showGenuineWarning
    ? 'genuine_warning'
    : waitingForPairingPassword ||
      (pairingPasswordError !== null && nfcPhase === 'error')
    ? 'pairing_password'
    : (waitingForPin && (nfcPhase === 'idle' || nfcPhase === 'error')) ||
      (pinError !== null && nfcPhase === 'error')
    ? 'pin_entry'
    : nfcPhase;

  const execute = useCallback(
    (op: KeycardOperationFn<T>, options: ExecuteOptions = {}) => {
      operationRef.current = op;
      requiresPinRef.current = options.requiresPin ?? true;
      requiresMasterKeyRef.current = options.requiresMasterKey ?? true;
      requiresRouteRef.current = options.requiresRoute;
      retryOnTagLossRef.current = options.retryOnTagLoss ?? false;
      successMessageRef.current = options.successMessage;
      operationRunningRef.current = false;
      setWaitingForPairingPassword(false);
      setPairingPasswordError(null);
      customPairingPasswordRef.current = null;

      if (!requiresPinRef.current) {
        startNFC();
        return;
      }

      // Check NFC first, so nobody types a PIN only to learn NFC is off.
      RNKeycard.Core.isNFCEnabled()
        .then(enabled => {
          if (enabled) {
            setWaitingForPin(true);
          } else {
            startNFC(); // startNFC handles the NFC-disabled error + openNFCSettings
          }
        })
        .catch(() => {
          setWaitingForPin(true); // can't check — fall back to PIN entry
        });
    },
    [startNFC],
  );

  const submitPin = useCallback(
    (pin: string) => {
      pinRef.current = pin;
      // A newly entered PIN is unconfirmed again.
      pinVerifiedRef.current = false;
      setPinError(null);
      setWaitingForPin(false);
      startNFC();
    },
    [startNFC],
  );

  // Stores the custom pairing password and starts the second tap (ADR-0005).
  const submitPairingPassword = useCallback(
    (password: string) => {
      customPairingPasswordRef.current = password;
      setPairingPasswordError(null);
      setWaitingForPairingPassword(false);
      startNFC();
    },
    [startNFC],
  );

  // Approves the pending non-genuine card and starts the second tap.
  const proceedWithNonGenuine = useCallback(() => {
    const cardKey = pendingGenuineCardKeyRef.current;
    if (cardKey) {
      // With a certificate: whitelisted now, remembered after the handshake. Without: carried by the pairing.
      if (pendingCertificateRef.current) {
        approveCertificate(cardKey);
      } else {
        approvedNonGenuineCardKeysRef.current.add(cardKey);
      }
      pendingGenuineCardKeyRef.current = null;
      pendingCertificateRef.current = false;
    }
    setShowGenuineWarning(false);
    startNFC();
  }, [approveCertificate, startNFC]);

  // Restarts NFC, or shows the PIN pad first when no PIN was entered yet.
  const retry = useCallback(() => {
    if (!operationRef.current) return;
    if (requiresPinRef.current && !pinRef.current) {
      setWaitingForPin(true);
      return;
    }
    startNFC();
  }, [startNFC]);
  retryRef.current = retry;

  const clearKeycardState = useCallback(() => {
    setWaitingForPin(false);
    setPinError(null);
    setCardName(null);
    setCardFingerprint(null);
    pinRef.current = '';
    pinVerifiedRef.current = false;
    operationRef.current = null;
    operationRunningRef.current = false;
    setShowGenuineWarning(false);
    pendingGenuineCardKeyRef.current = null;
    pendingCertificateRef.current = false;
    setWaitingForPairingPassword(false);
    setPairingPasswordError(null);
    customPairingPasswordRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    nfcCancel();
    clearKeycardState();
  }, [nfcCancel, clearKeycardState]);

  const reset = useCallback(() => {
    nfcReset();
    clearKeycardState();
  }, [nfcReset, clearKeycardState]);

  return {
    phase,
    status,
    cardPresence,
    cardName,
    cardFingerprint,
    result,
    pinError,
    pairingPasswordError,
    execute,
    submitPin,
    submitPairingPassword,
    cancel,
    reset,
    retry,
    proceedWithNonGenuine,
    openNFCSettings,
  };
}

export function useKeycardOp<T>(
  op: KeycardOperationFn<T>,
  options: ExecuteOptions = {},
): Omit<UseKeycardOperation<T>, 'execute'> & { start: () => void } {
  const { execute, ...rest } = useKeycardOperation<T>();
  const opRef = useRef(op);
  opRef.current = op;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const start = useCallback(() => {
    execute(opRef.current, optionsRef.current);
  }, [execute]);

  return { ...rest, start };
}
