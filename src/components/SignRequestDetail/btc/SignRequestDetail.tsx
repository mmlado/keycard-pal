import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '@/theme';
import type { BtcSignRequest } from '@/types';

import InfoRow from '@/components/InfoRow';

import { inspectBtcSignRequest } from '@/utils/btcMessage';

export default function SignRequestDetail({
  request,
}: {
  request: BtcSignRequest;
}) {
  const summary = inspectBtcSignRequest(request);

  return (
    <>
      <View style={styles.typeChip}>
        <Icon source="bitcoin" size={18} color={theme.colors.primary} />
        <Text variant="labelLarge" style={styles.typeChipText}>
          Bitcoin Message
        </Text>
      </View>

      <View style={styles.row}>
        <InfoRow label="Format" value="btc-sign-request" />
      </View>

      <View style={styles.row}>
        <InfoRow label="Message" value={summary.message} />
      </View>

      {request.address && (
        <View style={styles.row}>
          <InfoRow label="Address" value={request.address} />
        </View>
      )}

      <View style={styles.row}>
        <InfoRow label="Derivation path" value={request.derivationPath} />
      </View>

      {request.origin && (
        <View style={styles.row}>
          <InfoRow label="Origin" value={request.origin} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  typeChipText: {
    color: theme.colors.primary,
  },
  row: {
    paddingVertical: 8,
  },
});
