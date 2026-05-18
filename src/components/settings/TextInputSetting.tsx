import {
  ActivityIndicator,
  KeyboardTypeOptions,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';

import theme from '../../theme';

export default function TextInputSetting({
  label,
  value,
  dirty,
  saving,
  error,
  placeholder,
  keyboardType,
  onChangeText,
  onRevert,
  onSave,
}: {
  label: string;
  value: string;
  dirty: boolean;
  saving?: boolean;
  error?: string | null;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  onChangeText: (v: string) => void;
  onRevert: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <Text variant="bodySmall" style={styles.label}>
        {label}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        keyboardType={keyboardType}
        editable={!saving}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {(dirty || saving) && (
        <View style={styles.buttonRow}>
          {dirty && !saving && (
            <Text style={styles.revertButton} onPress={onRevert}>
              Revert
            </Text>
          )}
          <Text
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saving ? undefined : onSave}
          >
            {saving ? (
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
  label: {
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
