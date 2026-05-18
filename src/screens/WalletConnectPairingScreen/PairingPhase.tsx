import { View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { EdgeInsets } from 'react-native-safe-area-context';

import theme from '@/theme';

import styles from './styles';

export default function PairingPhase({ insets }: { insets: EdgeInsets }) {
  return (
    <View style={[styles.centered, { paddingTop: insets.top }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.statusText}>Connecting to dApp…</Text>
    </View>
  );
}
