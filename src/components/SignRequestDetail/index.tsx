import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '@/theme';
import type { ScanResult } from '@/types';

import PsbtDetail from './btc/PsbtDetail';
import BtcSignRequestDetail from './btc/SignRequestDetail';
import EthSignRequestDetail from './eth/SignRequestDetail';

export default function SignRequestDetail({ result }: { result: ScanResult }) {
  if (result.kind === 'eth-sign-request') {
    return <EthSignRequestDetail request={result.request} />;
  }

  if (result.kind === 'crypto-psbt') {
    return <PsbtDetail psbtHex={result.request.psbtHex} />;
  }

  if (result.kind === 'btc-sign-request') {
    return <BtcSignRequestDetail request={result.request} />;
  }

  if (result.kind === 'unsupported') {
    return (
      <View style={styles.errorContainer}>
        <Icon
          source="alert-circle-outline"
          size={48}
          color={theme.colors.onSurfaceVariant}
        />
        <Text variant="titleMedium" style={styles.errorTitle}>
          Unsupported QR Type
        </Text>
        <Text variant="bodyMedium" style={styles.errorMessage}>
          {result.type}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.errorContainer}>
      <Icon source="alert-circle" size={48} color={theme.colors.negative} />
      <Text variant="titleMedium" style={styles.errorTitleRed}>
        Scan Error
      </Text>
      <Text variant="bodyMedium" style={styles.errorMessage} selectable>
        {result.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
  },
  errorTitle: {
    color: theme.colors.onSurfaceVariant,
  },
  errorTitleRed: {
    color: theme.colors.negative,
  },
  errorMessage: {
    color: theme.colors.onSurface,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
