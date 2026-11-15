import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '@/assets/icons';
import theme from '@/theme';

export default function SettingsLinkRow({
  label,
  detail,
  onPress,
  testID,
}: {
  label: string;
  detail: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${detail}`}
      testID={testID}
    >
      <Text variant="titleMedium" style={styles.label}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.detail}>
        {detail}
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
  detail: {
    color: theme.colors.onSurfaceMuted,
  },
});
