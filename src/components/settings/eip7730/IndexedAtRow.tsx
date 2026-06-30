import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

type Props = {
  indexedAt: string | null;
};

function format(date: string): string {
  try {
    return new Date(date).toLocaleString();
  } catch {
    return date;
  }
}

export default function IndexedAtRow({ indexedAt }: Props) {
  return (
    <View style={styles.row}>
      <Text variant="bodySmall" style={styles.label}>
        Last updated
      </Text>
      <Text variant="bodySmall" style={styles.value}>
        {indexedAt ? format(indexedAt) : 'Bundled (default)'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: theme.colors.onSurfaceVariant,
  },
  value: {
    color: theme.colors.onSurface,
  },
});
