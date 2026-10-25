import { StyleSheet, View } from 'react-native';

import InfoRow from '@/components/InfoRow';

import type { DecodedCall } from '@/utils/txParser';

import ContractCallSection from './ContractCallSection';
import Erc20ApproveSection from './Erc20ApproveSection';
import Erc20TransferFromSection from './Erc20TransferFromSection';
import Erc20TransferSection from './Erc20TransferSection';
import UniversalRouterSection from './UniversalRouterSection';

export default function DecodedCallSection({
  call,
  tokenContract,
  chainId,
}: {
  call: DecodedCall;
  tokenContract?: string;
  chainId?: number;
}) {
  if (call.kind === 'erc20-transfer')
    return (
      <Erc20TransferSection
        call={call}
        tokenContract={tokenContract}
        chainId={chainId}
      />
    );

  if (call.kind === 'erc20-transferFrom')
    return (
      <Erc20TransferFromSection
        call={call}
        tokenContract={tokenContract}
        chainId={chainId}
      />
    );

  if (call.kind === 'erc20-approve')
    return (
      <Erc20ApproveSection
        call={call}
        tokenContract={tokenContract}
        chainId={chainId}
      />
    );

  if (call.kind === 'contract-call') return <ContractCallSection call={call} />;

  if (call.kind === 'universal-router-execute')
    return <UniversalRouterSection call={call} />;

  return (
    <View style={styles.row}>
      <InfoRow label="Contract call" value={call.selector} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
  },
});
