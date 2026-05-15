import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import InfoRow from '@/components/InfoRow';

export function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="labelMedium" style={styles.sectionHeaderText}>
        {title}
      </Text>
    </View>
  );
}

export function DigestRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <InfoRow label={label} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
  },
  sectionHeader: {
    paddingTop: 8,
  },
  sectionHeaderText: {
    color: theme.colors.onSurfaceVariant,
  },
});
