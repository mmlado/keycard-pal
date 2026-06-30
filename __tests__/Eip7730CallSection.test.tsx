import React from 'react';
import { render, screen } from '@testing-library/react-native';

import Eip7730CallSection from '../src/components/SignRequestDetail/eth/DataTabPanel/DecodedCallSection/Eip7730CallSection';

import type { Eip7730DisplayFormat } from '../src/utils/eip7730/zip';
import type { DecodedCall } from '../src/utils/txParser';

jest.mock('../src/utils/tokenMetadata', () => ({
  lookupToken: jest.fn().mockReturnValue({ symbol: 'USDC', decimals: 6 }),
}));

jest.mock('../src/components/ens/AddressInfoRow.online', () => {
  const { View, Text } = require('react-native');
  return function MockAddressInfoRow({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) {
    return (
      <View testID={`address-${label}`}>
        <Text>{label}</Text>
        <Text>{value}</Text>
      </View>
    );
  };
});

describe('Eip7730CallSection', () => {
  it('renders intent string when present', () => {
    const format: Eip7730DisplayFormat = {
      intent: 'Send USDC',
      fields: [],
    };
    const call: DecodedCall = {
      kind: 'erc20-transfer',
      to: '0xabc',
      amount: 1n,
    };
    render(<Eip7730CallSection format={format} call={call} />);
    expect(screen.getByText('Send USDC')).toBeTruthy();
  });

  it('renders an AddressInfoRow for addressName fields', () => {
    const format: Eip7730DisplayFormat = {
      fields: [{ path: 'to', label: 'Recipient', format: 'addressName' }],
    };
    const call: DecodedCall = {
      kind: 'erc20-transfer',
      to: '0x1234567890abcdef1234567890abcdef12345678',
      amount: 1n,
    };
    render(<Eip7730CallSection format={format} call={call} />);
    expect(screen.getByTestId('address-Recipient')).toBeTruthy();
    expect(
      screen.getByText('0x1234567890abcdef1234567890abcdef12345678'),
    ).toBeTruthy();
  });

  it('formats tokenAmount via descriptor metadata', () => {
    const format: Eip7730DisplayFormat = {
      fields: [{ path: 'amount', label: 'Amount', format: 'tokenAmount' }],
      metadata: {
        tokens: {
          '0xtokenfeed': { decimals: 6, ticker: 'USDC' },
        },
      },
    };
    const call: DecodedCall = {
      kind: 'erc20-transfer',
      to: '0xrecipient',
      amount: 1500000n,
    };
    render(
      <Eip7730CallSection
        format={format}
        call={call}
        contractAddress="0xtokenfeed"
        chainId={1}
      />,
    );
    expect(screen.getByText('1.5 USDC')).toBeTruthy();
  });

  it('renders em-dash for unresolved field paths', () => {
    const format: Eip7730DisplayFormat = {
      fields: [{ path: 'missingField', label: 'Missing', format: 'raw' }],
    };
    const call: DecodedCall = {
      kind: 'contract-call',
      selector: '0xdeadbeef',
      functionName: 'doStuff',
      signature: 'doStuff()',
      args: [],
    };
    render(<Eip7730CallSection format={format} call={call} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
