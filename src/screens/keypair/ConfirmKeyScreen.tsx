import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_NAME } from '@/constants/app';
import { ConfirmKeySreenProps } from '@/navigation/types';
import theme from '@/theme';

import MnemonicBackupCheck from '@/components/MnemonicBackupCheck';
import PreparingKeyCard from '@/components/PreparingKeyCard';

import { deriveMnemonicKeyPair, useLoadKey } from '@/hooks/keycard/useLoadKey';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';

export default function ConfirmKeyScreen({
  navigation,
  route,
}: ConfirmKeySreenProps) {
  const insets = useSafeAreaInsets();
  const { words, passphrase } = route.params;
  const [preparing, setPreparing] = useState(false);

  const keycard = useLoadKey();
  const { start } = keycard;

  const { onCancel, sheet } = useKeycardScreen({
    keycard,
    navigation,
    title: 'Check your backup',
    done: {},
  });

  const [attemptKey, setAttemptKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAttemptKey(k => k + 1);
    }, []),
  );

  const handleFailure = onCancel;

  // The derivation blocks the JS thread, so the loading state is drawn first.
  const handleComplete = useCallback(() => {
    setPreparing(true);
    setTimeout(() => {
      try {
        start(deriveMnemonicKeyPair(words, passphrase));
      } finally {
        setPreparing(false);
      }
    }, 0);
  }, [passphrase, start, words]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <MnemonicBackupCheck
        key={attemptKey}
        words={words}
        description="Confirm word positions in your recovery phrase."
        onComplete={handleComplete}
        onFailure={handleFailure}
      />

      {preparing && (
        <View style={styles.preparing}>
          <PreparingKeyCard
            description={`${APP_NAME} is deriving the key before it asks you to tap the card.`}
          />
        </View>
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
  preparing: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
