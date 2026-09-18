import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import RNKeycard from 'react-native-keycard';
import Keycard from 'keycard-sdk';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { isTagLostError } from '@/utils/keycardErrors';

export type NFCSessionPhase = 'idle' | 'nfc' | 'done' | 'error';

/** Whether a card is on the antenna right now. Deliberately separate from
 *  NFCSessionPhase: 31 call sites test `phase ===` against the 4-state machine,
 *  so presence must never widen that union. */
export type CardPresence = 'waiting' | 'connected' | 'lost';

/** Single status string for both loss paths (event and classified error) so they
 *  cannot flicker against each other. */
export const CARD_MOVED_STATUS =
  'Connection lost — hold your Keycard against the phone again';

const STABILITY_ERROR_STATUS = 'Could not keep a stable connection. Try again.';
const AMBIGUOUS_LOSS_STATUS =
  'Connection lost mid-operation. Check the card state before retrying.';

const MAX_CONSECUTIVE_TAG_LOSSES = 3;
const TAG_LOSS_WATCHDOG_MS = 6000;

const IOS_TIMEOUT_RESTART_DELAY_MS = 500;
const MAX_IOS_TIMEOUT_RESTARTS = 2;

export interface UseNFCSessionOptions {
  /** Called instead of restarting the NFC reader when NFC becomes available
   *  after being disabled (e.g. the coordinator shows the PIN pad first).
   *  Without it, the default restarts the reader directly. */
  onNFCAvailable?: () => void;
  /** Keep the session alive and wait for a re-tap when an APDU fails because
   *  the card left the field. Default false: a replayed operation can burn
   *  pairing slots or overwrite card state, so only read-only operations opt in. */
  retryOnTagLoss?: boolean;
  /** Wording for Apple's NFC sheet on the success path, in place of the
   *  bridge's generic "Success". iOS-only; ignored elsewhere. */
  successMessage?: string;
}

export interface UseNFCSessionOperation {
  phase: NFCSessionPhase;
  status: string;
  cardPresence: CardPresence;
  startNFC: () => void;
  reset: () => void;
  openNFCSettings: (() => void) | undefined;
  /** Raised around a non-idempotent APDU sequence (e.g. autoPair) so a tag loss
   *  inside it is never silently replayed, even for a retry-safe operation. */
  retryUnsafeRef: { current: boolean };
}

