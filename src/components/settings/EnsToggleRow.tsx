import { StyleSheet, Switch, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '../../theme';

export default function EnsToggleRow({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text variant="bodyMedium" style={styles.label}>
        ENS resolution
      </Text>
      <Switch
        value={enabled}
        onValueChange={onToggle}
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
