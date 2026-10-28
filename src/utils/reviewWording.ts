import type { ScanResult } from '@/types';

import { classifyEthPayload, type EthPayload } from '@/utils/ethPayload';

export type ReviewWording = {
  title: 'Review transaction' | 'Review message' | 'Review request';
  signLabel: 'Sign transaction' | 'Sign message' | 'Sign hash';
};

const TRANSACTION: ReviewWording = {
  title: 'Review transaction',
  signLabel: 'Sign transaction',
};
const MESSAGE: ReviewWording = {
  title: 'Review message',
  signLabel: 'Sign message',
};

const ETH_WORDING: Record<EthPayload['kind'], ReviewWording> = {
  'tx-legacy': TRANSACTION,
  'tx-eip2930': TRANSACTION,
  'tx-eip1559': TRANSACTION,
  'personal-message': MESSAGE,
  'eip712-json': MESSAGE,
  'eip712-prehashed': MESSAGE,
  'raw-digest': { title: 'Review message', signLabel: 'Sign hash' },
  // No Sign button: the review shows why the request cannot be signed.
  invalid: { title: 'Review request', signLabel: 'Sign transaction' },
};

const ETH_TYPE_LABELS: Record<EthPayload['kind'], string> = {
  'tx-legacy': 'Legacy Transaction',
  'tx-eip2930': 'EIP-2930 Transaction',
  'tx-eip1559': 'EIP-1559 Transaction',
  'personal-message': 'Personal Message',
  'eip712-json': 'EIP-712 Typed Data',
  'eip712-prehashed': 'EIP-712 Typed Data',
  'raw-digest': 'Hash',
  invalid: 'Ethereum request',
};

export function reviewWording(result: ScanResult): ReviewWording {
  switch (result.kind) {
    case 'eth-sign-request': {
      const { signData, dataType, chainId } = result.request;
      return ETH_WORDING[classifyEthPayload(signData, dataType, chainId).kind];
    }
    case 'crypto-psbt':
      return result.summary.requestType === 'bip322-message'
        ? MESSAGE
        : TRANSACTION;
    case 'btc-sign-request':
      return MESSAGE;
    default:
      return { title: 'Review request', signLabel: 'Sign transaction' };
  }
}

export function ethTypeLabel(
  payload: EthPayload,
  primaryType: string | undefined,
): string {
  return primaryType || ETH_TYPE_LABELS[payload.kind];
}
