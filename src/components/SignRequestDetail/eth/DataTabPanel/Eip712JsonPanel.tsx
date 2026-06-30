import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';

import type { EthSignRequest } from '@/types';
import theme from '@/theme';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import { formatEip7730Field } from '@/utils/eip7730/format';
import { lookupEip712 } from '@/utils/eip7730/lookup';
import { resolveEip712FieldValue } from '@/utils/eip7730/paths';
import { computeEip712DigestFromJson } from '@/utils/erc8213';
import { parseEip712RawTypedData, type Eip712Summary } from '@/utils/eip712';

import { DigestRow, SectionHeader } from './shared';
import SpecialEip712Section from './SpecialEip712Section';

type Tab = 'details' | 'digests' | 'raw';

export default function Eip712JsonPanel({
  request,
  eip712,
  chainId,
}: {
  request: EthSignRequest;
  eip712: Eip712Summary;
  chainId: number | undefined;
}) {
  const [tab, setTab] = useState<Tab>('details');
  const specialEip712 = eip712.special;

  const rawTypedData = useMemo(
    () => parseEip712RawTypedData(request.signData),
    [request.signData],
  );

  const eip7730Descriptor = useMemo(() => {
    if (chainId === undefined) return null;
    const verifyingContract = eip712.domain?.verifyingContract;
    const primaryType = eip712.primaryType;
    if (!verifyingContract || !primaryType) return null;
    return lookupEip712(chainId, verifyingContract, primaryType);
  }, [chainId, eip712.domain?.verifyingContract, eip712.primaryType]);

  const eip712Digest = useMemo(() => {
    if (rawTypedData) {
      return computeEip712DigestFromJson(
        rawTypedData.domain,
        rawTypedData.message,
        rawTypedData.primaryType,
        rawTypedData.types,
      );
    }
    // dataType=0 (WC pre-hashed): signData is already the 32-byte digest
    if (/^0x[0-9a-fA-F]{64}$/.test(request.signData)) {
      return request.signData;
    }
    return null;
  }, [rawTypedData, request.signData]);

  return (
    <View style={styles.panel}>
      <SegmentedButtons
        value={tab}
        onValueChange={v => setTab(v as Tab)}
        buttons={[
          { value: 'details', label: 'Details' },
          { value: 'digests', label: 'Digests' },
          { value: 'raw', label: 'Raw' },
        ]}
      />
      <View style={styles.tabContent}>
        {tab === 'details' && (
          <>
            {eip712.primaryType && (
              <View style={styles.row}>
                <InfoRow label="Primary type" value={eip712.primaryType} />
              </View>
            )}
            {Object.keys(eip712.domain).length > 0 && (
              <>
                <SectionHeader title="EIP-712 Domain" />
                {Object.entries(eip712.domain).map(([key, value]) => (
                  <View key={`domain-${key}`} style={styles.row}>
                    <AddressInfoRow label={key} value={value} />
                  </View>
                ))}
              </>
            )}
            {eip7730Descriptor ? (
              <>
                {eip7730Descriptor.intent && (
                  <View style={styles.row}>
                    <Text variant="titleSmall" style={styles.intent}>
                      {eip7730Descriptor.intent}
                    </Text>
                  </View>
                )}
                {eip7730Descriptor.fields.length > 0 && (
                  <SectionHeader title="Message" />
                )}
                {eip7730Descriptor.fields.map((field, index) => {
                  const raw = rawTypedData
                    ? resolveEip712FieldValue(field.path, rawTypedData.message)
                    : null;
                  const display = formatEip7730Field(
                    field,
                    raw,
                    eip7730Descriptor,
                    {
                      chainId,
                      contractAddress: eip712.domain?.verifyingContract,
                      resolvePath: path =>
                        rawTypedData
                          ? resolveEip712FieldValue(path, rawTypedData.message)
                          : null,
                    },
                  );
                  if (
                    field.format === 'addressName' &&
                    raw &&
                    raw.startsWith('0x')
                  ) {
                    return (
                      <View
                        key={`eip7730-${field.path}-${index}`}
                        style={styles.row}
                      >
                        <AddressInfoRow label={field.label} value={raw} />
                      </View>
                    );
                  }
                  return (
                    <View
                      key={`eip7730-${field.path}-${index}`}
                      style={styles.row}
                    >
                      <InfoRow label={field.label} value={display} />
                    </View>
                  );
                })}
              </>
            ) : (
              <>
                {specialEip712 && (
                  <SpecialEip712Section
                    special={specialEip712}
                    fallbackChainId={chainId}
                  />
                )}
                {!specialEip712 && Object.keys(eip712.message).length > 0 && (
                  <>
                    <SectionHeader title="Message Fields" />
                    {Object.entries(eip712.message).map(([key, value]) => (
                      <View key={`message-${key}`} style={styles.row}>
                        <AddressInfoRow label={key} value={value} />
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
        {tab === 'digests' && eip712Digest && (
          <DigestRow label="EIP-712 Digest" value={eip712Digest} />
        )}
        {tab === 'raw' && (
          <View style={styles.row}>
            <InfoRow label="Data" value={eip712.rawJson} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 8,
  },
  tabContent: {
    paddingTop: 8,
  },
  row: {
    paddingVertical: 8,
  },
  intent: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
