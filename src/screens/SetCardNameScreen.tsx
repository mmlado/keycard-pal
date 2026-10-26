import { useCallback, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { SetCardNameScreenProps } from '@/navigation/types';
import theme from '@/theme';

import { Icons } from '@/assets/icons';
import BottomActionArea from '@/components/BottomActionArea';
import PrimaryButton from '@/components/PrimaryButton';

import { useSetCardName } from '@/hooks/keycard/useSetCardName';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';

import { MAX_KEYCARD_NAME_LENGTH } from '@/utils/keycardName';

export default function SetCardNameScreen({
  navigation,
}: SetCardNameScreenProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const keycard = useSetCardName();
  const { phase, start } = keycard;

  const { sheet } = useKeycardScreen({
    keycard,
    navigation,
    title: 'Set card name',
    done: {},
    showOnDone: true,
  });

  const handleSubmit = useCallback(() => {
    try {
      setError(null);
      start(name);
    } catch (e: any) {
      setError(e.message);
    }
  }, [name, start]);

  return (
    <View style={styles.container}>
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

          <BottomActionArea>
            <PrimaryButton
              label="Save card name"
              onPress={handleSubmit}
              icon={Icons.nfcActivate}
            />
          </BottomActionArea>
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
});
