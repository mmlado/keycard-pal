import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import type { EthSignRequest } from '@/types';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

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

  const eip712Digest = useMemo(() => {
    const raw = parseEip712RawTypedData(request.signData);
    if (raw) {
      return computeEip712DigestFromJson(
        raw.domain,
        raw.message,
        raw.primaryType,
        raw.types,
      );
    }
    // dataType=0 (WC pre-hashed): signData is already the 32-byte digest
    if (/^0x[0-9a-fA-F]{64}$/.test(request.signData)) {
      return request.signData;
    }
    return null;
  }, [request.signData]);

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
});
