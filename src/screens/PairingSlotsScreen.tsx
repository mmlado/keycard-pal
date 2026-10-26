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

import { useKeycardOperation } from '@/hooks/keycard/useKeycardOperation';
import { usePairingSlots } from '@/hooks/keycard/usePairingSlots';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';

import { deletePairing } from '@/storage/pairingStorage';

export default function PairingSlotsScreen({
  navigation,
}: PairingSlotsScreenProps) {
  const insets = useSafeAreaInsets();
  const [pendingSlotIndex, setPendingSlotIndex] = useState<number | null>(null);
  const [unpairNotice, setUnpairNotice] = useState<string | null>(null);
  // Until the unpair tap ends, so cancelling it, on Apple's sheet too, stays here.
  const [unpairing, setUnpairing] = useState(false);

  const check = usePairingSlots();
  const {
    phase: checkPhase,
    slotInfo,
    noPairingSlots,
    checkSlots,
    resetNFCOnly: resetCheckNFCOnly,
    readSlotInfoFromCmdSet,
  } = check;

  const unpairHook = useKeycardOperation<void>();
  const {
    phase: unpairPhase,
    execute: executeUnpair,
    reset: resetUnpair,
  } = unpairHook;

  const active = unpairing ? unpairHook : check;
  const { sheet } = useKeycardScreen({
    keycard: active,
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
    if (checkPhase === 'idle' && !slotInfo && !noPairingSlots) {
      checkSlots();
    }
  }, [checkPhase, slotInfo, noPairingSlots, checkSlots]);

  useEffect(() => {
    if (unpairPhase === 'done') {
      resetUnpair();
      // slotInfo was already refreshed inside the unpair tap.
      resetCheckNFCOnly();
    }
  }, [unpairPhase, resetUnpair, resetCheckNFCOnly]);

  // When the unpair tap ends, not while it waits for its NFC check.
  const lastUnpairPhaseRef = useRef(unpairPhase);
  useEffect(() => {
    const last = lastUnpairPhaseRef.current;
    lastUnpairPhaseRef.current = unpairPhase;
    if (last !== 'idle' && unpairPhase === 'idle') {
      setUnpairing(false);
    }
  }, [unpairPhase]);

  const handleUnpairPress = useCallback((slotIndex: number) => {
    setPendingSlotIndex(slotIndex);
  }, []);

  const handleConfirmUnpair = useCallback(() => {
    const slotIndex = pendingSlotIndex!;
    const unpaired = `Slot ${slotIndex + 1} was unpaired`;
    setPendingSlotIndex(null);
    setUnpairing(true);
    executeUnpair(
      async cmdSet => {
        await cmdSet.unpair(slotIndex);
        if (slotInfo?.ourSlotIndex === slotIndex) {
          try {
            await deletePairing(slotInfo.cardKey);
          } catch {
            // Card-side unpair already succeeded; local cleanup is best-effort.
          }
        }
        // Re-read in the same connection, so no second tap is needed.
        await readSlotInfoFromCmdSet(cmdSet);
        setUnpairNotice(unpaired);
      },
      // The slots were read from one card; the unpair tap can land on another.
      {
        requiresPin: true,
        requiresMasterKey: false,
        requiresRoute: 'PairingSlots',
        successMessage: unpaired,
      },
    );
  }, [pendingSlotIndex, executeUnpair, slotInfo, readSlotInfoFromCmdSet]);

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
    !unpairing &&
    (checkPhase === 'idle' || checkPhase === 'done' || checkPhase === 'error');

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

          {!slotInfo && !noPairingSlots && checkPhase !== 'error' && (
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

      {sheet}

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
