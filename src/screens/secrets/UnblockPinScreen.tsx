import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PUK_LENGTH } from '@/constants/keycard';
import type { UnblockPinScreenProps } from '@/navigation/types';
import theme from '@/theme';

import PinPad from '@/components/PinPad';

import { useUnblockPin } from '@/hooks/keycard/useUnblockPin';
import { useConfirmedEntry } from '@/hooks/useConfirmedEntry';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';

type ScreenStep = 'pin_setup' | 'puk_entry';

export default function UnblockPinScreen({
  navigation,
}: UnblockPinScreenProps) {
  const insets = useSafeAreaInsets();
  const [screenStep, setScreenStep] = useState<ScreenStep>('pin_setup');
  // Kept for the tap after a refused PUK, which asks for the PUK alone.
  const newPinRef = useRef('');

  const keycard = useUnblockPin();
  const { phase, pukError, start } = keycard;

  const pinSetup = useConfirmedEntry(pin => {
    newPinRef.current = pin;
    setScreenStep('puk_entry');
  });

  const handlePuk = useCallback(
    (puk: string) => {
      start(puk, newPinRef.current);
    },
    [start],
  );

  const backToPinConfirm = useCallback(() => {
    setScreenStep('pin_setup');
    pinSetup.jumpToConfirm();
  }, [pinSetup]);

  const stepBack = useCallback(() => {
    if (screenStep === 'puk_entry') {
      backToPinConfirm();
      return true;
    }
    return pinSetup.goBack();
  }, [screenStep, pinSetup, backToPinConfirm]);

  const title =
    screenStep === 'puk_entry'
      ? 'Enter your PUK'
      : pinSetup.step === 'entry'
      ? 'Enter new PIN'
      : 'Confirm new PIN';

  const { sheet } = useKeycardScreen({
    keycard,
    navigation,
    title,
    done: {},
    stepBack,
    canStepBack: screenStep === 'puk_entry' || pinSetup.step === 'confirm',
    showOnDone: true,
  });

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {phase === 'idle' && screenStep === 'pin_setup' && (
        <PinPad
          key={pinSetup.step}
          onComplete={
            pinSetup.step === 'entry'
              ? pinSetup.handleEntry
              : pinSetup.handleConfirm
          }
          error={pinSetup.error}
          onType={pinSetup.clearError}
        />
      )}

      {phase === 'idle' && screenStep === 'puk_entry' && (
        <PinPad
          length={PUK_LENGTH}
          onComplete={handlePuk}
          error={pukError ?? undefined}
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
});
