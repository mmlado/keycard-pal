import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { IconComponent } from '../assets/icons';
import theme from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconComponent;
  disabled?: boolean;
  testID?: string;
};

export default function PrimaryButton({
  label,
  onPress,
  icon: Icon,
  disabled = false,
  testID,
}: Props) {
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const contentColor = disabled ? '#1D1B20' : theme.colors.onSurface;

  return (
    <Pressable
      style={[styles.button, disabled && styles.buttonDisabled]}
      android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
      onPress={handlePress}
      disabled={disabled}
      testID={testID}
    >
      <View style={styles.content}>
        {Icon && <Icon width={24} height={24} color={contentColor} />}
        <Text
          variant="labelLarge"
          style={[styles.text, { color: contentColor }]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    minHeight: 40,
  },
  buttonDisabled: {
    backgroundColor: '#E2E2E21A',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontWeight: '600',
  },
});
