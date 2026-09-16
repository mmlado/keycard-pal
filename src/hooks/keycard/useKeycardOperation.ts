import { useCallback, useRef, useState } from 'react';
import Keycard from 'keycard-sdk';
import {
  APDUException,
  WrongPINException,
} from 'keycard-sdk/dist/apdu-exception';
import { Commandset } from 'keycard-sdk/dist/commandset';
import RNKeycard from 'react-native-keycard';

import { PAIRING_PASSWORD } from '@/constants/keycard';
import { loadPairing, savePairing } from '@/storage/pairingStorage';
import { pubKeyFingerprint } from '@/utils/cryptoAccount';
import { checkGenuine } from '@/utils/genuineCheck';
import { toHex } from '@/utils/hex';
import { isTagLostError } from '@/utils/keycardErrors';
import { displayKeycardName, parseKeycardName } from '@/utils/keycardName';
import {
  useNFCOperation,
  type CardPresence,
  type NFCSessionPhase,
} from './useNFCOperation';

export type { CardPresence };

/**
 * The full phase vocabulary of a coordinated Keycard operation: the 4-state
 * session machine plus the coordinator's interactive interrupts. There is one
 * vocabulary — never re-declare or rename these states downstream.
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
  /** Wait for a re-tap instead of failing when the card leaves the field
   *  mid-operation. Default false — only read-only operations may opt in;
   *  a replayed write can burn pairing slots or overwrite card state (R9). */
  retryOnTagLoss?: boolean;
  /** Wording for Apple's NFC sheet when the operation succeeds, in place of the
   *  generic "Success". Mirror the screen's done-toast: the sheet is read first
   *  and the toast repeats it once the sheet clears, so two different strings
   *  for one outcome read as two different outcomes. iOS-only. */
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

