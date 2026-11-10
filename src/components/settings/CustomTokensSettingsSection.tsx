import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '@/assets/icons';
import theme from '@/theme';

import { useCustomTokens } from '@/hooks/useCustomTokens';

export const CUSTOM_TOKENS_LABEL = 'Custom tokens';

export default function CustomTokensSettingsSection({
  onOpen,
}: {
  onOpen: () => void;
}) {
  const count = useCustomTokens().length;
  return (
    <Pressable
      style={styles.row}
      onPress={onOpen}
      accessibilityRole="button"
      testID="settings-custom-tokens"
    >
      <Text variant="titleMedium" style={styles.label}>
        {CUSTOM_TOKENS_LABEL}
      </Text>
      <Text variant="bodyMedium" style={styles.count}>
        {count}
      </Text>
      <Icons.chevronRight
        width={24}
        height={24}
        color={theme.colors.onSurfaceMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 31,
  },
  label: {
    flex: 1,
    color: theme.colors.onSurface,
  },
  count: {
    color: theme.colors.onSurfaceMuted,
  },
});
