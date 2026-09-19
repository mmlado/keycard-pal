import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import RNKeycard from 'react-native-keycard';
import Keycard from 'keycard-sdk';
import { Commandset } from 'keycard-sdk/dist/commandset';

import {
  cardGeneration,
  formatAppletVersion,
  isBelowMinimumVersion,
  MIN_SUPPORTED_APPLET_VERSION,
} from '@/utils/cardGeneration';
import { isUnknownCaError, TRUSTED_CA_PUBLIC_KEYS } from '@/utils/cardTrust';
import {
  cardErrorMessage,
  isTagLostError,
  selectFailureMessage,
} from '@/utils/keycardErrors';
import { noteTappedGeneration } from '@/utils/lastTappedGeneration';

export type NFCSessionPhase = 'idle' | 'nfc' | 'done' | 'error';

/** Whether a card is on the antenna. Kept apart from NFCSessionPhase on purpose. */
export type CardPresence = 'waiting' | 'connected' | 'lost';

/** One status for both loss paths, so they cannot flicker against each other. */
export const CARD_MOVED_STATUS =
  'Connection lost — hold your Keycard against the phone again';

const STABILITY_ERROR_STATUS = 'Could not keep a stable connection. Try again.';
const AMBIGUOUS_LOSS_STATUS =
  'Connection lost mid-operation. Check the card state before retrying.';

const MAX_CONSECUTIVE_TAG_LOSSES = 3;
const TAG_LOSS_WATCHDOG_MS = 6000;

const IOS_TIMEOUT_RESTART_DELAY_MS = 500;
const MAX_IOS_TIMEOUT_RESTARTS = 2;

// A stop that never lands leaves Apple's sheet up until the 60 s cap.
const logStopFailure = (e: unknown) =>
  console.log('[Keycard] stopNFC failed:', e);

export interface UseNFCSessionOptions {
  /** Runs instead of restarting the reader when NFC comes back on. */
  onNFCAvailable?: () => void;
  /** Wait for a re-tap when the card leaves mid-APDU. Only read-only operations opt in. */
  retryOnTagLoss?: boolean;
  /** Shown under the success mark, and on Apple's NFC sheet. */
  successMessage?: string;
  /** Card keys the user approved despite an untrusted certificate (ADR-0013). Read on every tap. */
  whitelistedCardKeys?: () => Uint8Array[] | Promise<Uint8Array[]>;
}

/** What SELECT told the session about the card, beyond the command set. */
export interface SelectedCard {
  /** The certificate chains to no trusted CA and the card is not whitelisted. The card is still readable. */
  untrustedCertificate: boolean;
}

export interface UseNFCSessionOperation {
  phase: NFCSessionPhase;
  status: string;
  cardPresence: CardPresence;
  startNFC: () => void;
  reset: () => void;
  openNFCSettings: (() => void) | undefined;
  /** Raised around a non-idempotent APDU sequence, so a tag loss inside it is never replayed. */
  retryUnsafeRef: { current: boolean };
}

