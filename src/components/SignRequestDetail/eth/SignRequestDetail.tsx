import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import theme from '@/theme';
import type { EthSignRequest } from '@/types';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import Eip712JsonPanel from './DataTabPanel/Eip712JsonPanel';
import Eip712PrehashedPanel from './DataTabPanel/Eip712PrehashedPanel';
import InfoRow from '@/components/InfoRow';
import PersonalMessagePanel from './DataTabPanel/PersonalMessagePanel';
import TxDataPanel from './DataTabPanel/TxDataPanel';

import { getChainName, getNativeCurrencySymbol } from '@/utils/chainMetadata';
import { parseEip712Prehashed, parseEip712Summary } from '@/utils/eip712';
import { classifyEthPayload } from '@/utils/ethPayload';
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
  // Parse the request once per request, not once per render.
  const { payload, eip712, eip712Prehashed, tx } = useMemo(() => {
    // WC EIP-712 requests carry original JSON in reviewData (dataType=0 + digest in signData)
    const eip712Source =
      request.reviewData ?? (request.dataType === 2 ? request.signData : null);
    const summary = eip712Source ? parseEip712Summary(eip712Source) : null;
    return {
      payload: classifyEthPayload(request.signData, request.dataType),
      eip712: summary,
      eip712Prehashed:
        eip712Source && !summary ? parseEip712Prehashed(eip712Source) : null,
      tx: parseTx(request.signData, request.dataType, nativeSymbol),
    };
  }, [request.reviewData, request.signData, request.dataType, nativeSymbol]);
  const typeLabel =
    eip712?.primaryType ?? getTxLabel(request.signData, request.dataType);
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

      {payload.kind === 'invalid' && (
        <View style={styles.invalidBanner}>
          <Text variant="bodyMedium" style={styles.invalidText}>
            This request cannot be signed. {payload.reason}
          </Text>
        </View>
      )}

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

      {eip712 ? (
        <Eip712JsonPanel
          request={request}
          eip712={eip712}
          chainId={request.chainId}
        />
      ) : eip712Prehashed ? (
        <Eip712PrehashedPanel
          eip712Prehashed={eip712Prehashed}
          request={request}
        />
      ) : tx ? (
        <TxDataPanel tx={tx} request={request} chainId={request.chainId} />
      ) : payload.kind === 'personal-message' ? (
        <PersonalMessagePanel message={payload} request={request} />
      ) : (
        // Pure ETH transfer, unknown/invalid types
        <View style={styles.row}>
          <InfoRow label="Data" value={request.signData} />
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
  invalidBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceVariant,
  },
  invalidText: {
    color: theme.colors.error,
  },
  row: {
    paddingVertical: 8,
  },
});
