import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import type { EthSignRequest } from '@/types';

import InfoRow from '@/components/InfoRow';

import { computeEip712DigestFromPrehashed } from '@/utils/erc8213';
import { type Eip712Prehashed } from '@/utils/eip712';

import { DigestRow, SectionHeader } from './shared';

type Tab = 'details' | 'digests' | 'raw';

export default function Eip712PrehashedPanel({
  eip712Prehashed,
  request,
}: {
  eip712Prehashed: Eip712Prehashed;
  request: EthSignRequest;
}) {
  const [tab, setTab] = useState<Tab>('details');

  const eip712Digest = useMemo(
    () =>
      computeEip712DigestFromPrehashed(
        eip712Prehashed.domainSeparatorHash,
        eip712Prehashed.messageHash,
      ),
    [eip712Prehashed],
  );

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
