import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import RNKeycard from 'react-native-keycard';
import Keycard from 'keycard-sdk';
import { Commandset } from 'keycard-sdk/dist/commandset';

export type Phase = 'idle' | 'nfc' | 'done' | 'error';

export interface UseNFCSessionOperation {
  phase: Phase;
  status: string;
  startNFC: () => void;
  reset: () => void;
  openNFCSettings: (() => void) | undefined;
  /** Override the action taken when NFC becomes available after being disabled.
   *  If null, the default is to restart the NFC reader directly. */
  onNFCAvailableRef: { current: (() => void) | null };
}

export default function useNFCSession(
  onCardConnected: (
    cmdSet: Commandset,
    setStatus: (status: string) => void,
  ) => Promise<void>,
  onCardDisconnected: () => Promise<void>,
): UseNFCSessionOperation {
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [nfcDisabled, setNfcDisabled] = useState(false);
  const onNFCAvailableRef = useRef<(() => void) | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const disconnectedRef = useRef(false);
  const realErrorRef = useRef(false);
  const inFlightRef = useRef(false);
  const startAttemptRef = useRef(0);

  const handleCardConnected = useCallback(async () => {
    if (phaseRef.current !== 'nfc' && phaseRef.current !== 'error') {
      console.log(
        `[Keycard] Card connected (ignored — phase is '${phaseRef.current}')`,
      );
      return;
    }
    if (inFlightRef.current) {
      return;
    }
    if (phaseRef.current === 'error') {
      // User re-tapped after an error — reset stale error state and retry.
      realErrorRef.current = false;
      setPhase('nfc');
    }
    console.log('[Keycard] Card connected');
    inFlightRef.current = true;
    try {
      setStatus('Selecting applet...');
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

      await onCardConnected(cmdSet, setStatus);
      setPhase('done');
      RNKeycard.Core.stopNFC().catch(() => {});
    } catch (e: any) {
      if (disconnectedRef.current) {
        disconnectedRef.current = false;
        if (Platform.OS === 'ios') {
          // iOS NFC session dies on disconnect — show error so user can retry.
          // Android keeps scanning; staying at 'nfc' lets the user re-tap.
          setStatus('Connection lost — tap again');
          setPhase('error');
        }
        return;
      }
      realErrorRef.current = true;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[Keycard] Error: ${msg}`, e);
      setStatus(msg);
      setPhase('error');
      RNKeycard.Core.stopNFCWithError(msg).catch(() => {});
    } finally {
      inFlightRef.current = false;
    }
  }, [onCardConnected]);

  const handleCardDisconnected = useCallback(() => {
    console.log('[Keycard] Card disconnected');
    onCardDisconnected();
    // Set the ref synchronously so the catch block (which may fire right after)
    // can see it before React processes the setPhase update.
    if (phaseRef.current === 'nfc' && !realErrorRef.current) {
      disconnectedRef.current = true;
      // Update status before queuing setPhase so a subsequent catch-block
      // setStatus (iOS path) is processed after this one, not before.
      setStatus('Connection lost - adjust Keycard position');
    }
    setPhase(prev => {
      if (prev !== 'nfc') return prev;
      if (realErrorRef.current) {
        realErrorRef.current = false;
        return 'error';
      }
      return 'nfc';
    });
  }, [onCardDisconnected]);

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
      RNKeycard.Core.stopNFC().catch(() => {});
    };
  }, [handleCardConnected, handleCardDisconnected]);

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

  // When the user returns from the NFC settings screen with NFC now enabled,
  // invoke the registered handler (e.g. show PIN pad) or restart NFC directly.
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
  }, [doStartNFC]);

  const reset = useCallback(() => {
    startAttemptRef.current++;
    RNKeycard.Core.stopNFC().catch(() => {});
    setPhase('idle');
    setStatus('');
    setNfcDisabled(false);
  }, []);

  const openNFCSettings: (() => void) | undefined =
    nfcDisabled && Platform.OS === 'android'
      ? () => {
          RNKeycard.Core.openNFCSettings().catch(() => {});
        }
      : undefined;

  return { phase, status, startNFC, reset, openNFCSettings, onNFCAvailableRef };
}
