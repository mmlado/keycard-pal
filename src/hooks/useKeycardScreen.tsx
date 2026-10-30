import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useBlockNativeBack } from '@/navigation/useBlockNativeBack';

import NFCBottomSheet, { type NFCOperation } from '@/components/NFCBottomSheet';

type BeforeRemoveEvent = { preventDefault: () => void };

export type KeycardScreenKeycard = NFCOperation & {
  result?: unknown;
  /** Keeps its identity across renders: Apple's cancels are counted per hook by it. */
  cancel: () => void;
  /** See UseNFCSessionOperation.userCancels. */
  userCancels: number;
  successMessage?: string;
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
  /** Done resets to Dashboard; the toast is the operation's success message unless `toast` says otherwise. */
  done?: {
    toast?: string | ((result: unknown) => string | undefined);
    /** Skip navigation while result is null. */
    requireResult?: boolean;
  };
  /** The screen shows what follows the tap and calls leave(): done stays put and back means leave(). */
  hold?: boolean;
  /** The hook the guard, PIN title, sheet and onCancel follow when there are two. */
  activeKeycard?: KeycardScreenKeycard;
  /** Steps the screen's own form back, for either back; false lets the screen go. */
  stepBack?: () => boolean;
  /** stepBack would step back now: iOS's native back and swipe are then held for it. */
  canStepBack?: boolean;
  /** onCancel only cancels the tap instead of also leaving the screen. */
  stayOnCancel?: boolean;
  /** Leaves after a cancel instead of going back. Navigate before awaiting: the sheet may navigate next. */
  leaveOnCancel?: () => void;
  /** The sheet shows its success state on done. */
  showOnDone?: boolean;
  /** The sheet leaves out "Don't have a Keycard?". */
  hideNoCardExit?: boolean;
};

/** The sheet, done, back and the PIN-entry title for every Keycard screen, in one place. */
export function useKeycardScreen(options: UseKeycardScreenOptions): {
  onCancel: () => void;
  /** Dashboard with the done toast. */
  leave: () => void;
  /** Render it as a child of the screen's root View: the PIN overlay fills its parent. */
  sheet: React.ReactElement;
} {
  const { navigation } = options;
  const { phase, result } = options.keycard;
  const active = options.activeKeycard ?? options.keycard;

  // Refs, so the back listeners never re-subscribe mid-gesture.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const activeRef = useRef(active);
  activeRef.current = active;
  // beforeRemove fires for this hook's own reset too, and stepBack would veto it.
  const leavingRef = useRef(false);

  const leave = useCallback(() => {
    const { done, keycard } = optionsRef.current;
    const toast = !done
      ? undefined
      : typeof done.toast === 'function'
      ? done.toast(keycard.result)
      : done.toast ?? keycard.successMessage;
    leavingRef.current = true;
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard', params: { toast } }],
    });
  }, [navigation]);

  useEffect(() => {
    const { done, hold } = optionsRef.current;
    if (!done || hold || phase !== 'done') {
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

  // A held screen has nothing behind it: back means leave.
  const held = useCallback(() => optionsRef.current.hold === true, []);

  const onCancel = useCallback(() => {
    activeRef.current.cancel();
    const { stayOnCancel, leaveOnCancel } = optionsRef.current;
    if (stayOnCancel) {
      return;
    }
    // Otherwise stepBack vetoes leaving once the tap is not busy (an error, Apple's cancel).
    leavingRef.current = true;
    if (leaveOnCancel) {
      leaveOnCancel();
    } else {
      navigation.goBack();
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (keycardBusy()) {
          onCancel();
          return true;
        }
        if (held()) {
          leave();
          return true;
        }
        // False hands it to the navigator, whose beforeRemove asks again.
        return optionsRef.current.stepBack?.() ?? false;
      });
      return () => sub.remove();
    }, [keycardBusy, held, leave, onCancel]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (leavingRef.current) {
        return;
      }
      if (keycardBusy()) {
        activeRef.current.cancel();
        // Like hardware back: a screen that stays on cancel needs a second back to leave.
        if (optionsRef.current.stayOnCancel) {
          e.preventDefault();
        }
        return;
      }
      if (held()) {
        e.preventDefault();
        leave();
        return;
      }
      if (optionsRef.current.stepBack?.()) {
        e.preventDefault();
      }
    });
    return unsubscribe;
  }, [navigation, keycardBusy, held, leave]);

  useBlockNativeBack(
    (options.stayOnCancel === true &&
      (active.phase === 'nfc' || active.phase === 'pin_entry')) ||
      options.hold === true ||
      options.canStepBack === true,
  );

  // Cancel on Apple's NFC sheet, the only one iOS gives during a tap.
  const userCancels = active.userCancels;
  // Per hook, so a hook handed back as activeKeycard is not read as cancelled.
  const seenUserCancelsRef = useRef(new Map<() => void, number>());
  useEffect(() => {
    const seenByHook = seenUserCancelsRef.current;
    const seen = seenByHook.get(active.cancel);
    seenByHook.set(active.cancel, userCancels);
    if (seen === undefined || userCancels <= seen) {
      return;
    }
    onCancel();
  }, [userCancels, active.cancel, onCancel]);

  const sheet = (
    <NFCBottomSheet
      nfc={active}
      onCancel={onCancel}
      showOnDone={options.showOnDone}
      hideNoCardExit={options.hideNoCardExit}
    />
  );

  return { onCancel, leave, sheet };
}
