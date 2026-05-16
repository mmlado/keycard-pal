import { useCallback, useRef, useState } from 'react';
import Keycard from 'keycard-sdk';
import { WrongPINException } from 'keycard-sdk/dist/apdu-exception';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { PAIRING_PASSWORD } from '../../constants/keycard';
import { loadPairing, savePairing } from '../../storage/pairingStorage';
import { checkGenuine } from '../../utils/genuineCheck';
import { toHex } from '../../utils/hex';
import { displayKeycardName, parseKeycardName } from '../../utils/keycardName';
import { useNFCOperation } from './useNFCOperation';

export type Phase =
  | 'idle'
  | 'pin_entry'
  | 'nfc'
  | 'genuine_warning'
  | 'done'
  | 'error';

export type KeycardOperationFn<T> = (
  cmdSet: InstanceType<typeof Keycard.Commandset>,
  helpers: { setStatus: (status: string) => void },
) => Promise<T>;

export interface ExecuteOptions {
  requiresPin?: boolean;
  requiresMasterKey?: boolean;
}

export interface UseKeycardOperation<T> {
  phase: Phase;
  status: string;
  cardName: string | null;
  result: T | null;
  pinError: string | null;
  execute: (op: KeycardOperationFn<T>, options?: ExecuteOptions) => void;
  submitPin: (pin: string) => void;
  clearPinError: () => void;
  cancel: () => void;
  reset: () => void;
  retry: () => void;
  proceedWithNonGenuine: () => void;
}

export function useKeycardOperation<T>(): UseKeycardOperation<T> {
  const [waitingForPin, setWaitingForPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [cardName, setCardName] = useState<string | null>(null);
  const [showGenuineWarning, setShowGenuineWarning] = useState(false);

  const pinRef = useRef('');
  const operationRef = useRef<KeycardOperationFn<T> | null>(null);
  const requiresPinRef = useRef(true);
  const requiresMasterKeyRef = useRef(true);
  const operationRunningRef = useRef(false);
  const approvedNonGenuineUidsRef = useRef<Set<string>>(new Set());
  const pendingUidRef = useRef<string | null>(null);

  const doPairAndExecute = useCallback(
    async (
      cmdSet: Commandset,
      uid: string,
      setStatus: (s: string) => void,
    ): Promise<T | null> => {
      const existingPairing = await loadPairing(uid);
      if (existingPairing) {
        console.log(
          `[Keycard] Pairing found in storage (index: ${existingPairing.pairingIndex})`,
        );
        cmdSet.setPairing(existingPairing);
        setStatus('Opening secure channel...');
      } else {
        console.log('[Keycard] No pairing found — running autoPair');
        setStatus('Pairing with card...');
        await cmdSet.autoPair(PAIRING_PASSWORD);
        const pairing = cmdSet.getPairing();
        console.log(
          `[Keycard] autoPair OK (index: ${pairing.pairingIndex}) — saving to storage`,
        );
        await savePairing(uid, pairing);
        setStatus('Opening secure channel...');
      }

      await cmdSet.autoOpenSecureChannel();
      console.log('[Keycard] Secure channel open');

      if (requiresPinRef.current) {
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
    [],
  );

  const handleCardConnected = useCallback(
    async (
      cmdSet: Commandset,
      setStatus: (status: string) => void,
    ): Promise<T | null> => {
      const appInfo = cmdSet.applicationInfo;
      if (!appInfo) {
        throw new Error('No application info in SELECT response');
      }

      const uid = toHex(appInfo.instanceUID);
      console.log(
        `[Keycard] SELECT OK — UID: ${uid}, initialized: ${appInfo.initializedCard}, ` +
          `freePairingSlots: ${
            appInfo.freePairingSlots
          }, hasMasterKey: ${appInfo.hasMasterKey()}`,
      );

      if (requiresMasterKeyRef.current && !appInfo.hasMasterKey()) {
        throw new Error(
          'This card has no master key. Generate or import a key first.',
        );
      }

      const dataResp = await cmdSet.getData(0x00);
      if (dataResp.sw !== 0x9000) {
        throw new Error(
          `GET DATA failed: 0x${dataResp.sw.toString(16).toUpperCase()}`,
        );
      }
      const name = parseKeycardName(dataResp.data);
      setCardName(name);
      setStatus(`Connected to ${displayKeycardName(name)}`);

      const existingPairing = await loadPairing(uid);
      if (!existingPairing && !approvedNonGenuineUidsRef.current.has(uid)) {
        setStatus('Verifying card...');
        const isGenuine = await checkGenuine(cmdSet);
        if (!isGenuine) {
          console.log('[Keycard] Genuine check failed — showing warning');
          pendingUidRef.current = uid;
          setShowGenuineWarning(true);
          // Return null: useNFCSession will set nfcPhase='done',
          // but our phase computation overrides it to 'genuine_warning'.
          return null;
        }
        console.log('[Keycard] Genuine check passed');
      }

      return await doPairAndExecute(cmdSet, uid, setStatus);
    },
    [doPairAndExecute],
  );

  const {
    phase: nfcPhase,
    status,
    result,
    start: startNFC,
    cancel: nfcCancel,
    reset: nfcReset,
  } = useNFCOperation<T | null>(handleCardConnected);

  // 'genuine_warning' takes priority over all other phase overrides.
  const phase: Phase = showGenuineWarning
    ? 'genuine_warning'
    : (waitingForPin && nfcPhase === 'idle') ||
      (pinError !== null && nfcPhase === 'error')
    ? 'pin_entry'
    : nfcPhase;

  const execute = useCallback(
    (op: KeycardOperationFn<T>, options: ExecuteOptions = {}) => {
      operationRef.current = op;
      requiresPinRef.current = options.requiresPin ?? true;
      requiresMasterKeyRef.current = options.requiresMasterKey ?? true;
      operationRunningRef.current = false;

      if (!requiresPinRef.current) {
        startNFC();
      } else {
        setWaitingForPin(true);
      }
    },
    [startNFC],
  );

  const submitPin = useCallback(
    (pin: string) => {
      pinRef.current = pin;
      setPinError(null);
      setWaitingForPin(false);
      startNFC();
    },
    [startNFC],
  );

  const clearPinError = useCallback(() => {
    setPinError(null);
  }, []);

  const proceedWithNonGenuine = useCallback(() => {
    const uid = pendingUidRef.current;
    if (uid) {
      approvedNonGenuineUidsRef.current.add(uid);
      pendingUidRef.current = null;
    }
    setShowGenuineWarning(false);
    startNFC();
  }, [startNFC]);

  // Re-starts NFC without PIN re-entry — uses the cached PIN from the previous attempt.
  const retry = useCallback(() => {
    if (!operationRef.current) return;
    startNFC();
  }, [startNFC]);

  const clearKeycardState = useCallback(() => {
    setWaitingForPin(false);
    setPinError(null);
    setCardName(null);
    setShowGenuineWarning(false);
    pendingUidRef.current = null;
    pinRef.current = '';
    operationRef.current = null;
    operationRunningRef.current = false;
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
    cardName,
    result,
    pinError,
    execute,
    submitPin,
    clearPinError,
    cancel,
    reset,
    retry,
    proceedWithNonGenuine,
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
