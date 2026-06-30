import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text } from 'react-native-paper';

import theme from '@/theme';

import { useEip7730Download } from '@/hooks/useEip7730Download.online';

function labelFor(phase: string): string {
  if (phase === 'checking') return 'Checking for descriptor updates…';
  if (phase === 'downloading') return 'Downloading descriptors…';
  if (phase === 'processing') return 'Processing descriptors…';
  return '';
}

export default function Eip7730DownloadProgress() {
  const { phase, progress } = useEip7730Download();
  if (
    phase !== 'checking' &&
    phase !== 'downloading' &&
    phase !== 'processing'
  ) {
    return null;
  }
  return (
    <View style={styles.wrapper} testID="eip7730-progress">
      <Text variant="bodySmall" style={styles.label}>
        {labelFor(phase)}
      </Text>
      <ProgressBar
        indeterminate={progress === undefined}
        progress={progress ?? 0}
        color={theme.colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  label: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 11,
  },
});
