import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PairingSlotsScreenProps } from '../navigation/types';
import theme from '../theme';

import ConfirmPrompt from '../components/ConfirmPropmpt';
import Menu from '../components/Menu';
import NFCBottomSheet, { NFCOperation } from '../components/NFCBottomSheet';
import PrimaryButton from '../components/PrimaryButton';

import { useKeycardOperation } from '../hooks/keycard/useKeycardOperation';
import { usePairingSlots } from '../hooks/keycard/usePairingSlots';

import { deletePairing } from '../storage/pairingStorage';

export default function PairingSlotsScreen({
  navigation,
}: PairingSlotsScreenProps) {
  const insets = useSafeAreaInsets();
  const [pendingSlotIndex, setPendingSlotIndex] = useState<number | null>(null);
  const [unpairNotice, setUnpairNotice] = useState<string | null>(null);

  const {
    phase: checkPhase,
    slotInfo,
    status: checkStatus,
    checkSlots,
    cancel: cancelCheck,
    resetNFCOnly: resetCheckNFCOnly,
    readSlotInfoFromCmdSet,
  } = usePairingSlots();

  const unpairHook = useKeycardOperation<void>();
  const {
    phase: unpairPhase,
    execute: executeUnpair,
    cancel: cancelUnpair,
    reset: resetUnpair,
  } = unpairHook;

  const isUnpairing = unpairPhase !== 'idle';

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Pairing slots' });
  }, [navigation]);

  // Auto-start NFC check when the screen is focused and we have no data yet.
  useFocusEffect(
    useCallback(() => {
      if (checkPhase === 'idle' && !slotInfo) {
        checkSlots();
      }
    }, [checkPhase, slotInfo, checkSlots]),
  );

  useEffect(() => {
    if (unpairPhase === 'done') {
      resetUnpair();
      // Keep slotInfo — it was already updated in the unpair callback via
      // readSlotInfoFromCmdSet, so no second NFC tap is needed.
      resetCheckNFCOnly();
    }
  }, [unpairPhase, resetUnpair, resetCheckNFCOnly]);

  const handleUnpairPress = useCallback((slotIndex: number) => {
    setPendingSlotIndex(slotIndex);
  }, []);

  const handleConfirmUnpair = useCallback(() => {
    const slotIndex = pendingSlotIndex!;
    setPendingSlotIndex(null);
    executeUnpair(
      async cmdSet => {
        await cmdSet.unpair(slotIndex);
        if (slotInfo?.ourSlotIndex === slotIndex) {
          try {
            await deletePairing(slotInfo.cardUid);
          } catch {
            // Card-side unpair already succeeded; local cleanup is best-effort.
          }
        }
        // Re-read slot info in the same NFC connection so the screen updates
        // immediately without requiring a second tap on either platform.
        await readSlotInfoFromCmdSet(cmdSet);
        setUnpairNotice(`Slot ${slotIndex + 1} was unpaired`);
      },
      { requiresPin: true, requiresMasterKey: false },
    );
  }, [pendingSlotIndex, executeUnpair, slotInfo, readSlotInfoFromCmdSet]);

  const handleCancelUnpairConfirm = useCallback(() => {
    setPendingSlotIndex(null);
  }, []);

  const handleCancel = useCallback(() => {
    if (isUnpairing) {
      cancelUnpair();
    } else {
      cancelCheck();
    }
  }, [isUnpairing, cancelUnpair, cancelCheck]);

  // Build the NFCOperation object passed to NFCBottomSheet.
  // The check flow maps 'checking' → 'nfc' so the bottom sheet shows.
  const activeNfc: NFCOperation = isUnpairing
    ? unpairHook
    : {
        phase:
          checkPhase === 'checking'
            ? 'nfc'
            : checkPhase === 'ready'
            ? 'done'
            : checkPhase,
        status: checkStatus,
      };

  if (pendingSlotIndex !== null) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        <ConfirmPrompt
          title={`Unpair slot ${pendingSlotIndex + 1}?`}
          description="The device paired to this slot will need to re-pair before it can use this card again."
          yesLabel="Unpair"
          noLabel="Cancel"
          onYes={handleConfirmUnpair}
          onNo={handleCancelUnpairConfirm}
        />
      </View>
    );
  }

  const showContent =
    !isUnpairing &&
    (checkPhase === 'idle' || checkPhase === 'ready' || checkPhase === 'error');

  const menuEntries = slotInfo?.totalSlots
    ? Array.from({ length: slotInfo.totalSlots }, (_, i) => {
        const isOurSlot = i === slotInfo.ourSlotIndex;
        return {
          label: `Slot ${i + 1}`,
          detail: isOurSlot ? 'This device' : undefined,
          onPress: () => handleUnpairPress(i),
        };
      })
    : [];

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {showContent && (
        <View style={styles.content}>
          {!slotInfo && checkPhase !== 'error' && (
            <View style={styles.centeredContent}>
              <Text style={styles.description}>
                Tap your Keycard to read the pairing slot status.
              </Text>
            </View>
          )}

          {checkPhase === 'error' && (
            <View style={styles.centeredContent}>
              <Text style={styles.description}>
                Could not read pairing slot data. Make sure you are tapping the
                correct card.
              </Text>
              <PrimaryButton label="Try again" onPress={checkSlots} />
            </View>
          )}

          {slotInfo && (
            <View style={styles.listContent}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Slots free</Text>
                <Text style={styles.summaryValue}>
                  {slotInfo.freeSlots} / {slotInfo.totalSlots}
                </Text>
              </View>

              <Menu entries={menuEntries} />
            </View>
          )}
        </View>
      )}

      <NFCBottomSheet
        nfc={activeNfc}
        onCancel={handleCancel}
        showOnDone={isUnpairing}
      />

      <Snackbar
        visible={unpairNotice !== null}
        onDismiss={() => setUnpairNotice(null)}
      >
        {unpairNotice ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
  },
  description: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  listContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surfaceList,
    borderRadius: 12,
  },
  summaryLabel: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
  },
  summaryValue: {
    color: theme.colors.onSurface,
    fontSize: 15,
    fontWeight: '600',
  },
});
