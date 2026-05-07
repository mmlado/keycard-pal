import { StyleSheet, Switch, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '../../theme';

type SettingsToggleRowProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export default function SettingsToggleRow({
  label,
  value,
  onValueChange,
}: SettingsToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <Text variant="bodyMedium" style={styles.label}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: theme.colors.surfaceVariant,
          true: theme.colors.primary,
        }}
        thumbColor={theme.colors.onSurface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: theme.colors.onSurface,
  },
});
