import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmKeySreenProps } from '../../navigation/types';
import theme from '../../theme';

import MnemonicBackupCheck from '../../components/MnemonicBackupCheck';
import NFCBottomSheet from '../../components/NFCBottomSheet';

import {
  deriveMnemonicKeyPair,
  useLoadKey,
} from '../../hooks/keycard/useLoadKey';
import { useKeycardScreen } from '../../hooks/useKeycardScreen';

export default function ConfirmKeyScreen({
  navigation,
  route,
}: ConfirmKeySreenProps) {
  const insets = useSafeAreaInsets();
  const { words, passphrase } = route.params;
  const keyPair = useMemo(
    () => deriveMnemonicKeyPair(words, passphrase),
    [passphrase, words],
  );

  const keycard = useLoadKey();
  const { start } = keycard;

  const { onCancel } = useKeycardScreen({
    keycard,
    navigation,
    title: 'Check your backup',
    done: { toast: 'Key pair has been added to Keycard' },
  });

  const [attemptKey, setAttemptKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAttemptKey(k => k + 1);
    }, []),
  );

  const handleFailure = onCancel;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <MnemonicBackupCheck
        key={attemptKey}
        words={words}
        description="Confirm word positions in your recovery phrase."
        onComplete={() => start(keyPair)}
        onFailure={handleFailure}
      />

      <NFCBottomSheet nfc={keycard} onCancel={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
