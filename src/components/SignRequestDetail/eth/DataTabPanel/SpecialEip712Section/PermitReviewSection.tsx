import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '@/theme';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import { type Eip712SpecialReview } from '@/utils/eip712';
import { formatTokenAmount, lookupToken } from '@/utils/tokenMetadata';

import { SectionHeader } from '../shared';

function formatPermitAmount(
  special:
    | Extract<Eip712SpecialReview, { kind: 'permit' }>
    | Extract<Eip712SpecialReview, { kind: 'permit-single' }>,
  chainId: number | undefined,
): string {
  const token = lookupToken(chainId, special.tokenContract);
  if (special.unlimited) {
    return token ? `Unlimited ${token.symbol}` : 'Unlimited';
  }
  return token
    ? formatTokenAmount(special.amount, token)
    : special.amount.toString();
}

export default function PermitReviewSection({
  special,
  chainId,
}: {
  special:
    | Extract<Eip712SpecialReview, { kind: 'permit' }>
    | Extract<Eip712SpecialReview, { kind: 'permit-single' }>;
  chainId: number | undefined;
}) {
  return (
    <>
      <SectionHeader title="EIP-712 Permit" />
      {special.tokenContract && (
        <View style={styles.row}>
          <AddressInfoRow
            label="Token contract"
            value={special.tokenContract}
          />
        </View>
      )}
      <View style={styles.row}>
        <AddressInfoRow label="Spender" value={special.spender} />
      </View>
      <View style={styles.row}>
        <InfoRow
          label="Allowance"
          value={formatPermitAmount(special, chainId)}
        />
      </View>
      {special.deadline && (
        <View style={styles.row}>
          <InfoRow label="Deadline" value={special.deadline} />
        </View>
      )}
      {special.kind === 'permit-single' && special.expiration && (
        <View style={styles.row}>
          <InfoRow label="Expiration" value={special.expiration} />
        </View>
      )}
      {special.unlimited && (
        <View style={styles.warningRow}>
          <Icon source="alert" size={16} color={theme.colors.negative} />
          <Text variant="labelSmall" style={styles.warningText}>
            Unlimited permit - spender can transfer all tokens of this type
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
