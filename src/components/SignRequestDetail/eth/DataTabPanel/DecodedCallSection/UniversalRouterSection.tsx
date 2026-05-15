import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '@/theme';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import type { DecodedCall } from '@/utils/txParser';

export default function UniversalRouterSection({
  call,
}: {
  call: Extract<DecodedCall, { kind: 'universal-router-execute' }>;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text variant="labelMedium" style={styles.sectionHeaderText}>
          Uniswap Universal Router
        </Text>
      </View>
      {call.deadline && (
        <View style={styles.row}>
          <InfoRow label="Deadline" value={call.deadline} />
        </View>
      )}
      {call.error && (
        <View style={styles.warningRow}>
          <Icon source="alert" size={16} color={theme.colors.negative} />
          <Text variant="labelSmall" style={styles.warningText}>
            {call.error}
          </Text>
        </View>
      )}
      {call.commands.map(command => (
        <View key={`${command.index}-${command.command}`} style={styles.row}>
          <InfoRow
            label={`Command ${command.index + 1}`}
            value={`${command.name}${
              command.allowRevert ? ' (allow revert)' : ''
            }`}
          />
          {command.args.map(arg =>
            arg.type === 'address' ? (
              <AddressInfoRow
                key={`${command.index}-${arg.name}`}
                label={`${arg.name} (${arg.type})`}
                value={arg.value}
              />
            ) : (
              <InfoRow
                key={`${command.index}-${arg.name}`}
                label={`${arg.name} (${arg.type})`}
                value={arg.value}
              />
            ),
          )}
          {command.error && <InfoRow label="Decode" value={command.error} />}
          {command.rawInput && (
            <InfoRow label="Input" value={command.rawInput} />
          )}
        </View>
      ))}
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
