import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

type Props = {
  description: string;
};

export default function PreparingKeyCard({ description }: Props) {
  return (
    <View style={styles.card}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.title}>Preparing key material...</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 8,
    gap: 12,
    padding: 24,
  },
  title: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 22,
  },
});
