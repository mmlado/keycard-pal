import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import { EIP712_DIGEST_EXPLAINER } from '@/constants/erc8213';
import type { EthSignRequest } from '@/types';

import InfoRow from '@/components/InfoRow';

import { type Eip712Prehashed } from '@/utils/eip712';
import { computeEip712DigestFromPrehashed } from '@/utils/erc8213';
import { classifyEthPayload } from '@/utils/ethPayload';

import { DigestExplainer, DigestRow, SectionHeader } from './shared';

type Tab = 'details' | 'digests' | 'raw';

export default function Eip712PrehashedPanel({
  eip712Prehashed,
  request,
}: {
  eip712Prehashed: Eip712Prehashed;
  request: EthSignRequest;
}) {
  const [tab, setTab] = useState<Tab>('details');

  const eip712Digest = useMemo(() => {
    // Prefer the classification's digest — the same value signingDigest sends
    // to the card. Fall back to the prop-derived compute for WC requests whose
    // pre-hash came from reviewData rather than signData.
    const payload = classifyEthPayload(request.signData, request.dataType);
    return payload.kind === 'eip712-prehashed'
      ? payload.digest
      : computeEip712DigestFromPrehashed(
          eip712Prehashed.domainSeparatorHash,
          eip712Prehashed.messageHash,
        );
  }, [request.signData, request.dataType, eip712Prehashed]);

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
            <SectionHeader title="EIP-712 (pre-hashed)" />
            <View style={styles.row}>
              <InfoRow
                label="Domain separator"
                value={eip712Prehashed.domainSeparatorHash}
              />
            </View>
            <View style={styles.row}>
              <InfoRow
                label="Message hash"
                value={eip712Prehashed.messageHash}
              />
            </View>
          </>
        )}
        {tab === 'digests' && (
          <>
            <DigestRow label="EIP-712 Digest" value={eip712Digest} />
            <DigestRow
              label="Domain Hash"
              value={eip712Prehashed.domainSeparatorHash}
            />
            <DigestRow
              label="Message Hash"
              value={eip712Prehashed.messageHash}
            />
            <DigestExplainer text={EIP712_DIGEST_EXPLAINER} />
          </>
        )}
        {tab === 'raw' && (
          <View style={styles.row}>
            <InfoRow label="Data" value={request.signData} />
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
