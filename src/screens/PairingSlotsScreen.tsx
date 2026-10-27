import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routeAbsence } from '@/navigation/generationBoundRoutes';
import type { PairingSlotsScreenProps } from '@/navigation/types';
import theme from '@/theme';

import ConfirmPrompt from '@/components/ConfirmPropmpt';
import Menu from '@/components/Menu';
import PrimaryButton from '@/components/PrimaryButton';

import { usePairingSlots } from '@/hooks/keycard/usePairingSlots';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';

export default function PairingSlotsScreen({
  navigation,
}: PairingSlotsScreenProps) {
  const insets = useSafeAreaInsets();
  const [pendingSlotIndex, setPendingSlotIndex] = useState<number | null>(null);

  const {
    tap,
    unpairing,
    slotInfo,
    noPairingSlots,
    unpaired,
    dismissUnpaired,
    checkSlots,
    unpair,
  } = usePairingSlots();
  const phase = tap.phase;

  const { sheet } = useKeycardScreen({
    keycard: tap,
    navigation,
    title: 'Pairing slots',
    stayOnCancel: unpairing,
    showOnDone: unpairing,
  });

  // Once per mount, not on focus: Apple's Cancel puts the read back to 'idle'.
  const readStartedRef = useRef(false);
  useEffect(() => {
    if (readStartedRef.current) {
      return;
    }
    readStartedRef.current = true;
    if (phase === 'idle' && !slotInfo && !noPairingSlots) {
      checkSlots();
    }
  }, [phase, slotInfo, noPairingSlots, checkSlots]);

  const handleUnpairPress = useCallback((slotIndex: number) => {
    setPendingSlotIndex(slotIndex);
  }, []);

  const handleConfirmUnpair = useCallback(() => {
    const slotIndex = pendingSlotIndex!;
    setPendingSlotIndex(null);
    unpair(slotIndex);
  }, [pendingSlotIndex, unpair]);

  const handleCancelUnpairConfirm = useCallback(() => {
    setPendingSlotIndex(null);
  }, []);

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
    !unpairing && (phase === 'idle' || phase === 'done' || phase === 'error');

  const absence = routeAbsence('PairingSlots');

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
          {noPairingSlots && (
            <>
              <View style={styles.centeredContent}>
                <Text style={styles.absenceTitle}>{absence.title}</Text>
                <Text style={styles.description}>{absence.detail}</Text>
              </View>
              <View style={styles.footer}>
                <PrimaryButton
                  label="Go back"
                  onPress={() => navigation.goBack()}
                />
              </View>
            </>
          )}

          {!slotInfo && !noPairingSlots && phase !== 'error' && (
            <View style={styles.centeredContent}>
              <Text style={styles.description}>
                Tap your Keycard to read the pairing slot status.
              </Text>
            </View>
          )}

          {phase === 'error' && (
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

      {sheet}

      <Snackbar visible={unpaired !== null} onDismiss={dismissUnpaired}>
        {unpaired ?? ''}
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
  footer: {
    paddingHorizontal: 24,
  },
  absenceTitle: {
    color: theme.colors.onSurface,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
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
