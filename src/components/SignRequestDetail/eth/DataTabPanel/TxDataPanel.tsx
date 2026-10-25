import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import { DESCRIPTOR_CHECK_FAILED_WARNING } from '@/constants/eip7730';
import { CALLDATA_DIGEST_EXPLAINER } from '@/constants/erc8213';
import type { EthSignRequest } from '@/types';

import InfoRow from '@/components/InfoRow';

import type { CallDescription } from '@/utils/callDescription';
import { computeCalldataDigest } from '@/utils/erc8213';
import type { ParsedTx } from '@/utils/txParser';

import CallSection from './CallSection';
import { DigestExplainer, DigestRow, WarningRow } from './shared';
import SimulationPanel from './SimulationPanel';
import { useSimulation } from './useSimulation';

type Tab = 'decoded' | 'digests' | 'raw' | 'simulation';

export default function TxDataPanel({
  tx,
  request,
  chainId,
  description,
}: {
  tx: ParsedTx;
  request: EthSignRequest;
  chainId: number | undefined;
  description: CallDescription | null;
}) {
  const calldata = tx.data ?? '';
  const hasDecodedCall = description !== null && description.view !== 'raw';
  const [chosenTab, setTab] = useState<Tab | null>(null);

  const { showSimulationTab, simulationState, handleSimulate } = useSimulation(
    request,
    tx,
    chainId,
  );

  const calldataDigest = useMemo(
    () => computeCalldataDigest(calldata),
    [calldata],
  );

  const defaultTab: Tab = hasDecodedCall ? 'decoded' : 'digests';
  const tab: Tab =
    chosenTab === null ||
    (chosenTab === 'decoded' && !hasDecodedCall) ||
    (chosenTab === 'simulation' && !showSimulationTab)
      ? defaultTab
      : chosenTab;

  // Mounted while a saved slice is read, so the chosen tab and a simulation survive a source change.
  if (!description) return null;

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
      {description.rejected && (
        <WarningRow text={DESCRIPTOR_CHECK_FAILED_WARNING} />
      )}
      <SegmentedButtons
        value={tab}
        onValueChange={v => setTab(v as Tab)}
        buttons={buttons}
      />
      <View style={styles.tabContent}>
        {tab === 'decoded' && (
          <CallSection
            description={description}
            contract={tx.to}
            chainId={chainId}
          />
        )}
        {tab === 'digests' && calldataDigest && (
          <>
            <DigestRow label="Calldata Digest" value={calldataDigest} />
            <DigestExplainer text={CALLDATA_DIGEST_EXPLAINER} />
          </>
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
