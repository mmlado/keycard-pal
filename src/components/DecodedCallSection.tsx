import { Image, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '../theme';

import AddressInfoRow from './ens/AddressInfoRow.online';
import InfoRow from './InfoRow';

import { INTERNET_ENABLED } from '../utils/buildConfig';
import type { DecodedCall } from '../utils/txParser';
import { formatTokenAmount, lookupToken } from '../utils/tokenMetadata';
import type { TokenMetadata } from '../utils/tokenMetadata';

const UINT256_MAX = 2n ** 256n - 1n;

function TokenLogo({ uri }: { uri: string }) {
  if (!INTERNET_ENABLED && !uri.startsWith('asset:/')) return null;
  return (
    <Image source={{ uri }} style={styles.tokenLogo} testID="token-logo" />
  );
}

function formatAmount(amount: bigint, token: TokenMetadata | null): string {
  if (!token) return amount.toString();
  return formatTokenAmount(amount, token);
}

function formatUnlimited(token: TokenMetadata | null): string {
  return token ? `Unlimited ${token.symbol}` : 'Unlimited';
}

export default function DecodedCallSection({
  call,
  tokenContract,
  chainId,
}: {
  call: DecodedCall;
  tokenContract?: string;
  chainId?: number;
}) {
  const token = lookupToken(chainId, tokenContract);

  if (call.kind === 'erc20-transfer') {
    return (
      <>
        <View style={styles.sectionHeader}>
          <Text variant="labelMedium" style={styles.sectionHeaderText}>
            ERC-20 Transfer
          </Text>
        </View>
        {token && (
          <View style={[styles.row, styles.tokenRow]}>
            {token.logoURI && <TokenLogo uri={token.logoURI} />}
            <Text variant="labelMedium" style={styles.tokenSymbol}>
              {token.symbol}
            </Text>
          </View>
        )}
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

  if (call.kind === 'erc20-transferFrom') {
    return (
      <>
        <View style={styles.sectionHeader}>
          <Text variant="labelMedium" style={styles.sectionHeaderText}>
            ERC-20 Transfer From
          </Text>
        </View>
        {token && (
          <View style={[styles.row, styles.tokenRow]}>
            {token.logoURI && <TokenLogo uri={token.logoURI} />}
            <Text variant="labelMedium" style={styles.tokenSymbol}>
              {token.symbol}
            </Text>
          </View>
        )}
        {tokenContract && (
          <View style={styles.row}>
            <AddressInfoRow label="Token contract" value={tokenContract} />
          </View>
        )}
        <View style={styles.row}>
          <AddressInfoRow label="From" value={call.from} />
        </View>
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

  if (call.kind === 'erc20-approve') {
    const isUnlimited = call.amount === UINT256_MAX;
    return (
      <>
        <View style={styles.sectionHeader}>
          <Text variant="labelMedium" style={styles.sectionHeaderText}>
            ERC-20 Approve
          </Text>
        </View>
        {token && (
          <View style={[styles.row, styles.tokenRow]}>
            {token.logoURI && <TokenLogo uri={token.logoURI} />}
            <Text variant="labelMedium" style={styles.tokenSymbol}>
              {token.symbol}
            </Text>
          </View>
        )}
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

  if (call.kind === 'contract-call') {
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
            <AddressInfoRow
              label={`${arg.name} (${arg.type})`}
              value={arg.value}
            />
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

  if (call.kind === 'universal-router-execute') {
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
            {command.args.map(arg => (
              <AddressInfoRow
                key={`${command.index}-${arg.name}`}
                label={`${arg.name} (${arg.type})`}
                value={arg.value}
              />
            ))}
            {command.error && <InfoRow label="Decode" value={command.error} />}
            {command.rawInput && (
              <InfoRow label="Input" value={command.rawInput} />
            )}
          </View>
        ))}
      </>
    );
  }

  return (
    <View style={styles.row}>
      <InfoRow label="Contract call" value={call.selector} />
    </View>
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
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    color: theme.colors.onSurfaceVariant,
  },
  tokenLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