export default function useNFCSession(
  onCardConnected: (
    cmdSet: Commandset,
    setStatus: (status: string) => void,
    card: SelectedCard,
  ) => Promise<void>,
  onCardDisconnected: () => Promise<void>,
  options: UseNFCSessionOptions = {},
): UseNFCSessionOperation {
  const [phase, setPhase] = useState<NFCSessionPhase>('idle');
  const [status, setStatus] = useState('');
  const [cardPresence, setCardPresence] = useState<CardPresence>('waiting');
  const [nfcDisabled, setNfcDisabled] = useState(false);
  const onNFCAvailableRef = useRef(options.onNFCAvailable);
  onNFCAvailableRef.current = options.onNFCAvailable;
  const retryOnTagLossRef = useRef(options.retryOnTagLoss ?? false);
  retryOnTagLossRef.current = options.retryOnTagLoss ?? false;
  const whitelistedCardKeysRef = useRef(options.whitelistedCardKeys);
  whitelistedCardKeysRef.current = options.whitelistedCardKeys;
  const successMessageRef = useRef(options.successMessage);
  successMessageRef.current = options.successMessage;
  const retryUnsafeRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const disconnectedRef = useRef(false);
  const realErrorRef = useRef(false);
  const inFlightRef = useRef(false);
  /** A card connect that arrived while a previous run was still unwinding. */
  const pendingConnectRef = useRef(false);
  const handleCardConnectedRef = useRef<(() => Promise<void>) | null>(null);
  const startAttemptRef = useRef(0);
  const tagLossCountRef = useRef(0);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iosTimeoutRestartsRef = useRef(0);
  const iosRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const clearIosRestartTimer = useCallback(() => {
    if (iosRestartTimerRef.current !== null) {
      clearTimeout(iosRestartTimerRef.current);
      iosRestartTimerRef.current = null;
    }
  }, []);

  // Apple's NFC sheet is the only NFC UI on iOS, so progress is mirrored into it.
  const reportStatus = useCallback((next: string) => {
    setStatus(next);
    if (Platform.OS === 'ios') {
      RNKeycard.Core.setNFCMessage(next).catch(() => {});
    }
  }, []);

  const stopWithSuccess = useCallback(() => {
    const message = successMessageRef.current;
    // The last progress text ("Initializing...") must not sit under the check mark.
    setStatus(message ?? '');
    // The message words Apple's sheet; Android ignores it.
    RNKeycard.Core.stopNFC(message).catch(logStopFailure);
  }, []);

  // Marked as a real error so a trailing disconnect event cannot overwrite the status.
  const failUnstableConnection = useCallback(() => {
    clearWatchdog();
    realErrorRef.current = true;
    setStatus(STABILITY_ERROR_STATUS);
    setPhase('error');
    RNKeycard.Core.stopNFC(STABILITY_ERROR_STATUS, true).catch(logStopFailure);
  }, [clearWatchdog]);

  // A tag loss while waiting keeps the session alive, within both bounds.
  const onTagLost = useCallback(() => {
    tagLossCountRef.current += 1;
    if (tagLossCountRef.current >= MAX_CONSECUTIVE_TAG_LOSSES) {
      failUnstableConnection();
      return;
    }
    setCardPresence('lost');
    reportStatus(CARD_MOVED_STATUS);
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      watchdogRef.current = null;
      if (phaseRef.current === 'nfc') {
        failUnstableConnection();
      }
    }, TAG_LOSS_WATCHDOG_MS);
  }, [clearWatchdog, failUnstableConnection, reportStatus]);

  const handleCardConnected = useCallback(async () => {
    if (phaseRef.current !== 'nfc' && phaseRef.current !== 'error') {
      console.log(
        `[Keycard] Card connected (ignored — phase is '${phaseRef.current}')`,
      );
      return;
    }
    if (inFlightRef.current) {
      // The previous run is still unwinding. Remember the tap and replay it, or the user is stranded.
      console.log('[Keycard] Card connected (queued — previous run in flight)');
      pendingConnectRef.current = true;
      return;
    }
    if (phaseRef.current === 'error') {
      // User re-tapped after an error — reset stale error state and retry.
      realErrorRef.current = false;
      setPhase('nfc');
    }
    console.log('[Keycard] Card connected');
    // Always cleared, so a late disconnect event cannot swallow the next real error.
    disconnectedRef.current = false;
    clearWatchdog();
    setCardPresence('connected');
    inFlightRef.current = true;
    // phaseRef is render-assigned and stale inside the finally below.
    let outcome: 'waiting' | 'done' | 'error' = 'waiting';
    // Before SELECT answers nothing can be replayed, so a loss is always waited for.
    let selected = false;
    try {
      reportStatus('Selecting applet...');
      const channel = new RNKeycard.NFCCardChannel();
      // On a card with a certificate the CA keys decide whether a channel opens at all.
      const whitelist = (await whitelistedCardKeysRef.current?.()) ?? [];
      const cmdSet = new Keycard.Commandset(
        channel,
        TRUSTED_CA_PUBLIC_KEYS,
        whitelist,
      );

      // The SDK throws for an unknown CA, after filling in applicationInfo.
      let untrustedCertificate = false;
      try {
        const selectResp = await cmdSet.select();
        console.log(
          `[Keycard] SELECT SW: 0x${selectResp.sw.toString(16).toUpperCase()}`,
        );
        if (selectResp.sw !== 0x9000) {
          throw new Error(selectFailureMessage(selectResp.sw));
        }
      } catch (e) {
        if (!isUnknownCaError(e) || !cmdSet.applicationInfo) {
          throw e;
        }
        console.log('[Keycard] SELECT OK, certificate from an unknown CA');
        untrustedCertificate = true;
      }
      selected = true;
      // Only a successful SELECT resets the loss bound.
      tagLossCountRef.current = 0;

      // The floor. An uninitialized 3.x card reports no version and passes.
      const appInfo = cmdSet.applicationInfo;
      if (appInfo && isBelowMinimumVersion(appInfo)) {
        const found = formatAppletVersion(appInfo.appVersion);
        const needed = formatAppletVersion(MIN_SUPPORTED_APPLET_VERSION);
        throw new Error(
          `This Keycard runs applet ${found}. Keycard Pal needs applet ${needed} or newer.`,
        );
      }

      // For the dashboard reminder only. Never acted on here.
      const generation = appInfo ? cardGeneration(appInfo) : null;
      if (generation !== null) {
        noteTappedGeneration(generation);
      }

      await onCardConnected(cmdSet, reportStatus, { untrustedCertificate });
      outcome = 'done';
      setPhase('done');
      stopWithSuccess();
    } catch (e: any) {
      if (isTagLostError(e)) {
        if (
          !selected ||
          (retryOnTagLossRef.current && !retryUnsafeRef.current)
        ) {
          // Session stays up. The next tap re-runs from SELECT.
          onTagLost();
          return;
        }
        // Replay is not safe here: surface the ambiguity.
        outcome = 'error';
        realErrorRef.current = true;
        console.log('[Keycard] Tag lost mid-operation (no retry)');
        setStatus(AMBIGUOUS_LOSS_STATUS);
        setPhase('error');
        RNKeycard.Core.stopNFC(AMBIGUOUS_LOSS_STATUS, true).catch(
          logStopFailure,
        );
        return;
      }
      outcome = 'error';
      realErrorRef.current = true;
      const msg = cardErrorMessage(e);
      console.log('[Keycard] Error:', e);
      setStatus(msg);
      setPhase('error');
      RNKeycard.Core.stopNFC(msg, true).catch(logStopFailure);
    } finally {
      inFlightRef.current = false;
      if (pendingConnectRef.current) {
        pendingConnectRef.current = false;
        // Never restart a run that finished or failed.
        if (outcome === 'waiting') {
          console.log('[Keycard] Replaying queued card connect');
          handleCardConnectedRef.current?.().catch(() => {});
        }
      }
    }
  }, [
    onCardConnected,
    onTagLost,
    clearWatchdog,
    reportStatus,
    stopWithSuccess,
  ]);

  // Lets the finally above re-enter the latest handler.
  handleCardConnectedRef.current = handleCardConnected;

  // Presence only. phaseRef still reads 'nfc' in the tick after a real error, hence realErrorRef.
  const handleCardDisconnected = useCallback(() => {
    console.log('[Keycard] Card disconnected');
    onCardDisconnected();
    if (phaseRef.current !== 'nfc' || realErrorRef.current) return;
    disconnectedRef.current = true;
    setCardPresence('lost');
    reportStatus(CARD_MOVED_STATUS);
  }, [onCardDisconnected, reportStatus]);

  const doStartNFC = useCallback(() => {
    RNKeycard.Core.startNFC('Tap your Keycard')
      .then((result: any) => {
        if (result && result.isSuccess === false) {
          setStatus('Failed to start NFC reader. Try again.');
          setPhase('error');
        }
      })
      .catch((err: any) => {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`Failed to start NFC: ${msg}`);
        setPhase('error');
      });
  }, []);

  useEffect(() => {
    const connectedSub = RNKeycard.Core.onKeycardConnected(handleCardConnected);
    const disconnectedSub = RNKeycard.Core.onKeycardDisconnected(
      handleCardDisconnected,
    );
    const cancelledSub = RNKeycard.Core.onNFCUserCancelled(() => {
      console.log('[Keycard] NFC cancelled by user');
      setPhase(prev => (prev === 'nfc' ? 'idle' : prev));
    });
    const timeoutSub = RNKeycard.Core.onNFCTimeout(() => {
      console.log('[Keycard] NFC timed out');
      // Apple caps a session at 60 s. Reopen it, a bounded number of times.
      if (
        Platform.OS === 'ios' &&
        phaseRef.current === 'nfc' &&
        AppState.currentState === 'active' &&
        iosTimeoutRestartsRef.current < MAX_IOS_TIMEOUT_RESTARTS
      ) {
        iosTimeoutRestartsRef.current += 1;
        clearIosRestartTimer();
        iosRestartTimerRef.current = setTimeout(() => {
          iosRestartTimerRef.current = null;
          if (phaseRef.current !== 'nfc') return;
          // A timer can fire long after it was due, on foreground resume.
          if (AppState.currentState !== 'active') {
            setStatus('Timed out — tap again');
            setPhase('error');
            return;
          }
          // Only the CoreNFC session is reopened; the operation state survives.
          doStartNFC();
        }, IOS_TIMEOUT_RESTART_DELAY_MS);
        return;
      }
      if (phaseRef.current === 'nfc') {
        setStatus('Timed out — tap again');
      }
      setPhase(prev => (prev === 'nfc' ? 'error' : prev));
    });

    return () => {
      connectedSub.remove();
      disconnectedSub.remove();
      cancelledSub.remove();
      timeoutSub.remove();
      clearWatchdog();
      clearIosRestartTimer();
      RNKeycard.Core.stopNFC().catch(logStopFailure);
    };
  }, [
    handleCardConnected,
    handleCardDisconnected,
    doStartNFC,
    clearWatchdog,
    clearIosRestartTimer,
  ]);

  // Back from NFC settings with NFC on: run onNFCAvailable, or restart the reader.
  useEffect(() => {
    if (!nfcDisabled) return;
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return;
      RNKeycard.Core.isNFCEnabled()
        .then(enabled => {
          if (!enabled) return;
          setNfcDisabled(false);
          const handler = onNFCAvailableRef.current;
          if (handler) {
            handler();
          } else {
            setStatus('Tap your Keycard');
            setPhase('nfc');
            doStartNFC();
          }
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, [nfcDisabled, doStartNFC]);

  const startNFC = useCallback(() => {
    const attempt = ++startAttemptRef.current;
    disconnectedRef.current = false;
    realErrorRef.current = false;
    inFlightRef.current = false;
    retryUnsafeRef.current = false;
    tagLossCountRef.current = 0;
    iosTimeoutRestartsRef.current = 0;
    clearWatchdog();
    clearIosRestartTimer();
    setCardPresence('waiting');

    // Open the sheet at once; an NFC-off error lands inside it.
    setStatus('Tap your Keycard');
    setPhase('nfc');

    RNKeycard.Core.isNFCEnabled()
      .then(enabled => {
        if (attempt !== startAttemptRef.current) return;
        if (!enabled) {
          setNfcDisabled(true);
          setStatus('NFC is turned off. Enable it in Settings to continue.');
          setPhase('error');
          return;
        }
        setNfcDisabled(false);
        doStartNFC();
      })
      .catch(() => {
        if (attempt !== startAttemptRef.current) return;
        // isNFCEnabled() check failed — proceed and let startNFC surface the real error
        setNfcDisabled(false);
        doStartNFC();
      });
  }, [doStartNFC, clearWatchdog, clearIosRestartTimer]);

  const reset = useCallback(() => {
    startAttemptRef.current++;
    retryUnsafeRef.current = false;
    tagLossCountRef.current = 0;
    iosTimeoutRestartsRef.current = 0;
    clearWatchdog();
    clearIosRestartTimer();
    RNKeycard.Core.stopNFC().catch(logStopFailure);
    setPhase('idle');
    setStatus('');
    setCardPresence('waiting');
    setNfcDisabled(false);
  }, [clearWatchdog, clearIosRestartTimer]);

  const openNFCSettings: (() => void) | undefined =
    nfcDisabled && Platform.OS === 'android'
      ? () => {
          RNKeycard.Core.openNFCSettings().catch(() => {});
        }
      : undefined;

  return {
    phase,
    status,
    cardPresence,
    startNFC,
    reset,
    openNFCSettings,
    retryUnsafeRef,
  };
}
