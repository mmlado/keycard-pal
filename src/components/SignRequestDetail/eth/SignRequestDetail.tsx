import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '@/theme';
import type { EthSignRequest } from '@/types';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import EthDataTabPanel from './DataTabPanel';
import InfoRow from '@/components/InfoRow';

import { getChainName, getNativeCurrencySymbol } from '@/utils/chainMetadata';
import { parseEip712Prehashed, parseEip712Summary } from '@/utils/eip712';
import { checksumEthAddress } from '@/utils/ethereumAddress';
import { getTxLabel, parseTx } from '@/utils/txParser';

export default function SignRequestDetail({
  request,
}: {
  request: EthSignRequest;
}) {
  const nativeSymbol =
    request.chainId !== undefined
      ? getNativeCurrencySymbol(request.chainId)
      : 'ETH';
  // WC EIP-712 requests carry original JSON in reviewData (dataType=0 + digest in signData)
  const eip712Source =
    request.reviewData ?? (request.dataType === 2 ? request.signData : null);
  const eip712 = eip712Source ? parseEip712Summary(eip712Source) : null;
  const eip712Prehashed =
    eip712Source && !eip712 ? parseEip712Prehashed(eip712Source) : null;
  const typeLabel =
    eip712?.primaryType ?? getTxLabel(request.signData, request.dataType);
  const tx = parseTx(request.signData, request.dataType, nativeSymbol);
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

      <EthDataTabPanel
        request={request}
        tx={tx}
        eip712={eip712}
        eip712Prehashed={eip712Prehashed}
        chainId={request.chainId}
      />

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
});
