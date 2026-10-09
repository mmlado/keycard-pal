import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import theme from '@/theme';

import { Icons } from '@/assets/icons';
import PrimaryButton from '@/components/PrimaryButton';

type Props = {
  error: string | null;
  onSubmit: (password: string) => void;
  onCancel: () => void;
};

export default function PairingPasswordEntry({
  error,
  onSubmit,
  onCancel,
}: Props) {
  const [password, setPassword] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const insets = useSafeAreaInsets();

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

  /** The sheet's Modal never resizes for the keyboard, and Android reports a height that leaves out the navigation bar. */
  const paddingBottom =
    keyboardHeight > 0
      ? keyboardHeight + (Platform.OS === 'android' ? insets.bottom : 0) + 8
      : Math.max(insets.bottom, 16) + 8;

  const handleSubmit = () => {
    const trimmed = password.trim();
    if (trimmed.length > 0) {
      onSubmit(trimmed);
    }
  };

  return (
    <View
      testID="pairing-password-entry"
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom,
        },
      ]}
    >
      <View style={styles.content}>
        <Icons.nfcActivate
          width={64}
          height={64}
          color={theme.colors.primary}
        />
        <Text variant="headlineSmall" style={styles.title}>
          Custom pairing password
        </Text>
        <Text variant="bodyMedium" style={styles.body}>
          Your Keycard uses a non-default pairing password. Enter it to continue
          — you will need to tap your card again.
        </Text>

        <TextInput
          style={styles.input}
          secureTextEntry
          autoFocus
          placeholder="Pairing password"
          placeholderTextColor={theme.colors.onSurfacePlaceholder}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
        />

        {error !== null && (
          <Text variant="bodySmall" style={styles.error}>
            {error}
          </Text>
        )}
      </View>

      <View style={styles.buttons}>
        <PrimaryButton
          label="Continue"
          onPress={handleSubmit}
          disabled={password.trim().length === 0}
        />
        <Pressable
          style={styles.cancelButton}
          android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
          onPress={onCancel}
        >
          <Text variant="labelLarge" style={styles.cancelText}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    color: theme.colors.onSurface,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    width: '100%',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 12,
    color: theme.colors.onSurface,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  error: {
    color: theme.colors.error,
    textAlign: 'center',
  },
  buttons: {
    gap: 8,
    width: '100%',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: theme.colors.onSurfaceDisabled,
  },
});
