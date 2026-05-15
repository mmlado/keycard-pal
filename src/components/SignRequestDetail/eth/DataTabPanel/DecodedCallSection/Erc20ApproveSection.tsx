import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '@/theme';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import type { DecodedCall } from '@/utils/txParser';
import { formatTokenAmount, lookupToken } from '@/utils/tokenMetadata';

import TokenSymbolRow from './TokenSymbolRow';

const UINT256_MAX = 2n ** 256n - 1n;

function formatAmount(
  amount: bigint,
  token: ReturnType<typeof lookupToken>,
): string {
  if (!token) return amount.toString();
  return formatTokenAmount(amount, token);
}

function formatUnlimited(token: ReturnType<typeof lookupToken>): string {
  return token ? `Unlimited ${token.symbol}` : 'Unlimited';
}

export default function Erc20ApproveSection({
  call,
  tokenContract,
  chainId,
}: {
  call: Extract<DecodedCall, { kind: 'erc20-approve' }>;
  tokenContract?: string;
  chainId?: number;
}) {
  const token = lookupToken(chainId, tokenContract);
  const isUnlimited = call.amount === UINT256_MAX;
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text variant="labelMedium" style={styles.sectionHeaderText}>
          ERC-20 Approve
        </Text>
      </View>
      {token && <TokenSymbolRow token={token} />}
      {tokenContract && (
        <View style={styles.row}>
          <AddressInfoRow label="Token contract" value={tokenContract} />
        </View>
      )}
      <View style={styles.row}>
        <AddressInfoRow label="Spender" value={call.spender} />
      </View>
      <View style={styles.row}>
        <InfoRow
          label="Allowance"
          value={
            isUnlimited
              ? formatUnlimited(token)
              : formatAmount(call.amount, token)
          }
        />
      </View>
      {isUnlimited && (
        <View style={styles.warningRow}>
          <Icon source="alert" size={16} color={theme.colors.negative} />
          <Text variant="labelSmall" style={styles.warningText}>
            Unlimited approval — spender can transfer all tokens of this type
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
