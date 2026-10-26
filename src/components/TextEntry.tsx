import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import BottomActionArea from './BottomActionArea';
import PrimaryButton from './PrimaryButton';

type TextEntryProps = {
  onSubmit: (value: string) => void;
  error?: string;
  onType: () => void;
  /** A new value clears the field. */
  resetKey?: string | number;
};

export default function TextEntry({
  onSubmit,
  error,
  onType,
  resetKey,
}: TextEntryProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue('');
  }, [resetKey]);

  const handleSubmit = useCallback(() => {
    if (!value) {
      return;
    }
    onSubmit(value);
    setValue('');
  }, [value, onSubmit]);

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={text => {
            setValue(text);
            onType();
          }}
          secureTextEntry
          autoFocus
          placeholderTextColor={theme.colors.onSurfaceDisabled}
          placeholder="Pairing secret"
        />
        <Text style={[styles.error, !error && styles.errorHidden]}>
          {error ?? ''}
        </Text>
      </View>
      <BottomActionArea>
        <PrimaryButton
          label="Continue"
          onPress={handleSubmit}
          disabled={!value}
        />
      </BottomActionArea>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-end',
    gap: 16,
  },
  field: {
    flex: 1,
    justifyContent: 'center',
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
    lineHeight: 16,
    letterSpacing: 0.4,
    height: 20,
    paddingTop: 4,
  },
  errorHidden: {
    opacity: 0,
  },
});
