import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '@/theme';

import InfoRow from '@/components/InfoRow';

import type { BtcPsbtFee, BtcPsbtSummary } from '@/utils/btcPsbt';

function formatSats(value: number): string {
  return `${value.toLocaleString()} sats`;
}

function describeInputs(indexes: number[]): string {
  const positions = indexes.map(index => String(index + 1));
  if (positions.length === 1) {
    return `input ${positions[0]}`;
  }

  return `inputs ${positions.slice(0, -1).join(', ')} and ${
    positions[positions.length - 1]
  }`;
}

function FeeRow({ fee }: { fee: BtcPsbtFee }) {
  if (fee.kind === 'known') {
    return (
      <View style={styles.row}>
        <InfoRow label="Fee" value={formatSats(fee.sats)} />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <InfoRow label="Fee" value="Unknown" />
      <View style={styles.warningRow}>
        <Icon source="alert" size={16} color={theme.colors.negative} />
        <Text variant="labelSmall" style={styles.warningText}>
          The PSBT does not say how much {describeInputs(fee.inputsWithoutUtxo)}{' '}
          holds, so the fee cannot be worked out here and could be any amount.
        </Text>
      </View>
    </View>
  );
}

export default function PsbtDetail({ summary }: { summary: BtcPsbtSummary }) {
  return (
    <>
      <View style={styles.typeChip}>
        <Icon source="bitcoin" size={18} color={theme.colors.primary} />
        <Text variant="labelLarge" style={styles.typeChipText}>
          {summary.requestType === 'bip322-message'
            ? 'Bitcoin Message'
            : 'Bitcoin PSBT'}
        </Text>
      </View>

      <View style={styles.row}>
        <InfoRow
          label="Network"
          value={
            summary.network === 'mainnet'
              ? 'Bitcoin Mainnet'
              : summary.network === 'testnet'
              ? 'Bitcoin Testnet'
              : 'Unknown'
          }
        />
      </View>

      {summary.requestType === 'bip322-message' ? (
        <>
          <View style={styles.row}>
            <InfoRow label="Format" value="BIP-322 Message" />
          </View>

          {summary.bip322Address && (
            <View style={styles.row}>
              <InfoRow label="Address" value={summary.bip322Address} />
            </View>
          )}
        </>
      ) : (
        <>
          <View style={styles.row}>
            <InfoRow label="Inputs" value={String(summary.inputCount)} />
            <InfoRow label="Outputs" value={String(summary.outputCount)} />
          </View>

          <FeeRow fee={summary.fee} />

          {summary.outputs.map((output, index) => (
            <View key={`${output.address}-${index}`} style={styles.row}>
              <InfoRow
                label={`Output ${index + 1}${
                  output.claimsChange ? ' (marked as change by the wallet)' : ''
                }`}
                value={`${output.address}\n${formatSats(output.valueSats)}`}
              />
            </View>
          ))}
        </>
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
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  warningText: {
    color: theme.colors.negative,
    flexShrink: 1,
  },
});
