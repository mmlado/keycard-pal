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
    /** Skip navigation while result is null. */
    requireResult?: boolean;
    /** The screen shows more after the tap and calls leave() itself. */
    hold?: boolean;
  };
  /** The hook the guard, PIN title and onCancel follow when there are two. */
  activeKeycard?: KeycardScreenKeycard;
  /** Hardware-back fallback once the keycard guard passes; BackHandler semantics. */
  onHardwareBack?: () => boolean;
  /** beforeRemove fallback once the keycard guard passes. */
  onBeforeRemove?: (e: BeforeRemoveEvent) => void;
  /** onCancel only cancels the tap instead of also leaving the screen. */
  stayOnCancel?: boolean;
};

/** Done, back and the PIN-entry title for every Keycard screen, in one place. */
export function useKeycardScreen(options: UseKeycardScreenOptions): {
  onCancel: () => void;
  /** Dashboard with the done toast. */
  leave: () => void;
} {
  const { navigation } = options;
  const { phase, result } = options.keycard;
  const active = options.activeKeycard ?? options.keycard;

  // Refs, so the back listeners never re-subscribe mid-gesture.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const activeRef = useRef(active);
  activeRef.current = active;
  // Set before this hook navigates: beforeRemove fires for reset too, and the
  // screen's back guard would veto it and step its form back.
  const leavingRef = useRef(false);

  const leave = useCallback(() => {
    const { done, keycard } = optionsRef.current;
    const toast =
      typeof done?.toast === 'function'
        ? done.toast(keycard.result)
        : done?.toast;
    leavingRef.current = true;
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard', params: { toast } }],
    });
  }, [navigation]);

  useEffect(() => {
    const done = optionsRef.current.done;
    if (!done || done.hold || phase !== 'done') {
      return;
    }
    if (done.requireResult && result == null) {
      return;
    }
    leave();
  }, [phase, result, leave]);

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

  // A held done screen has nothing behind it: back means leave.
  const heldDone = useCallback(() => {
    const { done, keycard } = optionsRef.current;
    return done?.hold === true && keycard.phase === 'done';
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (keycardBusy()) {
          activeRef.current.cancel();
          navigation.goBack();
          return true;
        }
        if (heldDone()) {
          leave();
          return true;
        }
        return optionsRef.current.onHardwareBack?.() ?? false;
      });
      return () => sub.remove();
    }, [keycardBusy, heldDone, leave, navigation]),
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
      if (heldDone()) {
        e.preventDefault();
        leave();
        return;
      }
      optionsRef.current.onBeforeRemove?.(e);
    });
    return unsubscribe;
  }, [navigation, keycardBusy, heldDone, leave]);

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
    // Phase is already 'idle'; the back guard would step the form back.
    if (!optionsRef.current.stayOnCancel) {
      leavingRef.current = true;
    }
    onCancel();
  }, [userCancels, onCancel]);

  return { onCancel, leave };
}
