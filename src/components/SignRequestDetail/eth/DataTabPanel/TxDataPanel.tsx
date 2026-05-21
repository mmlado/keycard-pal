import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import type { EthSignRequest } from '@/types';

import NFCBottomSheet from '@/components/NFCBottomSheet';
import InfoRow from '@/components/InfoRow';
import { computeCalldataDigest } from '@/utils/erc8213';
import type { ParsedTx } from '@/utils/txParser';

import { DigestRow } from './shared';
import DecodedCallSection from './DecodedCallSection';
import SimulationPanel from './SimulationPanel';
import { useSimulation } from './useSimulation';

type Tab = 'decoded' | 'digests' | 'raw' | 'simulation';

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

  const {
    showSimulationTab,
    simulationState,
    addressOp,
    handleSimulate,
    handleCancelNfc,
  } = useSimulation(request, tx, chainId);

  const calldataDigest = useMemo(
    () => computeCalldataDigest(calldata),
    [calldata],
  );

  useEffect(() => {
    if (!hasDecodedCall && tab === 'decoded') {
      setTab('digests');
    }
    if (!showSimulationTab && tab === 'simulation') {
      setTab(hasDecodedCall ? 'decoded' : 'digests');
    }
  }, [hasDecodedCall, showSimulationTab, tab]);

  const buttons = [
    ...(hasDecodedCall ? [{ value: 'decoded', label: 'Decoded' }] : []),
    { value: 'digests', label: 'Digests' },
    { value: 'raw', label: 'Raw' },
    ...(showSimulationTab
      ? [{ value: 'simulation', label: 'Simulation' }]
      : []),
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
        {tab === 'simulation' && showSimulationTab && (
          <SimulationPanel
            state={simulationState}
            onSimulate={handleSimulate}
          />
        )}
      </View>
      <NFCBottomSheet nfc={addressOp} onCancel={handleCancelNfc} />
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
