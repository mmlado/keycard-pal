import { useCallback, useRef, useState } from 'react';
import Keycard from 'keycard-sdk';
import { WrongPINException } from 'keycard-sdk/dist/apdu-exception';
import { Commandset } from 'keycard-sdk/dist/commandset';
import RNKeycard from 'react-native-keycard';

import { loadPairing } from '@/storage/pairingStorage';
import { toHex } from '@/utils/hex';
import { displayKeycardName, parseKeycardName } from '@/utils/keycardName';
import { useGenuineCheck } from './useGenuineCheck';
import { useNFCOperation } from './useNFCOperation';
import { usePairing } from './usePairing';

export type Phase =
  | 'idle'
  | 'pin_entry'
  | 'pairing_password'
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
  pairingPasswordError: string | null;
  execute: (op: KeycardOperationFn<T>, options?: ExecuteOptions) => void;
  submitPin: (pin: string) => void;
  submitPairingPassword: (password: string) => void;
  clearPinError: () => void;
  cancel: () => void;
  reset: () => void;
  retry: () => void;
  proceedWithNonGenuine: () => void;
  openNFCSettings: (() => void) | undefined;
}

export function useKeycardOperation<T>(): UseKeycardOperation<T> {
  const [waitingForPin, setWaitingForPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [cardName, setCardName] = useState<string | null>(null);

  const pinRef = useRef('');
  const operationRef = useRef<KeycardOperationFn<T> | null>(null);
  const requiresPinRef = useRef(true);
  const requiresMasterKeyRef = useRef(true);
  const operationRunningRef = useRef(false);

  const {
    showGenuineWarning,
    checkOrSkipGenuine,
    proceedWithNonGenuine: _proceedWithNonGenuine,
    resetGenuineState,
  } = useGenuineCheck();

  const {
    waitingForPairingPassword,
    pairingPasswordError,
    runAutoPair,
    submitPairingPassword: _submitPairingPassword,
    resetPairingState,
  } = usePairing();

  const verifyPin = useCallback(
    async (cmdSet: Commandset, setStatus: (s: string) => void): Promise<void> => {
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

  const doPairAndExecute = useCallback(
    async (
      cmdSet: Commandset,
      uid: string,
      existingPairing: InstanceType<typeof Keycard.Pairing> | null,
      setStatus: (s: string) => void,
    ): Promise<T | null> => {
      if (existingPairing) {
        console.log(
          `[Keycard] Pairing found in storage (index: ${existingPairing.pairingIndex})`,
        );
        cmdSet.setPairing(existingPairing);
      } else {
        console.log('[Keycard] No pairing found — running autoPair');
        setStatus('Pairing with card...');
        const paired = await runAutoPair(cmdSet, uid);
        if (!paired) return null;
      }
      setStatus('Opening secure channel...');
      await cmdSet.autoOpenSecureChannel();
      console.log('[Keycard] Secure channel open');

      if (requiresPinRef.current) {
        await verifyPin(cmdSet, setStatus);
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
    [runAutoPair, verifyPin],
  );

  const handleCardConnected = useCallback(
    async (
      cmdSet: Commandset,
      setStatus: (status: string) => void,
    ): Promise<T | null> => {
      // Guard: PIN was required but user returned from NFC Settings before entering it.
      // SELECT already ran (harmless); stop here to avoid sending verifyPIN('').
      if (requiresPinRef.current && !pinRef.current) {
        throw new Error('Enter your PIN first — tap Retry to continue.');
      }

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
      const shouldProceed = await checkOrSkipGenuine(
        cmdSet,
        uid,
        !!existingPairing,
        setStatus,
      );
      if (!shouldProceed) return null;

      return await doPairAndExecute(cmdSet, uid, existingPairing, setStatus);
    },
    [checkOrSkipGenuine, doPairAndExecute],
  );

  const {
    phase: nfcPhase,
    status,
    result,
    start: startNFC,
    cancel: nfcCancel,
    reset: nfcReset,
    openNFCSettings,
    onNFCAvailableRef,
  } = useNFCOperation<T | null>(handleCardConnected);

  // When the user returns from NFC Settings with NFC now enabled, go straight
  // to PIN entry (if PIN hasn't been entered yet) or restart NFC directly.
  onNFCAvailableRef.current = () => {
    if (requiresPinRef.current && !pinRef.current) {
      setWaitingForPin(true);
    } else {
      startNFC();
    }
  };

  // 'genuine_warning' takes priority over all other phase overrides.
  const phase: Phase = showGenuineWarning
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
      operationRunningRef.current = false;
      resetPairingState();

      if (!requiresPinRef.current) {
        startNFC();
        return;
      }

      // Check NFC before showing the PIN pad so users don't enter their PIN
      // only to be told NFC is disabled immediately after.
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
    [startNFC, resetPairingState],
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

  const submitPairingPassword = useCallback(
    (password: string) => {
      _submitPairingPassword(password, startNFC);
    },
    [_submitPairingPassword, startNFC],
  );

  const clearPinError = useCallback(() => {
    setPinError(null);
  }, []);

  const proceedWithNonGenuine = useCallback(() => {
    _proceedWithNonGenuine(startNFC);
  }, [_proceedWithNonGenuine, startNFC]);

  // Re-starts NFC. If PIN hasn't been entered yet (e.g. NFC was off before PIN entry),
  // show the PIN pad instead of starting NFC directly.
  const retry = useCallback(() => {
    if (!operationRef.current) return;
    if (requiresPinRef.current && !pinRef.current) {
      setWaitingForPin(true);
      return;
    }
    startNFC();
  }, [startNFC]);

  const clearKeycardState = useCallback(() => {
    setWaitingForPin(false);
    setPinError(null);
    setCardName(null);
    pinRef.current = '';
    operationRef.current = null;
    operationRunningRef.current = false;
    resetGenuineState();
    resetPairingState();
  }, [resetGenuineState, resetPairingState]);

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
    pairingPasswordError,
    execute,
    submitPin,
    submitPairingPassword,
    clearPinError,
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
