import React from 'react';
import { render, screen } from '@testing-library/react-native';

import PsbtDetail from '../src/components/SignRequestDetail/btc/PsbtDetail';
import type { BtcPsbtSummary } from '../src/utils/btcPsbt';

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text, Icon: () => null };
});

function summary(network: BtcPsbtSummary['network']): BtcPsbtSummary {
  return {
    requestType: 'transaction',
    network,
    inputCount: 1,
    outputCount: 0,
    outputs: [],
    fee: { kind: 'known', sats: 0 },
    totalOutputSats: 0,
  };
}

describe('PsbtDetail network', () => {
  it.each([
    ['mainnet', 'Bitcoin Mainnet'],
    // Coin type 1 and the tb prefix are shared, and a version 0 PSBT names no network.
    ['testnet', 'Bitcoin Testnet or Signet'],
    ['unknown', 'Unknown'],
  ] as const)('labels %s as %s', (network, label) => {
    render(<PsbtDetail summary={summary(network)} />);
    expect(screen.getByText(label)).toBeTruthy();
  });
});
