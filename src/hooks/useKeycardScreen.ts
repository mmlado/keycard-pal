import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import type { KeycardPhase } from './keycard/useKeycardOperation';

type BeforeRemoveEvent = { preventDefault: () => void };

export type KeycardScreenKeycard = {
  phase: KeycardPhase;
  result?: unknown;
  cancel: () => void;
  /** Absent on a hand-built keycard. See UseNFCSessionOperation.userCancels. */
  userCancels?: number;
};

export type KeycardScreenNavigation = {
  goBack(): void;
  reset(state: {
    index: number;
    routes: { name: 'Dashboard'; params?: { toast?: string } }[];
  }): void;
  setOptions(options: { title: string }): void;
  addListener(
    type: 'beforeRemove',
    callback: (e: BeforeRemoveEvent) => void,
  ): () => void;
};

export type UseKeycardScreenOptions = {
  /** Drives done-navigation (phase + result). */
  keycard: KeycardScreenKeycard;
  navigation: KeycardScreenNavigation;
  /** Header title outside PIN entry. */
  title: string;
  /** Header title while the Keycard PIN pad is up. */
  pinEntryTitle?: string;
  /** When set, phase 'done' resets to Dashboard with this toast. */
  done?: {
    toast: string | ((result: unknown) => string);
    /** Skip navigation while result is null/undefined (e.g. useInitCard). */
    requireResult?: boolean;
  };
  /**
   * Drives the back guard, the PIN-entry title, and onCancel when a screen
   * runs more than one keycard hook (see Slip39Screen). Defaults to keycard.
   */
  activeKeycard?: KeycardScreenKeycard;
  /** Hardware-back fallback once the keycard guard passes; BackHandler semantics. */
  onHardwareBack?: () => boolean;
  /** beforeRemove fallback once the keycard guard passes. */
  onBeforeRemove?: (e: BeforeRemoveEvent) => void;
  /** onCancel only cancels the tap instead of also leaving the screen. */
  stayOnCancel?: boolean;
};

/**
 * The shared phase-to-navigation adapter for screens that run a Keycard
 * operation: done → reset to Dashboard with a toast, back-press during an
 * active tap → cancel the NFC session first, PIN entry → header title.
 * Screens keep only their entry UI and step machines.
 */
export function useKeycardScreen(options: UseKeycardScreenOptions): {
  onCancel: () => void;
} {
  const { navigation } = options;
  const { phase, result } = options.keycard;
  const active = options.activeKeycard ?? options.keycard;

  // Latest-value refs so the back listeners never go stale and never
  // re-subscribe mid-gesture.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const activeRef = useRef(active);
  activeRef.current = active;
  // Raised just before this hook takes the screen off itself, because the
  // operation is done or because the user cancelled Apple's NFC sheet.
  // React Navigation asks the screen being removed first (beforeRemove),
  // and a screen's own back guard cannot tell that from a back press: it would
  // veto the navigation and step its entry form back instead, leaving the user
  // on a finished screen under a success sheet that has no Cancel.
  const leavingRef = useRef(false);

  useEffect(() => {
    const done = optionsRef.current.done;
    if (!done || phase !== 'done') {
      return;
    }
    if (done.requireResult && result == null) {
      return;
    }
    const toast =
      typeof done.toast === 'function' ? done.toast(result) : done.toast;
    leavingRef.current = true;
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard', params: { toast } }],
    });
  }, [phase, result, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title:
        active.phase === 'pin_entry'
          ? options.pinEntryTitle ?? 'Enter Keycard PIN'
          : options.title,
    });
  }, [navigation, active.phase, options.pinEntryTitle, options.title]);

  const keycardBusy = useCallback(() => {
    const activePhase = activeRef.current.phase;
    return activePhase === 'nfc' || activePhase === 'pin_entry';
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (keycardBusy()) {
          activeRef.current.cancel();
          navigation.goBack();
          return true;
        }
        return optionsRef.current.onHardwareBack?.() ?? false;
      });
      return () => sub.remove();
    }, [keycardBusy, navigation]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (leavingRef.current) {
        return;
      }
      if (keycardBusy()) {
        activeRef.current.cancel();
        return;
      }
      optionsRef.current.onBeforeRemove?.(e);
    });
    return unsubscribe;
  }, [navigation, keycardBusy]);

  const onCancel = useCallback(() => {
    activeRef.current.cancel();
    if (!optionsRef.current.stayOnCancel) {
      navigation.goBack();
    }
  }, [navigation]);

  // Cancel on Apple's NFC sheet, the only one iOS gives during a tap.
  const userCancels = active.userCancels ?? 0;
  const seenUserCancelsRef = useRef(userCancels);
  useEffect(() => {
    const seen = seenUserCancelsRef.current;
    seenUserCancelsRef.current = userCancels;
    // A count that drops is activeKeycard switching hooks, not a cancel.
    if (userCancels <= seen) {
      return;
    }
    // The session is back to 'idle' already, so the back guard below would read
    // the screen as idle and step its form back instead of leaving.
    if (!optionsRef.current.stayOnCancel) {
      leavingRef.current = true;
    }
    onCancel();
  }, [userCancels, onCancel]);

  return { onCancel };
}
