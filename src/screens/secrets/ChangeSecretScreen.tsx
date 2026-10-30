import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icons } from '@/assets/icons';
import {
  cardHasRoute,
  everyCardInUseHasRoute,
  routeAbsence,
} from '@/navigation/generationBoundRoutes';
import type { ChangeSecretScreenProps, SecretType } from '@/navigation/types';
import theme from '@/theme';

import BottomActionArea from '@/components/BottomActionArea';
import PinPad from '@/components/PinPad';
import PrimaryButton from '@/components/PrimaryButton';
import TextEntry from '@/components/TextEntry';

import { useChangeSecret } from '@/hooks/keycard/useChangeSecret';
import { useIdentifyCard } from '@/hooks/keycard/useIdentifyCard';
import { useConfirmedEntry } from '@/hooks/useConfirmedEntry';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';
import { usePreferences } from '@/hooks/usePreferences';

type SecretConfig = {
  inputType: 'numeric' | 'text';
  length?: number;
  entryTitle: string;
  confirmTitle: string;
};

const SECRET_CONFIG: Record<SecretType, SecretConfig> = {
  pin: {
    inputType: 'numeric',
    length: 6,
    entryTitle: 'Enter new PIN',
    confirmTitle: 'Confirm new PIN',
  },
  puk: {
    inputType: 'numeric',
    length: 12,
    entryTitle: 'Enter new PUK',
    confirmTitle: 'Confirm new PUK',
  },
  pairing: {
    inputType: 'text',
    entryTitle: 'Enter new pairing secret',
    confirmTitle: 'Confirm pairing secret',
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

  const keycard = useChangeSecret(secretType);
  const { phase } = keycard;

  // Identify-then-operate (ADR-0012); skipping it is safe because `requiresRoute` guards the tap.
  const { preferences } = usePreferences();
  const needsIdentify =
    secretType === 'pairing' &&
    !everyCardInUseHasRoute(
      'ChangePairingSecret',
      preferences.generationsInUse,
    );
  const identify = useIdentifyCard();
  const { generation, phase: identifyPhase, start: startIdentify } = identify;

  const identifying = needsIdentify && generation === null;
  const unavailable =
    needsIdentify &&
    generation !== null &&
    !cardHasRoute('ChangePairingSecret', generation);
  const absence = routeAbsence('ChangePairingSecret');

  // Once per mount, not on focus: dismissing Apple's sheet returns to 'idle' and would reopen it.
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

  const stepTitle =
    entry.step === 'entry' ? config.entryTitle : config.confirmTitle;

  // `keycard` stays the change, so only the second tap ends the screen.
  const activeKeycard = identifying ? identify : keycard;

  const { sheet } = useKeycardScreen({
    keycard,
    activeKeycard,
    navigation,
    title: identifying || unavailable ? PAIRING_SECRET_TITLE : stepTitle,
    pinEntryTitle: 'Enter current PIN',
    done: {},
    stepBack: entry.goBack,
    canStepBack: entry.step === 'confirm',
    // The identify tap's done is no outcome: the sheet steps aside for the input.
    showOnDone: !identifying,
  });

  if (unavailable) {
    return (
      <View style={styles.container}>
        <View style={styles.message}>
          <Text style={styles.messageTitle}>{absence.title}</Text>
          <Text style={styles.messageDetail}>{absence.detail}</Text>
        </View>
        <BottomActionArea style={styles.footer}>
          <PrimaryButton label="Go back" onPress={() => navigation.goBack()} />
        </BottomActionArea>
      </View>
    );
  }

  const showInput = phase === 'idle' && !identifying;

  return (
    <View style={styles.container}>
      {identifying && (
        <>
          <View style={styles.message}>
            <Text style={styles.messageDetail}>{IDENTIFY_EXPLAINER}</Text>
          </View>
          <BottomActionArea style={styles.footer}>
            {/* Always drawn, so nothing flashes or goes blank behind Apple's sheet. */}
            <PrimaryButton
              label="Read Keycard"
              icon={Icons.nfcActivate}
              onPress={startIdentify}
              disabled={identifyPhase !== 'idle'}
              testID="identify-card-button"
            />
          </BottomActionArea>
        </>
      )}

      {showInput && config.inputType === 'numeric' && (
        <BottomActionArea style={styles.pinPad}>
          <PinPad
            key={entry.step}
            length={entry.length}
            onComplete={
              entry.step === 'entry' ? entry.handleEntry : entry.handleConfirm
            }
            error={entry.error}
            onType={entry.clearError}
          />
        </BottomActionArea>
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

      {sheet}
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
  pinPad: {
    flex: 1,
  },
});
