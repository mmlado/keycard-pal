import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import theme from '@/theme';

import PinPad from '@/components/PinPad';

import type {
  CardPresence,
  KeycardPhase,
} from '@/hooks/keycard/useKeycardOperation';
import { useBuyKeycard } from '@/hooks/useBuyKeycard';

import GenuineWarning from './GenuineWarning';
import NFCError from './NFCError';
import NFCSheet from './NFCSheet';
import PairingPasswordEntry from './PairingPasswordEntry';

/** Slide distance for the PIN pad, matching the Modal's old slide-up. */
const PIN_SLIDE_DISTANCE = Dimensions.get('window').height;

export type NFCVariant =
  | 'scanning'
  | 'connected'
  | 'disconnected'
  | 'success'
  | 'error'
  | 'genuine_warning';

export type NFCOperation = {
  phase: KeycardPhase;
  status: string;
  cardPresence?: CardPresence;
  cardName?: string | null;
  cardFingerprint?: number | null;
  pinError?: string | null;
  submitPin?: (pin: string) => void;
  pairingPasswordError?: string | null;
  submitPairingPassword?: (password: string) => void;
  proceedWithNonGenuine?: () => void;
  retry?: () => void;
  openNFCSettings?: () => void;
};

type Props = {
  nfc: NFCOperation;
  onCancel: () => void;
  /** Show success variant when phase is 'done' (e.g. for screens that navigate away after a delay) */
  showOnDone?: boolean;
  /** Leaves out the "Don't have a Keycard?" link, for a screen that already carries it (Settings). */
  hideNoCardExit?: boolean;
};

export default function NFCBottomSheet({
  nfc,
  onCancel,
  showOnDone,
  hideNoCardExit,
}: Props) {
  const {
    phase,
    status,
    cardPresence,
    cardName,
    cardFingerprint,
    pinError,
    submitPin,
    pairingPasswordError,
    submitPairingPassword,
    proceedWithNonGenuine,
    retry,
    openNFCSettings,
  } = nfc;
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [modalVisible, setModalVisible] = useState(false);
  // Kept mounted through the outgoing animation, so the pad does not vanish at once.
  const pinSlide = useRef(new Animated.Value(PIN_SLIDE_DISTANCE)).current;
  const [pinMounted, setPinMounted] = useState(false);

  // End the session as Cancel does before opening the shop, so the sheet never sits over it.
  const { buyKeycard } = useBuyKeycard();
  const handleBuyKeycard = useCallback(() => {
    onCancel();
    buyKeycard();
  }, [onCancel, buyKeycard]);
  // A card that was on the antenna proves ownership, so the shop link is left out then.
  const onBuyKeycard =
    !hideNoCardExit &&
    (cardPresence === undefined || cardPresence === 'waiting')
      ? handleBuyKeycard
      : undefined;

  const showPinPad = phase === 'pin_entry';
  const showGenuineWarning = phase === 'genuine_warning';
  const showPairingPassword = phase === 'pairing_password';
  const showIOSError = Platform.OS === 'ios' && phase === 'error';
  // Presence variants are Android-only: on iOS Apple's sheet owns that feedback.
  const showSheet =
    Platform.OS === 'android' &&
    (phase === 'nfc' ||
      phase === 'error' ||
      (showOnDone === true && phase === 'done'));

  useEffect(() => {
    if (!showPinPad) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [showPinPad, onCancel]);

  useEffect(() => {
    if (showPinPad) {
      setPinMounted(true);
      Animated.timing(pinSlide, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(pinSlide, {
      toValue: PIN_SLIDE_DISTANCE,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPinMounted(false);
      }
    });
  }, [showPinPad, pinSlide]);

  useEffect(() => {
    if (showIOSError) {
      setModalVisible(false);
      return;
    }
    if (showSheet || showGenuineWarning || showPairingPassword) {
      setModalVisible(true);
    }
    Animated.spring(slideAnim, {
      toValue: showSheet ? 0 : 400,
      useNativeDriver: true,
      tension: 60,
      friction: 12,
    }).start(({ finished }) => {
      if (
        finished &&
        !showSheet &&
        !showGenuineWarning &&
        !showPairingPassword
      ) {
        setModalVisible(false);
      }
    });
  }, [
    showSheet,
    showGenuineWarning,
    showPairingPassword,
    showIOSError,
    slideAnim,
  ]);

  // Phase wins over presence: an error renders as an error.
  const variant: NFCVariant =
    phase === 'genuine_warning'
      ? 'genuine_warning'
      : phase === 'done'
      ? 'success'
      : phase === 'error'
      ? 'error'
      : cardPresence === 'lost'
      ? 'disconnected'
      : cardPresence === 'connected'
      ? 'connected'
      : 'scanning';

  return (
    <>
      {/* Deliberately not a Modal: a Modal covers the navigator's own header,
          which is why this used to paint a fake one with a fake back arrow.
          Filling the screen's content area instead leaves the real header —
          and with it the real back button, its iOS swipe-back gesture, and the
          'Enter Keycard PIN' title useKeycardScreen already sets — in place. */}
      {pinMounted && (
        <Animated.View
          testID="pin-overlay"
          style={[
            styles.pinOverlay,
            {
              paddingBottom: insets.bottom,
              transform: [{ translateY: pinSlide }],
            },
          ]}
        >
          <PinPad onComplete={submitPin!} error={pinError ?? undefined} />
        </Animated.View>
      )}

      {showIOSError && (
        <NFCError
          status={status}
          retry={retry}
          openNFCSettings={openNFCSettings}
          onCancel={onCancel}
          onBuyKeycard={onBuyKeycard}
          paddingBottom={insets.bottom + 24}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={onCancel}
      >
        {showGenuineWarning ? (
          <GenuineWarning
            onCancel={onCancel}
            onProceed={proceedWithNonGenuine}
          />
        ) : showPairingPassword && submitPairingPassword ? (
          <PairingPasswordEntry
            error={pairingPasswordError ?? null}
            onSubmit={submitPairingPassword}
            onCancel={onCancel}
          />
        ) : (
          <View style={styles.overlay}>
            <Animated.View
              style={[
                styles.sheet,
                {
                  paddingBottom: Math.max(insets.bottom, 16) + 8,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.handle} />
              <NFCSheet
                variant={variant}
                status={status}
                cardName={cardName}
                cardFingerprint={cardFingerprint}
                onCancel={onCancel}
                retry={retry}
                openNFCSettings={openNFCSettings}
                onBuyKeycard={onBuyKeycard}
              />
            </Animated.View>
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 24,
  },
  /** Yoga anchors an absolute child to the padding box, so the overlay pads for the navigation bar itself (#282). */
  pinOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.background,
  },
});
