import { Pressable, StyleSheet, Text, View } from 'react-native';

import theme from '../../theme';

export default function EnsErrorRow({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.errorText}>⚠ ENS unavailable</Text>
      <Pressable
        onPress={onRetry}
        style={styles.refreshButton}
        accessibilityLabel="Refresh ENS lookup"
      >
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontFamily: 'Inter_18pt-Regular',
    fontSize: 12,
    color: theme.colors.error,
  },
  refreshButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  refreshText: {
    fontFamily: 'Inter_18pt-Medium',
    fontSize: 12,
    color: theme.colors.primary,
  },
});
