import { StyleSheet, View } from 'react-native';

import InfoRow from '@/components/InfoRow';

import { lookupCalldata } from '@/utils/eip7730/lookup';
import type { DecodedCall } from '@/utils/txParser';

import ContractCallSection from './ContractCallSection';
import Eip7730CallSection from './Eip7730CallSection';
import Erc20ApproveSection from './Erc20ApproveSection';
import Erc20TransferFromSection from './Erc20TransferFromSection';
import Erc20TransferSection from './Erc20TransferSection';
import UniversalRouterSection from './UniversalRouterSection';

function selectorForCall(call: DecodedCall): string | null {
  switch (call.kind) {
    case 'erc20-transfer':
      return '0xa9059cbb';
    case 'erc20-transferFrom':
      return '0x23b872dd';
    case 'erc20-approve':
      return '0x095ea7b3';
    case 'contract-call':
      return call.selector;
    case 'unknown-call':
      return call.selector;
    default:
      return null;
  }
}

export default function DecodedCallSection({
  call,
  tokenContract,
  chainId,
}: {
  call: DecodedCall;
  tokenContract?: string;
  chainId?: number;
}) {
  const selector = selectorForCall(call);
  const descriptor =
    chainId !== undefined && tokenContract && selector
      ? lookupCalldata(chainId, tokenContract, selector)
      : null;

  if (descriptor) {
    return (
      <Eip7730CallSection
        format={descriptor}
        call={call}
        contractAddress={tokenContract}
        chainId={chainId}
      />
    );
  }

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
