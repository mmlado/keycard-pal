import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import { EIP712_DIGEST_EXPLAINER } from '@/constants/erc8213';
import type { EthSignRequest } from '@/types';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import { type Eip712Summary } from '@/utils/eip712';
import { classifyEthPayload } from '@/utils/ethPayload';

import { DigestExplainer, DigestRow, SectionHeader } from './shared';
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
    // Same classification that produces the bytes sent to the card
    // (signingDigest) — the digest shown here is the digest signed.
    const payload = classifyEthPayload(request.signData, request.dataType);
    return payload.kind === 'eip712-json' || payload.kind === 'raw-digest'
      ? payload.digest
      : null;
  }, [request.signData, request.dataType]);

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
          <>
            <DigestRow label="EIP-712 Digest" value={eip712Digest} />
            <DigestExplainer text={EIP712_DIGEST_EXPLAINER} />
          </>
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