export default function useNFCSession(
  onCardConnected: (
    cmdSet: Commandset,
    setStatus: (status: string) => void,
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

  /** Sets the status AND mirrors it into Apple's system NFC sheet, which is the
   *  only NFC UI on iOS — Pal's own sheet is Android-only by design, so without
   *  this the whole progress narrative, including the reconnect nudge, is
   *  invisible there. Android's setNFCMessage is a documented no-op, so the
   *  platform check saves a pointless bridge round trip rather than guarding
   *  against anything.
   *
   *  Deliberately NOT used on the error paths: those call stopNFCWithError(msg),
   *  which already puts the message on the sheet as it tears the session down.
   *  Setting the same text again immediately before that would be redundant. */
  const reportStatus = useCallback((next: string) => {
    setStatus(next);
    if (Platform.OS === 'ios') {
      RNKeycard.Core.setNFCMessage(next).catch(() => {});
    }
  }, []);

  /** Ends the session on the success path, wording Apple's sheet with the
   *  operation's own message instead of the bridge's generic "Success". The
   *  sheet stays up ~3.4 s after invalidation (device probe 2026-09-01), so it
   *  is the first place the user reads the outcome — and on iOS the only NFC UI
   *  there is.
   *
   *  Android has no system sheet, so it takes the plain stop: its
   *  stopNFCWithMessage is a no-op delegate and the round trip buys nothing. */
  const stopWithSuccess = useCallback(() => {
    const message = successMessageRef.current;
    // The last progress text ("Initializing...") must not sit under the check mark.
    setStatus(message ?? '');
    if (message && Platform.OS === 'ios') {
      RNKeycard.Core.stopNFCWithMessage(message).catch(() => {});
      return;
    }
    RNKeycard.Core.stopNFC().catch(() => {});
  }, []);

  // Terminal path for both reconnect bounds (R11). Marks the error as real so a
  // trailing disconnect event cannot clobber the status text.
  const failUnstableConnection = useCallback(() => {
    clearWatchdog();
    realErrorRef.current = true;
    setStatus(STABILITY_ERROR_STATUS);
    setPhase('error');
    RNKeycard.Core.stopNFCWithError(STABILITY_ERROR_STATUS).catch(() => {});
  }, [clearWatchdog]);

  // A classified tag loss while waiting is allowed: bump the bound, nudge the
  // user, keep the session alive. Either bound firing ends the wait (R11).
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
      // A tap landed while the previous run is still unwinding: the disconnect
      // event arrives within ~50 ms of the card leaving, but the APDU it was
      // in the middle of stays blocked in transceive until the bridge's
      // timeout. Dropping the tap here strands the user — the tag is already
      // on the antenna, so no new discovery fires and only a physical
      // remove-and-tap produces another event. Remember it and replay when
      // this run finishes.
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
    // Cleared unconditionally (R7): a loss where the disconnect event arrived
    // after the classified error must not swallow the next real error.
    disconnectedRef.current = false;
    clearWatchdog();
    setCardPresence('connected');
    inFlightRef.current = true;
    // Tracked locally, not from phaseRef: phaseRef is render-assigned and is
    // still stale inside the finally below (R8), so it cannot say whether this
    // run ended in an error.
    let outcome: 'waiting' | 'done' | 'error' = 'waiting';
    // Until SELECT has answered, nothing but SELECT has been sent, and SELECT
    // changes nothing on the card. So a card that slips off the antenna before
    // then can always be waited for, whatever the operation is.
    let selected = false;
    try {
      reportStatus('Selecting applet...');
      const channel = new RNKeycard.NFCCardChannel();
      const cmdSet = new Keycard.Commandset(channel);

      const selectResp = await cmdSet.select();
      console.log(
        `[Keycard] SELECT SW: 0x${selectResp.sw.toString(16).toUpperCase()}`,
      );
      if (selectResp.sw !== 0x9000) {
        throw new Error(
          `SELECT failed: 0x${selectResp.sw.toString(16).toUpperCase()}`,
        );
      }
      selected = true;
      // Forward progress: only a successful SELECT resets the loss bound. A card
      // that connects and instantly drops must not reset it (R11).
      tagLossCountRef.current = 0;

      await onCardConnected(cmdSet, reportStatus);
      outcome = 'done';
      setPhase('done');
      stopWithSuccess();
    } catch (e: any) {
      if (isTagLostError(e)) {
        if (
          !selected ||
          (retryOnTagLossRef.current && !retryUnsafeRef.current)
        ) {
          // Session stays up: no setPhase, no stopNFCWithError. The next tap
          // re-runs the operation from SELECT. A write gets here too when the
          // card left before SELECT answered: there is nothing of it to replay
          // yet, and calling that "mid-operation" strands the user on an error
          // while the card reconnects underneath it.
          onTagLost();
          return;
        }
        // Replay is not safe for this operation (or we are inside a
        // non-idempotent window): surface the ambiguity instead of retrying.
        outcome = 'error';
        realErrorRef.current = true;
        console.log('[Keycard] Tag lost mid-operation (no retry)');
        setStatus(AMBIGUOUS_LOSS_STATUS);
        setPhase('error');
        RNKeycard.Core.stopNFCWithError(AMBIGUOUS_LOSS_STATUS).catch(() => {});
        return;
      }
      outcome = 'error';
      realErrorRef.current = true;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[Keycard] Error: ${msg}`, e);
      setStatus(msg);
      setPhase('error');
      RNKeycard.Core.stopNFCWithError(msg).catch(() => {});
    } finally {
      inFlightRef.current = false;
      if (pendingConnectRef.current) {
        pendingConnectRef.current = false;
        // Replay only while the session is still waiting for a card. A run
        // that finished or failed must never be restarted behind the user's
        // back — after an error the reader is stopped anyway, and Try again
        // is the way back.
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

  // Lets the finally above re-enter the latest handler without making the
  // callback depend on itself.
  handleCardConnectedRef.current = handleCardConnected;

  // Presence reporting only. The `!realErrorRef.current` guard is load-bearing:
  // phaseRef is render-assigned and still reads 'nfc' in the tick after a real
  // error's setPhase('error'), so the ref is the only same-tick signal (R8).
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
      // iOS: Apple caps the session at 60 s. Mirror status-legacy's auto-restart
      // (nfc/events.cljs:12-15) but bounded — legacy has a persistent sheet to
      // fall back on, Pal renders nothing at phase 'nfc' on iOS (R11). Each
      // restart re-presents the system sheet, hence the cap.
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
          // Re-check: an RN timer can fire on foreground resume long after the
          // 500 ms it was scheduled for.
          if (AppState.currentState !== 'active') {
            setStatus('Timed out — tap again');
            setPhase('error');
            return;
          }
          // doStartNFC, not startNFC: the operation state must survive; only
          // the CoreNFC session is being reopened.
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
      RNKeycard.Core.stopNFC().catch(() => {});
    };
  }, [
    handleCardConnected,
    handleCardDisconnected,
    doStartNFC,
    clearWatchdog,
    clearIosRestartTimer,
  ]);

  // When the user returns from the NFC settings screen with NFC now enabled,
  // invoke the onNFCAvailable option (e.g. show PIN pad) or restart NFC directly.
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

    // Open the NFC sheet immediately so there is no empty-screen gap while the
    // async isNFCEnabled() check runs. If NFC is off, we transition to 'error'
    // inside the already-visible sheet.
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
    RNKeycard.Core.stopNFC().catch(() => {});
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
