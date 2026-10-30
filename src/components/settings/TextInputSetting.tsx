import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import { useKeepAboveKeyboard } from '@/components/KeyboardAwareScrollView';

export const SAVE_FAILED = 'Could not save. Try again.';

export default function TextInputSetting({
  label,
  value,
  placeholder,
  keyboardType,
  required,
  onSave,
}: {
  label: string;
  /** What is stored; the draft follows it whenever it changes. */
  value: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  required?: boolean;
  /** Stores the trimmed draft; a string it returns is shown as the error line. */
  onSave: (draft: string) => Promise<string | null | void>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A save can store what was already stored, so the draft is synced after each one too.
  const [saves, setSaves] = useState(0);
  const { block, input } = useKeepAboveKeyboard();

  // Before paint, or a field that is no longer dirty shows Revert and Save for a frame.
  useLayoutEffect(() => {
    setDraft(value);
  }, [value, saves]);

  const trimmed = draft.trim();
  const dirty = trimmed !== value;

  const handleChange = useCallback((text: string) => {
    setDraft(text);
    setError(null);
  }, []);

  const handleRevert = useCallback(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    let line: string | null | void;
    try {
      line = await onSave(trimmed);
    } catch {
      line = SAVE_FAILED;
    }
    setSaving(false);
    if (line) {
      setError(line);
    } else {
      setSaves(count => count + 1);
    }
  }, [onSave, trimmed]);

  const saveDisabled = saving || (required === true && trimmed === '');

  return (
    <View onLayout={block.onLayout} style={styles.block}>
      <Text variant="bodySmall" style={styles.label}>
        {label}
      </Text>
      <TextInput
        onFocus={input.onFocus}
        onBlur={input.onBlur}
        onLayout={input.onLayout}
        style={styles.input}
        value={draft}
        onChangeText={handleChange}
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
            <Text style={styles.revertButton} onPress={handleRevert}>
              Revert
            </Text>
          )}
          <Text
            style={[
              styles.saveButton,
              saveDisabled && styles.saveButtonDisabled,
            ]}
            onPress={saveDisabled ? undefined : handleSave}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              'Save'
            )}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The sections space their rows by 8, which this block keeps inside itself.
  block: {
    gap: 8,
  },
  label: {
    color: theme.colors.onSurfaceVariant,
  },
  input: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.onSurface,
    fontFamily: theme.monospace,
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
