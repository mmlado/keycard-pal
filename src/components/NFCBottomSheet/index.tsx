import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import theme from '@/theme';

import PinPad from '@/components/PinPad';

import GenuineWarning from './GenuineWarning';
import NFCError from './NFCError';
import NFCSheet from './NFCSheet';
import PairingPasswordEntry from './PairingPasswordEntry';

export type NFCVariant = 'scanning' | 'success' | 'error' | 'genuine_warning';

export type NFCOperation = {
  phase: string;
  status: string;
  cardName?: string | null;
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
};

export default function NFCBottomSheet({ nfc, onCancel, showOnDone }: Props) {
  const {
    phase,
    status,
    cardName,
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

  const showPinPad = phase === 'pin_entry';
  const showGenuineWarning = phase === 'genuine_warning';
  const showPairingPassword = phase === 'pairing_password';
  const showIOSError = Platform.OS === 'ios' && phase === 'error';
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
      if (finished && !showSheet && !showGenuineWarning && !showPairingPassword) {
        setModalVisible(false);
      }
    });
  }, [showSheet, showGenuineWarning, showPairingPassword, showIOSError, slideAnim]);

  const variant: NFCVariant =
    phase === 'genuine_warning'
      ? 'genuine_warning'
      : phase === 'done'
      ? 'success'
      : phase === 'error'
      ? 'error'
      : 'scanning';

  return (
    <>
      <Modal
        visible={showPinPad}
        transparent={false}
        statusBarTranslucent
        animationType="slide"
        onRequestClose={onCancel}
      >
        <View style={[styles.pinModal, { paddingBottom: insets.bottom }]}>
          <PinPad onComplete={submitPin!} error={pinError ?? undefined} />
        </View>
      </Modal>

      {showIOSError && (
        <NFCError
          status={status}
          retry={retry}
          openNFCSettings={openNFCSettings}
          onCancel={onCancel}
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
                onCancel={onCancel}
                openNFCSettings={openNFCSettings}
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
  pinModal: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
