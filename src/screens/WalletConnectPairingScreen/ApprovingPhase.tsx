import { View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { EdgeInsets } from 'react-native-safe-area-context';

import theme from '@/theme';
import NFCBottomSheet, { NFCOperation } from '@/components/NFCBottomSheet';

import styles from './styles';

export default function ApprovingPhase({
  accountKeyOp,
  insets,
  onCancel,
}: {
  accountKeyOp: NFCOperation;
  insets: EdgeInsets;
  onCancel: () => void;
}) {
  return (
    <>
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.statusText}>Tap Keycard to connect…</Text>
      </View>
      <NFCBottomSheet nfc={accountKeyOp} onCancel={onCancel} />
    </>
  );
}
