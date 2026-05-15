import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '@/theme';

import InfoRow from '@/components/InfoRow';

import { inspectBtcPsbt } from '@/utils/btcPsbt';

function formatSats(value: number): string {
  return `${value.toLocaleString()} sats`;
}

export default function PsbtDetail({ psbtHex }: { psbtHex: string }) {
  let summary;
  try {
    summary = inspectBtcPsbt(psbtHex);
  } catch (e: any) {
    return (
      <View style={styles.errorContainer}>
        <Icon source="alert-circle" size={48} color={theme.colors.negative} />
        <Text variant="titleMedium" style={styles.errorTitleRed}>
          Invalid PSBT
        </Text>
        <Text variant="bodyMedium" style={styles.errorMessage} selectable>
          {e.message}
        </Text>
      </View>
    );
  }

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

          {summary.feeSats !== undefined && (
            <View style={styles.row}>
              <InfoRow label="Fee" value={formatSats(summary.feeSats)} />
            </View>
          )}

          {summary.outputs.map((output, index) => (
            <View key={`${output.address}-${index}`} style={styles.row}>
              <InfoRow
                label={`Output ${index + 1}${
                  output.isChange ? ' (Change)' : ''
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
  errorContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
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
