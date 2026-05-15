import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '@/theme';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import type { DecodedCall } from '@/utils/txParser';

export default function ContractCallSection({
  call,
}: {
  call: Extract<DecodedCall, { kind: 'contract-call' }>;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text variant="labelMedium" style={styles.sectionHeaderText}>
          Contract Call
        </Text>
      </View>
      <View style={styles.row}>
        <InfoRow label="Function" value={call.signature} />
      </View>
      {call.args.map((arg, index) => (
        <View key={`${arg.name}-${index}`} style={styles.row}>
          {arg.type === 'address' ? (
            <AddressInfoRow
              label={`${arg.name} (${arg.type})`}
              value={arg.value}
            />
          ) : (
            <InfoRow label={`${arg.name} (${arg.type})`} value={arg.value} />
          )}
        </View>
      ))}
      {call.highRisk && (
        <View style={styles.warningRow}>
          <Icon source="alert" size={16} color={theme.colors.negative} />
          <Text variant="labelSmall" style={styles.warningText}>
            High-risk approval:{' '}
            {call.risk ?? 'review this contract permission carefully'}
          </Text>
        </View>
      )}
    </>
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
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  warningText: {
    color: theme.colors.negative,
    flexShrink: 1,
  },
});
