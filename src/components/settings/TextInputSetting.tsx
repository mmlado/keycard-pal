import { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';

import theme from '../../theme';

import { useFieldFocus, type SettingsField } from './fieldFocus';

export default function TextInputSetting({
  label,
  value,
  dirty,
  saving,
  error,
  placeholder,
  keyboardType,
  disableSave,
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
  disableSave?: boolean;
  onChangeText: (v: string) => void;
  onRevert?: () => void;
  onSave: () => void;
}) {
  const inputRef = useRef<SettingsField>(null);
  const onFieldFocus = useFieldFocus();
  const handleFocus = useCallback(
    () => onFieldFocus(inputRef.current),
    [onFieldFocus],
  );

  return (
    <>
      <Text variant="bodySmall" style={styles.label}>
        {label}
      </Text>
      <TextInput
        ref={inputRef}
        onFocus={handleFocus}
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
          {dirty && !saving && onRevert && (
            <Text style={styles.revertButton} onPress={onRevert}>
              Revert
            </Text>
          )}
          <Text
            style={[
              styles.saveButton,
              (saving || disableSave) && styles.saveButtonDisabled,
            ]}
            onPress={saving || disableSave ? undefined : onSave}
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
