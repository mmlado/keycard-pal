import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '../theme';
import type { EthSignRequest } from '../types';

import AddressInfoRow from './ens/AddressInfoRow.online';
import DecodedCallSection from './DecodedCallSection';
import InfoRow from './InfoRow';

import { getChainName, getNativeCurrencySymbol } from '../utils/chainMetadata';
import {
  type Eip712SpecialReview,
  parseEip712Prehashed,
  parseEip712Summary,
} from '../utils/eip712';
import { checksumEthAddress } from '../utils/ethereumAddress';
import { formatTokenAmount, lookupToken } from '../utils/tokenMetadata';
import { getTxLabel, parseTx } from '../utils/txParser';

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="labelMedium" style={styles.sectionHeaderText}>
        {title}
      </Text>
    </View>
  );
}

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

function PermitReviewSection({
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

function SafeTxReviewSection({
  special,
  chainId,
}: {
  special: Extract<Eip712SpecialReview, { kind: 'safe-tx' }>;
  chainId: number | undefined;
}) {
  return (
    <>
      <SectionHeader title="Safe Transaction" />
      {special.safeAddress && (
        <View style={styles.row}>
          <AddressInfoRow label="Safe" value={special.safeAddress} />
        </View>
      )}
      <View style={styles.row}>
        <AddressInfoRow label="To" value={special.to} />
      </View>
      <View style={styles.row}>
        <InfoRow label="Value" value={special.value} />
      </View>
      <View style={styles.row}>
        <InfoRow label="Operation" value={special.operation} />
      </View>
      <View style={styles.row}>
        <InfoRow label="Nonce" value={special.nonce} />
      </View>
      <View style={styles.row}>
        <InfoRow label="Safe tx gas" value={special.safeTxGas} />
        <InfoRow label="Base gas" value={special.baseGas} />
        <InfoRow label="Gas price" value={special.gasPrice} />
      </View>
      <View style={styles.row}>
        <AddressInfoRow label="Gas token" value={special.gasToken} />
        <AddressInfoRow
          label="Refund receiver"
          value={special.refundReceiver}
        />
      </View>
      {special.decodedCall ? (
        <DecodedCallSection
          call={special.decodedCall}
          tokenContract={special.to}
          chainId={chainId}
        />
      ) : (
        special.data && (
          <View style={styles.row}>
            <InfoRow label="Data" value={special.data} />
          </View>
        )
      )}
    </>
  );
}

function SpecialEip712Section({
  special,
  fallbackChainId,
}: {
  special: Eip712SpecialReview;
  fallbackChainId: number | undefined;
}) {
  const chainId = fallbackChainId ?? special.chainId;
  if (special.kind === 'permit' || special.kind === 'permit-single') {
    return <PermitReviewSection special={special} chainId={chainId} />;
  }
  return <SafeTxReviewSection special={special} chainId={chainId} />;
}

export default function EthSignRequestDetail({
  request,
}: {
  request: EthSignRequest;
}) {
  const nativeSymbol =
    request.chainId !== undefined
      ? getNativeCurrencySymbol(request.chainId)
      : 'ETH';
  const typeLabel = getTxLabel(request.signData, request.dataType);
  const tx = parseTx(request.signData, request.dataType, nativeSymbol);
  const eip712 =
    request.dataType === 2 ? parseEip712Summary(request.signData) : null;
  const eip712Prehashed =
    request.dataType === 2 && !eip712
      ? parseEip712Prehashed(request.signData)
      : null;
  const specialEip712 = eip712?.special;
  const signer = request.address
    ? checksumEthAddress(request.address)
    : request.derivationPath;

  return (
    <>
      <View style={styles.typeChip}>
        <Icon source="ethereum" size={18} color={theme.colors.primary} />
        <Text variant="labelLarge" style={styles.typeChipText}>
          {typeLabel}
        </Text>
      </View>

      <View style={styles.row}>
        <AddressInfoRow label="Signer" value={signer} />
      </View>

      {request.address && (
        <View style={styles.row}>
          <InfoRow label="Path" value={request.derivationPath} />
        </View>
      )}

      {request.requestId && (
        <View style={styles.row}>
          <InfoRow label="Request ID" value={request.requestId} />
        </View>
      )}

      {tx?.to &&
        (!tx.decodedCall || tx.decodedCall.kind === 'contract-call') && (
          <View style={styles.row}>
            <AddressInfoRow label="To" value={tx.to} />
          </View>
        )}

      {request.chainId !== undefined && (
        <View style={styles.row}>
          <InfoRow label="Chain" value={getChainName(request.chainId)} />
        </View>
      )}

      {tx?.value !== undefined && (tx.value !== '0' || !tx.decodedCall) && (
        <View style={styles.row}>
          <InfoRow label="Amount" value={tx.value} />
        </View>
      )}

      {tx?.decodedCall && (
        <DecodedCallSection
          call={tx.decodedCall}
          tokenContract={tx.to}
          chainId={request.chainId}
        />
      )}

      {tx?.fees.kind === 'legacy' && (
        <View style={styles.row}>
          <InfoRow label="Gas price" value={tx.fees.gasPrice} />
          <InfoRow label="Gas limit" value={tx.fees.gasLimit} />
        </View>
      )}

      {tx?.fees.kind === 'eip1559' && (
        <View style={styles.row}>
          <InfoRow label="Max fee" value={tx.fees.maxFeePerGas} />
          <InfoRow label="Priority fee" value={tx.fees.maxPriorityFeePerGas} />
          <InfoRow label="Gas limit" value={tx.fees.gasLimit} />
        </View>
      )}

      {eip712?.primaryType && (
        <View style={styles.row}>
          <InfoRow label="Primary type" value={eip712.primaryType} />
        </View>
      )}

      {Object.keys(eip712?.domain ?? {}).length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text variant="labelMedium" style={styles.sectionHeaderText}>
              EIP-712 Domain
            </Text>
          </View>
          {Object.entries(eip712!.domain).map(([key, value]) => (
            <View key={`domain-${key}`} style={styles.row}>
              <AddressInfoRow label={key} value={value} />
            </View>
          ))}
        </>
      )}

      {specialEip712 && (
        <SpecialEip712Section
          special={specialEip712}
          fallbackChainId={request.chainId}
        />
      )}

      {!specialEip712 && Object.keys(eip712?.message ?? {}).length > 0 && (
        <>
          <SectionHeader title="Message Fields" />
          {Object.entries(eip712!.message).map(([key, value]) => (
            <View key={`message-${key}`} style={styles.row}>
              <AddressInfoRow label={key} value={value} />
            </View>
          ))}
        </>
      )}

      {eip712Prehashed && (
        <>
          <View style={styles.sectionHeader}>
            <Text variant="labelMedium" style={styles.sectionHeaderText}>
              EIP-712 (pre-hashed)
            </Text>
          </View>
          <View style={styles.row}>
            <InfoRow
              label="Domain separator"
              value={eip712Prehashed.domainSeparatorHash}
            />
          </View>
          <View style={styles.row}>
            <InfoRow label="Message hash" value={eip712Prehashed.messageHash} />
          </View>
        </>
      )}

      {!eip712Prehashed &&
        !specialEip712 &&
        (!tx?.decodedCall || tx.decodedCall.kind === 'unknown-call') && (
          <View style={styles.row}>
            <InfoRow
              label="Data"
              value={eip712?.rawJson ?? tx?.data ?? request.signData}
            />
          </View>
        )}

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
