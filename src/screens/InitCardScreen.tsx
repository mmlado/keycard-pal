import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '../assets/icons';
import { DashboardAction, InitCardScreenProps } from '../navigation/types';
import theme from '../theme';

import ConfirmPrompt from '../components/ConfirmPropmpt';
import NFCBottomSheet from '../components/NFCBottomSheet';
import PinPad from '../components/PinPad';
import PukReview from '../components/PukReview';

import { useInitCard } from '../hooks/keycard/useInitCard';
import { useConfirmedEntry } from '../hooks/useConfirmedEntry';
import { useKeycardScreen } from '../hooks/useKeycardScreen';

export const dashboardEntry: DashboardAction = {
  label: 'Initialize',
  icon: Icons.cardInit,
  navigate: nav => nav.navigate('InitCard'),
};

type ScreenStep =
  | 'pin_setup'
  | 'duress_question'
  | 'duress_setup'
  | 'puk_review';

export default function InitCardScreen({ navigation }: InitCardScreenProps) {
  const insets = useSafeAreaInsets();
  const [screenStep, setScreenStep] = useState<ScreenStep>('pin_setup');
  const mainPinRef = useRef('');
  const duressPinRef = useRef<string | null>(null);

  const keycard = useInitCard();
  const { phase, puk, start } = keycard;

  const pinSetup = useConfirmedEntry(pin => {
    mainPinRef.current = pin;
    setScreenStep('duress_question');
  });

  const duressSetup = useConfirmedEntry(pin => {
    duressPinRef.current = pin;
    setScreenStep('puk_review');
  });

  const handleDuressYes = useCallback(() => {
    setScreenStep('duress_setup');
  }, []);

  const handleDuressNo = useCallback(() => {
    duressPinRef.current = null;
    setScreenStep('puk_review');
  }, []);

  // Nothing is written until the PUK is on paper.
  const handlePukWrittenDown = useCallback(() => {
    start(mainPinRef.current, duressPinRef.current);
    mainPinRef.current = '';
    duressPinRef.current = null;
  }, [start]);

  // Back from the PUK lands on the last question answered.
  const leavePukReview = useCallback(() => {
    if (duressPinRef.current !== null) {
      setScreenStep('duress_setup');
      duressSetup.jumpToConfirm();
    } else {
      setScreenStep('duress_question');
    }
  }, [duressSetup]);

  const onScreenBack = useCallback(() => {
    if (screenStep === 'pin_setup') {
      const handled = pinSetup.goBack();
      if (!handled) {
        navigation.goBack();
      }
      return true;
    }

    if (screenStep === 'duress_question') {
      setScreenStep('pin_setup');
      pinSetup.jumpToConfirm();
      return true;
    }

    if (screenStep === 'duress_setup') {
      const handled = duressSetup.goBack();
      if (!handled) {
        setScreenStep('duress_question');
      }
      return true;
    }

    if (screenStep === 'puk_review') {
      leavePukReview();
      return true;
    }

    return true;
  }, [screenStep, pinSetup, duressSetup, leavePukReview, navigation]);

  const title = (() => {
    if (screenStep === 'pin_setup') {
      return pinSetup.step === 'entry' ? 'Create a PIN' : 'Confirm your PIN';
    }
    if (screenStep === 'duress_question') {
      return 'Initialize Card';
    }
    if (screenStep === 'puk_review') {
      return 'Write down your PUK';
    }
    return duressSetup.step === 'entry'
      ? 'Create a duress PIN'
      : 'Confirm duress PIN';
  })();

  const { onCancel } = useKeycardScreen({
    keycard,
    navigation,
    title,
    done: { toast: 'Card initialized' },
    onHardwareBack: onScreenBack,
    onBeforeRemove: e => {
      if (screenStep === 'pin_setup' && pinSetup.step === 'confirm') {
        e.preventDefault();
        pinSetup.goBack();
        return;
      }
      if (screenStep === 'duress_question') {
        e.preventDefault();
        setScreenStep('pin_setup');
        pinSetup.jumpToConfirm();
        return;
      }
      if (screenStep === 'duress_setup') {
        e.preventDefault();
        const handled = duressSetup.goBack();
        if (!handled) {
          setScreenStep('duress_question');
        }
        return;
      }
      if (screenStep === 'puk_review') {
        e.preventDefault();
        leavePukReview();
      }
    },
  });

  const activePinSetup =
    screenStep === 'pin_setup'
      ? pinSetup
      : screenStep === 'duress_setup'
      ? duressSetup
      : null;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {phase === 'idle' && activePinSetup && (
        <PinPad
          key={activePinSetup.step}
          onComplete={
            activePinSetup.step === 'entry'
              ? activePinSetup.handleEntry
              : activePinSetup.handleConfirm
          }
          error={activePinSetup.error}
          onType={activePinSetup.clearError}
        />
      )}

      {phase === 'idle' && screenStep === 'duress_question' && (
        <ConfirmPrompt
          title="Add a duress PIN?"
          description="A duress PIN unlocks the card but shows a decoy account. Use it if you are ever forced to access your wallet under pressure."
          yesLabel="Yes, add duress PIN"
          noLabel="No, skip"
          onYes={handleDuressYes}
          onNo={handleDuressNo}
        />
      )}

      {phase === 'idle' && screenStep === 'puk_review' && (
        <PukReview puk={puk} onDone={handlePukWrittenDown} />
      )}

      <NFCBottomSheet nfc={keycard} onCancel={onCancel} showOnDone />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