export function useKeycardOperation<T>(): UseKeycardOperation<T> {
  const [waitingForPin, setWaitingForPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [cardName, setCardName] = useState<string | null>(null);
  const [cardFingerprint, setCardFingerprint] = useState<number | null>(null);

  // Custom pairing password flow (ADR-0005): first tap detects the cryptogram
  // mismatch and interrupts, second tap pairs with the entered password.
  const [waitingForPairingPassword, setWaitingForPairingPassword] =
    useState(false);
  const [pairingPasswordError, setPairingPasswordError] = useState<
    string | null
  >(null);
  const customPairingPasswordRef = useRef<string | null>(null);

  // Genuine check: non-genuine cards need explicit per-UID approval.
  const [showGenuineWarning, setShowGenuineWarning] = useState(false);
  const approvedNonGenuineUidsRef = useRef<Set<string>>(new Set());
  const pendingGenuineUidRef = useRef<string | null>(null);

  const pinRef = useRef('');
  /** True once this PIN has been accepted by the card in this session, which
   *  makes replaying it safe: a correct verify resets the attempt counter. */
  const pinVerifiedRef = useRef(false);
  const operationRef = useRef<KeycardOperationFn<T> | null>(null);
  const requiresPinRef = useRef(true);
  const requiresMasterKeyRef = useRef(true);
  const operationRunningRef = useRef(false);
  const retryOnTagLossRef = useRef(false);
  const successMessageRef = useRef<string | undefined>(undefined);
  // The session's retryUnsafeRef only exists after the useNFCOperation call
  // below, but doPairAndExecute (defined first) must raise it around autoPair.
  // Held here and assigned each render; always set before any card contact.
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

  // Runs autoPair. Returns true on success (pairing saved), false if
  // interrupted for pairing password entry.
  const runAutoPair = useCallback(
    async (cmdSet: Commandset, uid: string): Promise<boolean> => {
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
      // Nullable since SDK 4, because Secure Channel V2 has no pairing. A V1
      // autoPair that returned without throwing always leaves one.
      const pairing = cmdSet.getPairing()!;
      console.log(
        `[Keycard] autoPair OK (index: ${pairing.pairingIndex}), saving to storage`,
      );
      await savePairing(uid, pairing);
      return true;
    },
    [],
  );

  // Returns true if the operation should proceed, false if interrupted for
  // the non-genuine warning.
  const checkOrSkipGenuine = useCallback(
    async (
      cmdSet: Commandset,
      uid: string,
      hasExistingPairing: boolean,
      setStatus: (s: string) => void,
    ): Promise<boolean> => {
      if (hasExistingPairing || approvedNonGenuineUidsRef.current.has(uid)) {
        return true;
      }
      setStatus('Verifying card...');
      const isGenuine = await checkGenuine(cmdSet);
      if (!isGenuine) {
        console.log('[Keycard] Genuine check failed, showing warning');
        pendingGenuineUidRef.current = uid;
        setShowGenuineWarning(true);
        return false;
      }
      console.log('[Keycard] Genuine check passed');
      return true;
    },
    [],
  );

  const doPairAndExecute = useCallback(
    async (
      cmdSet: Commandset,
      uid: string,
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
        // Non-idempotent window (R9): PAIR step 2 commits a slot on the card
        // before the response is read, so a tag loss in here must never be
        // silently replayed — even for an operation that opted into retry.
        // Cleared only on success, NOT in a finally: a finally would run while
        // the exception unwinds, before the session's catch classifies it, and
        // the window would never apply to the very throw it exists for. On the
        // throw path the session clears the flag in the next startNFC/reset.
        const retryUnsafeRef = retryUnsafeHolderRef.current;
        if (retryUnsafeRef) retryUnsafeRef.current = true;
        const paired = await runAutoPair(cmdSet, uid);
        if (retryUnsafeRef) retryUnsafeRef.current = false;
        if (!paired) return null;
      }
      setStatus('Opening secure channel...');
      await cmdSet.autoOpenSecureChannel();
      console.log('[Keycard] Secure channel open');

      if (requiresPinRef.current) {
        // An UNCONFIRMED PIN is a non-idempotent window, same class as
        // autoPair: the card decrements its 3-attempt counter before the
        // response is read, so a tag loss here may have consumed an attempt
        // with nothing to show for it. Never silently resubmit one — forget
        // it so the next attempt is one the user explicitly authorised
        // (device probe, 2026-08-22: a cached PIN replayed 0.43 s after
        // reconnect, with no prompt).
        //
        // Once the PIN has verified successfully in this session it is known
        // correct, and a correct verify RESETS the counter rather than
        // decrementing it — so replaying it on a reconnect cannot cost an
        // attempt. Guarding those re-verifies too made every card slip during
        // the handshake a hard error, which is what this narrower rule fixes.
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

      // Unnamed card: derive the master fingerprint for display, mirroring
      // keycard-shell's `name[0] ? name : fingerprint` fallback. Display only —
      // never written back to the card. Failure is non-fatal: the operation
      // continues and the card stays shown as "Unnamed card".
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
            // The card is gone, not merely unnamed — swallowing this would
            // send the operation onto a dead channel (observed on-device as a
            // freeze in Processing). Let the session classify it.
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

      return await doPairAndExecute(
        cmdSet,
        uid,
        existingPairing,
        setStatus,
        name,
        appInfo.hasMasterKey(),
      );
    },
    [checkOrSkipGenuine, doPairAndExecute],
  );

  // When NFC becomes available again (user returned from NFC Settings), react
  // with the same decision retry() makes: PIN pad first if a PIN is still
  // missing, otherwise restart the reader. Wired through a ref because retry
  // is defined below (it needs startNFC from this call).
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
    // Read at render: execute() writes the ref and then triggers a re-render
    // (setWaitingForPin or the session's setPhase), so the session sees the new
    // value long before any APDU can fail.
    retryOnTagLoss: retryOnTagLossRef.current,
    // Same read-at-render contract, and it only has to be current by the time
    // the operation resolves — far later than the first render.
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
    [startNFC],
  );

  const submitPin = useCallback(
    (pin: string) => {
      pinRef.current = pin;
      // A newly entered PIN is unconfirmed again, even if a previous one in
      // this session verified: it is protected until the card accepts it.
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
    const uid = pendingGenuineUidRef.current;
    if (uid) {
      approvedNonGenuineUidsRef.current.add(uid);
      pendingGenuineUidRef.current = null;
    }
    setShowGenuineWarning(false);
    startNFC();
  }, [startNFC]);

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
    pendingGenuineUidRef.current = null;
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
