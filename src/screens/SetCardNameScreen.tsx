import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SetCardNameScreenProps } from '../navigation/types';
import theme from '../theme';

import { Icons } from '../assets/icons';
import NFCBottomSheet from '../components/NFCBottomSheet';
import PrimaryButton from '../components/PrimaryButton';
import { useSetCardName } from '../hooks/keycard/useSetCardName';
import { useKeycardScreen } from '../hooks/useKeycardScreen';
import { MAX_KEYCARD_NAME_LENGTH } from '../utils/keycardName';

export default function SetCardNameScreen({
  navigation,
}: SetCardNameScreenProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keycard = useSetCardName();
  const { phase, start } = keycard;

  const { onCancel } = useKeycardScreen({
    keycard,
    navigation,
    title: 'Set card name',
    done: { toast: 'Card name updated' },
  });

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Android reports the keyboard height with the navigation bar inset already
  // taken off, so it has to be added back.
  const keyboardPadding =
    keyboardHeight + (Platform.OS === 'android' ? insets.bottom : 0) + 8;

  const handleSubmit = useCallback(() => {
    try {
      setError(null);
      start(name);
    } catch (e: any) {
      setError(e.message);
    }
  }, [name, start]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom:
            keyboardHeight > 0 ? keyboardPadding : insets.bottom + 16,
        },
      ]}
    >
      {phase === 'idle' && (
        <View style={styles.content}>
          <View style={styles.body}>
            <Text style={styles.description}>
              Set a short label stored on the Keycard. Leave it empty to clear
              the current name.
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={value => {
                setName(value);
                setError(null);
              }}
              maxLength={MAX_KEYCARD_NAME_LENGTH}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Unnamed card"
              placeholderTextColor={theme.colors.onSurfaceDisabled}
            />
            <Text style={[styles.error, !error && styles.errorHidden]}>
              {error ?? ''}
            </Text>
          </View>

          <View style={styles.footer}>
            <PrimaryButton
              label="Save card name"
              onPress={handleSubmit}
              icon={Icons.nfcActivate}
            />
          </View>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  description: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  input: {
    backgroundColor: theme.colors.surfaceVariant,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.onSurface,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    color: theme.colors.onSurface,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  error: {
    color: theme.colors.errorDark,
    fontSize: 12,
    height: 20,
    lineHeight: 16,
    paddingTop: 4,
  },
  errorHidden: {
    opacity: 0,
  },
  footer: {
    paddingBottom: 16,
  },
});
