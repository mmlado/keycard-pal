import type { ScanResult } from '../src/types';
import { classifyEthPayload, type EthPayload } from '../src/utils/ethPayload';
import { ethTypeLabel, reviewWording } from '../src/utils/reviewWording';

import { PAYLOAD_REQUESTS } from './ethPayloads.testUtils';

const ETH_CASES: [EthPayload['kind'], string, string, string][] = [
  ['tx-legacy', 'Review transaction', 'Sign transaction', 'Legacy Transaction'],
  [
    'tx-eip2930',
    'Review transaction',
    'Sign transaction',
    'EIP-2930 Transaction',
  ],
  [
    'tx-eip1559',
    'Review transaction',
    'Sign transaction',
    'EIP-1559 Transaction',
  ],
  ['personal-message', 'Review message', 'Sign message', 'Personal Message'],
  ['eip712-json', 'Review message', 'Sign message', 'EIP-712 Typed Data'],
  ['eip712-prehashed', 'Review message', 'Sign message', 'EIP-712 Typed Data'],
  ['raw-digest', 'Review message', 'Sign hash', 'Hash'],
  ['invalid', 'Review request', 'Sign transaction', 'Ethereum request'],
];

function ethResult(kind: EthPayload['kind']): ScanResult {
  return {
    kind: 'eth-sign-request',
    request: {
      ...PAYLOAD_REQUESTS[kind],
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    },
  };
}

describe('reviewWording', () => {
  it.each(ETH_CASES)('%s: %s, %s', (kind, title, signLabel) => {
    const { signData, dataType } = PAYLOAD_REQUESTS[kind];
    expect(classifyEthPayload(signData, dataType, 1).kind).toBe(kind);
    expect(reviewWording(ethResult(kind))).toEqual({ title, signLabel });
  });

  it('follows the classification, not the data type', () => {
    // dataType 1 bytes that start 0x02: no transaction kind accepts them.
    const result: ScanResult = {
      kind: 'eth-sign-request',
      request: {
        signData: PAYLOAD_REQUESTS['tx-eip1559'].signData,
        dataType: 1,
        derivationPath: "m/44'/60'/0'/0",
        chainId: 1,
      },
    };
    expect(reviewWording(result).title).toBe('Review request');
  });

  it('reviews a BIP-322 PSBT and a Bitcoin message as messages, any other PSBT as a transaction', () => {
    const psbt = (requestType: string) =>
      ({ kind: 'crypto-psbt', request: {}, summary: { requestType } } as never);
    expect(reviewWording(psbt('bip322-message'))).toEqual({
      title: 'Review message',
      signLabel: 'Sign message',
    });
    expect(reviewWording(psbt('transaction'))).toEqual({
      title: 'Review transaction',
      signLabel: 'Sign transaction',
    });
    expect(
      reviewWording({ kind: 'btc-sign-request', request: {} } as never),
    ).toEqual({ title: 'Review message', signLabel: 'Sign message' });
  });

  it.each([
    { kind: 'error', message: 'bad' },
    { kind: 'unsupported', type: 'crypto-foo' },
  ] as ScanResult[])('titles a $kind result as a request', result => {
    expect(reviewWording(result).title).toBe('Review request');
  });
});

describe('ethTypeLabel', () => {
  it.each(ETH_CASES)('%s reads %s', (kind, _title, _sign, label) => {
    const { signData, dataType } = PAYLOAD_REQUESTS[kind];
    expect(
      ethTypeLabel(classifyEthPayload(signData, dataType, 1), undefined),
    ).toBe(label);
  });

  it('names a typed-data message by its primaryType, refused or not', () => {
    const invalid = classifyEthPayload('e8aabbccdd', 1, 1);
    expect(ethTypeLabel(invalid, 'Permit')).toBe('Permit');
  });
});
