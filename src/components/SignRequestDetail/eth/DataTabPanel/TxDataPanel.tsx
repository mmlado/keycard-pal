import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import type { EthSignRequest } from '@/types';

import DecodedCallSection from './DecodedCallSection';
import InfoRow from '@/components/InfoRow';

import { computeCalldataDigest } from '@/utils/erc8213';
import type { ParsedTx } from '@/utils/txParser';

import { DigestRow } from './shared';

type Tab = 'decoded' | 'digests' | 'raw';

export default function TxDataPanel({
  tx,
  request,
  chainId,
}: {
  tx: ParsedTx;
  request: EthSignRequest;
  chainId: number | undefined;
}) {
  const calldata = tx.data ?? '';
  const hasDecodedCall =
    tx.decodedCall && tx.decodedCall.kind !== 'unknown-call';

  const initialTab: Tab = hasDecodedCall ? 'decoded' : 'digests';
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (!hasDecodedCall && tab === 'decoded') {
      setTab('digests');
    }
  }, [hasDecodedCall, tab]);

  const calldataDigest = useMemo(
    () => computeCalldataDigest(calldata),
    [calldata],
  );

  const buttons = hasDecodedCall
    ? [
        { value: 'decoded', label: 'Decoded' },
        { value: 'digests', label: 'Digests' },
        { value: 'raw', label: 'Raw' },
      ]
    : [
        { value: 'digests', label: 'Digests' },
        { value: 'raw', label: 'Raw' },
      ];

  return (
    <View style={styles.panel}>
      <SegmentedButtons
        value={tab}
        onValueChange={v => setTab(v as Tab)}
        buttons={buttons}
      />
      <View style={styles.tabContent}>
        {tab === 'decoded' && tx.decodedCall && (
          <DecodedCallSection
            call={tx.decodedCall}
            tokenContract={tx.to}
            chainId={chainId}
          />
        )}
        {tab === 'digests' && calldataDigest && (
          <DigestRow label="Calldata Digest" value={calldataDigest} />
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
