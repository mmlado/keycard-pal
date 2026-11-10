import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { MISCASED_ADDRESS_WARNING } from '@/constants/eip712';
import theme from '@/theme';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';
import WithAddToken from '@/components/WithAddToken';

import { customTokenRemarks } from '@/utils/customTokenChecks';
import { type Eip712SpecialReview } from '@/utils/eip712';
import {
  formatTokenAmount,
  lookupToken,
  type TokenMetadata,
} from '@/utils/tokenMetadata';

import { SectionHeader, WarningRow } from '../shared';

function formatPermitAmount(
  special:
    | Extract<Eip712SpecialReview, { kind: 'permit' }>
    | Extract<Eip712SpecialReview, { kind: 'permit-single' }>,
  token: TokenMetadata | null,
): string {
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
  const { tokenContract } = special;
  const token = lookupToken(chainId, tokenContract);
  const remarks = tokenContract
    ? customTokenRemarks(token, chainId, tokenContract)
    : { warnings: [] };
  return (
    <>
      <SectionHeader title="EIP-712 Permit" />
      {tokenContract && (
        <View style={styles.row}>
          <WithAddToken
            place={token ? undefined : { chainId, address: tokenContract }}
          >
            <AddressInfoRow label="Token contract" value={tokenContract} />
          </WithAddToken>
          {special.miscased.includes('tokenContract') && (
            <WarningRow text={MISCASED_ADDRESS_WARNING} />
          )}
        </View>
      )}
      <View style={styles.row}>
        <AddressInfoRow label="Spender" value={special.spender} />
        {special.miscased.includes('spender') && (
          <WarningRow text={MISCASED_ADDRESS_WARNING} />
        )}
      </View>
      <View style={styles.row}>
        <InfoRow label="Allowance" value={formatPermitAmount(special, token)} />
        {remarks.caption && (
          <Text variant="labelSmall" style={styles.caption}>
            {remarks.caption}
          </Text>
        )}
        {remarks.warnings.map(warning => (
          <WarningRow key={warning} text={warning} />
        ))}
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
  caption: {
    color: theme.colors.onSurfaceVariant,
    paddingTop: 4,
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
