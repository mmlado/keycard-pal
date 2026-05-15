import { StyleSheet, View } from 'react-native';

import type { EthSignRequest } from '@/types';

import InfoRow from '@/components/InfoRow';

import { type Eip712Prehashed, type Eip712Summary } from '@/utils/eip712';
import type { ParsedTx } from '@/utils/txParser';

import Eip712JsonPanel from './Eip712JsonPanel';
import Eip712PrehashedPanel from './Eip712PrehashedPanel';
import TxDataPanel from './TxDataPanel';

export default function EthDataTabPanel({
  request,
  tx,
  eip712,
  eip712Prehashed,
  chainId,
}: {
  request: EthSignRequest;
  tx: ParsedTx | null;
  eip712: Eip712Summary | null;
  eip712Prehashed: Eip712Prehashed | null;
  chainId: number | undefined;
}) {
  if (eip712) {
    return (
      <Eip712JsonPanel request={request} eip712={eip712} chainId={chainId} />
    );
  }

  if (eip712Prehashed) {
    return (
      <Eip712PrehashedPanel
        eip712Prehashed={eip712Prehashed}
        request={request}
      />
    );
  }

  if (tx) {
    return <TxDataPanel tx={tx} request={request} chainId={chainId} />;
  }

  // Fallback: pure ETH transfer, personal sign, unknown/invalid types
  return (
    <View style={styles.row}>
      <InfoRow label="Data" value={request.signData} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
  },
});
