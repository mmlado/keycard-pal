import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '../../theme';

export default function EnsRpcUrlInput({
  input,
  dirty,
  validating,
  error,
  onChangeText,
  onRevert,
  onSave,
}: {
  input: string;
  dirty: boolean;
  validating: boolean;
  error: string | null;
  onChangeText: (value: string) => void;
  onRevert: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <Text variant="bodySmall" style={styles.fieldLabel}>
        RPC URL
      </Text>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!validating}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {(dirty || validating) && (
        <View style={styles.buttonRow}>
          {dirty && !validating && (
            <Text style={styles.revertButton} onPress={onRevert}>
              Revert
            </Text>
          )}
          <Text
            style={[styles.saveButton, validating && styles.saveButtonDisabled]}
            onPress={validating ? undefined : onSave}
          >
            {validating ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              'Save'
            )}
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: theme.colors.onSurfaceVariant,
  },
  input: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.onSurface,
    fontFamily: 'monospace',
    fontSize: 14,
  },
  error: {
    color: theme.colors.error,
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  revertButton: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
  },
  saveButton: {
    color: theme.colors.primary,
    fontSize: 14,
  },
  saveButtonDisabled: {
    color: theme.colors.onSurfaceDisabled,
  },
});
