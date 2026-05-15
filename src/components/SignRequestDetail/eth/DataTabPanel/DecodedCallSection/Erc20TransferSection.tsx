import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import type { DecodedCall } from '@/utils/txParser';
import { formatTokenAmount, lookupToken } from '@/utils/tokenMetadata';

import TokenSymbolRow from './TokenSymbolRow';

function formatAmount(
  amount: bigint,
  token: ReturnType<typeof lookupToken>,
): string {
  if (!token) return amount.toString();
  return formatTokenAmount(amount, token);
}

export default function Erc20TransferSection({
  call,
  tokenContract,
  chainId,
}: {
  call: Extract<DecodedCall, { kind: 'erc20-transfer' }>;
  tokenContract?: string;
  chainId?: number;
}) {
  const token = lookupToken(chainId, tokenContract);
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text variant="labelMedium" style={styles.sectionHeaderText}>
          ERC-20 Transfer
        </Text>
      </View>
      {token && <TokenSymbolRow token={token} />}
      {tokenContract && (
        <View style={styles.row}>
          <AddressInfoRow label="Token contract" value={tokenContract} />
        </View>
      )}
      <View style={styles.row}>
        <AddressInfoRow label="Recipient" value={call.to} />
      </View>
      <View style={styles.row}>
        <InfoRow
          label={token ? 'Amount' : 'Amount (raw units)'}
          value={formatAmount(call.amount, token)}
        />
      </View>
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
});
