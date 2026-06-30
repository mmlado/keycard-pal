import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import { importLedgerRegistryZipFromPicker } from '@/utils/eip7730/import';

type Props = {
  onImported: (indexedAt: string) => void;
  disabled?: boolean;
};

export default function ImportRegistryButton({ onImported, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePress = useCallback(async () => {
    if (busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importLedgerRegistryZipFromPicker();
      if (!result.ok) {
        if (result.reason === 'invalid') {
          setError('File is not a valid Ledger registry zip.');
        } else if (result.reason === 'unreadable') {
          setError('Could not read the selected file.');
        }
        return;
      }
      onImported(result.indexedAt);
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, onImported]);

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={[styles.button, (busy || disabled) && styles.buttonDisabled]}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        onPress={handlePress}
        disabled={busy || disabled}
        testID="eip7730-import-button"
      >
        <View style={styles.content}>
          {busy ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Text variant="labelLarge" style={styles.label}>
              Import Ledger Registry Zip
            </Text>
          )}
        </View>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  button: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: theme.colors.primary,
  },
  error: {
    color: theme.colors.error,
    fontSize: 12,
  },
});
