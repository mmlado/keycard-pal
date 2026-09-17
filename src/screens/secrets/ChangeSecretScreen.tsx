import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '@/assets/icons';
import { cardHasRoute, routeAbsence } from '@/navigation/generationBoundRoutes';
import type { ChangeSecretScreenProps, SecretType } from '@/navigation/types';
import theme from '@/theme';

import NFCBottomSheet from '@/components/NFCBottomSheet';
import PinPad from '@/components/PinPad';
import PrimaryButton from '@/components/PrimaryButton';
import TextEntry from '@/components/TextEntry';

import { useChangeSecret } from '@/hooks/keycard/useChangeSecret';
import { useIdentifyCard } from '@/hooks/keycard/useIdentifyCard';
import { useConfirmedEntry } from '@/hooks/useConfirmedEntry';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';

type SecretConfig = {
  inputType: 'numeric' | 'text';
  length?: number;
  entryTitle: string;
  confirmTitle: string;
  toast: string;
};

const SECRET_CONFIG: Record<SecretType, SecretConfig> = {
  pin: {
    inputType: 'numeric',
    length: 6,
    entryTitle: 'Enter new PIN',
    confirmTitle: 'Confirm new PIN',
    toast: 'PIN changed',
  },
  puk: {
    inputType: 'numeric',
    length: 12,
    entryTitle: 'Enter new PUK',
    confirmTitle: 'Confirm new PUK',
    toast: 'PUK changed',
  },
  pairing: {
    inputType: 'text',
    entryTitle: 'Enter new pairing secret',
    confirmTitle: 'Confirm pairing secret',
    toast: 'Pairing secret changed',
  },
};

/** Header while the card is still being identified, or turned out not to have one. */
const PAIRING_SECRET_TITLE = 'Change pairing secret';

export const IDENTIFY_EXPLAINER =
  'Hold your Keycard against the phone. Keycard Pal checks whether this ' +
  'card has a pairing secret before asking you for a new one.';

export default function ChangeSecretScreen({
  route,
  navigation,
}: ChangeSecretScreenProps) {
  const { secretType } = route.params;
  const config = SECRET_CONFIG[secretType];
  const insets = useSafeAreaInsets();

  const keycard = useChangeSecret(secretType);
  const { phase } = keycard;

  // Newer cards have no pairing secret, and the menu cannot know the card. So
  // this one secret is identify-then-operate (ADR-0012): a first tap that only
  // reads the card, then the input, then the tap that changes it. Nothing is
  // asked of the user for a change the card cannot make.
  const needsIdentify = secretType === 'pairing';
  const identify = useIdentifyCard();
  const { generation, phase: identifyPhase, start: startIdentify } = identify;

  const identifying = needsIdentify && generation === null;
  const unavailable =
    needsIdentify &&
    generation !== null &&
    !cardHasRoute('ChangePairingSecret', generation);
  const absence = routeAbsence('ChangePairingSecret');

  // Once per mount, and not on focus: dismissing Apple's NFC sheet returns the
  // session to 'idle', and restarting on that would put the sheet straight
  // back up. The button below is the way forward from there.
  const identifyStartedRef = useRef(false);
  useEffect(() => {
    if (!needsIdentify || identifyStartedRef.current) {
      return;
    }
    identifyStartedRef.current = true;
    startIdentify();
  }, [needsIdentify, startIdentify]);

  const entry = useConfirmedEntry(newSecret => keycard.start(newSecret), {
    length: config.length,
  });

  const onScreenBack = useCallback(() => {
    const handled = entry.goBack();
    if (!handled) {
      navigation.goBack();
    }
    return true;
  }, [entry, navigation]);

  const stepTitle =
    entry.step === 'entry' ? config.entryTitle : config.confirmTitle;

  // `keycard` stays the change itself, so only the second tap can end the
  // screen with the toast. The identify tap borrows the guard, the title and
  // the sheet while it runs.
  const activeKeycard = identifying ? identify : keycard;

  const { onCancel } = useKeycardScreen({
    keycard,
    activeKeycard,
    navigation,
    title: identifying || unavailable ? PAIRING_SECRET_TITLE : stepTitle,
    pinEntryTitle: 'Enter current PIN',
    done: { toast: config.toast },
    onHardwareBack: onScreenBack,
    onBeforeRemove: e => {
      if (entry.step === 'confirm') {
        e.preventDefault();
        entry.goBack();
      }
    },
  });

  if (unavailable) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.message}>
          <Text style={styles.messageTitle}>{absence.title}</Text>
          <Text style={styles.messageDetail}>{absence.detail}</Text>
        </View>
        <View style={styles.footer}>
          <PrimaryButton label="Go back" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  const showInput = phase === 'idle' && !identifying;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {identifying && (
        <>
          <View style={styles.message}>
            <Text style={styles.messageDetail}>{IDENTIFY_EXPLAINER}</Text>
          </View>
          <View style={styles.footer}>
            {/* Always drawn, so it neither flashes before the tap starts nor
                leaves a blank screen behind Apple's sheet. */}
            <PrimaryButton
              label="Read Keycard"
              icon={Icons.nfcActivate}
              onPress={startIdentify}
              disabled={identifyPhase !== 'idle'}
              testID="identify-card-button"
            />
          </View>
        </>
      )}

      {showInput && config.inputType === 'numeric' && (
        <PinPad
          key={entry.step}
          length={entry.length}
          onComplete={
            entry.step === 'entry' ? entry.handleEntry : entry.handleConfirm
          }
          error={entry.error}
          onType={entry.clearError}
        />
      )}

      {showInput && config.inputType === 'text' && (
        <TextEntry
          resetKey={entry.step}
          onSubmit={
            entry.step === 'entry' ? entry.handleEntry : entry.handleConfirm
          }
          error={entry.error}
          onType={entry.clearError}
        />
      )}

      {/* The identify tap ends in 'done' too, and that is not an outcome to
          celebrate: the sheet just steps aside for the input. */}
      <NFCBottomSheet
        nfc={activeKeycard}
        onCancel={onCancel}
        showOnDone={!identifying}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  message: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  messageTitle: {
    color: theme.colors.onSurface,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  messageDetail: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
  },
});
