import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import TxDataPanel from '../src/components/SignRequestDetail/eth/DataTabPanel/TxDataPanel';
import type { ParsedTx } from '../src/utils/txParser';
import type { EthSignRequest } from '../src/types';

jest.mock('react-native-paper', () => {
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
    SegmentedButtons: ({
      buttons,
      onValueChange,
    }: {
      value: string;
      onValueChange: (v: string) => void;
      buttons: { value: string; label: string }[];
    }) => (
      <View>
        {buttons.map((b: any) => (
          <TouchableOpacity
            key={b.value}
            onPress={() => onValueChange(b.value)}
          >
            <Text>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
  };
});

jest.mock('../src/theme', () => ({
  __esModule: true,
  default: { colors: { onSurfaceVariant: '#aaa', negative: '#f00' } },
}));

jest.mock('../src/components/InfoRow', () => {
  const { Text } = require('react-native');
  return ({ label, value }: { label: string; value: string }) => (
    <Text>{`${label}: ${value}`}</Text>
  );
});

jest.mock(
  '../src/components/SignRequestDetail/eth/DataTabPanel/DecodedCallSection',
  () => {
    const { Text } = require('react-native');
    return () => <Text>DecodedCallSection</Text>;
  },
);

const CALLDATA =
  '0xa9059cbb000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0000000000000000000000000000000000000000000000000de0b6b3a7640000';

const request: EthSignRequest = {
  signData: CALLDATA,
  dataType: 1,
  derivationPath: "m/44'/60'/0'/0",
};

const txWithDecoded: ParsedTx = {
  to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  data: CALLDATA,
  decodedCall: {
    kind: 'erc20-transfer',
    to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    amount: 1000000000000000000n,
  },
  fees: { kind: 'unknown' },
};

const txWithoutDecoded: ParsedTx = {
  to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  data: CALLDATA,
  decodedCall: { kind: 'unknown-call', selector: '0xa9059cbb' },
  fees: { kind: 'unknown' },
};

const txNoData: ParsedTx = {
  to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  fees: { kind: 'unknown' },
};

describe('TxDataPanel', () => {
  describe('with no tx.data', () => {
    it('shows Digests tab with null digest (no calldata)', () => {
      render(<TxDataPanel tx={txNoData} request={request} chainId={1} />);
      expect(screen.getByText('Digests')).toBeTruthy();
      expect(screen.queryByText(/Calldata Digest:/)).toBeNull();
    });
  });
  describe('with decoded call', () => {
    it('shows Decoded tab by default and renders decoded section', () => {
      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
      expect(screen.getByText('Decoded')).toBeTruthy();
      expect(screen.getByText('Digests')).toBeTruthy();
      expect(screen.getByText('Raw')).toBeTruthy();
      expect(screen.getByText('DecodedCallSection')).toBeTruthy();
    });

    it('switches to Digests tab and shows calldata digest', () => {
      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
      fireEvent.press(screen.getByText('Digests'));
      expect(screen.getByText(/Calldata Digest: 0x[0-9a-f]{64}/)).toBeTruthy();
    });

    it('switches to Raw tab and shows signData', () => {
      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
      fireEvent.press(screen.getByText('Raw'));
      expect(screen.getByText(new RegExp(CALLDATA))).toBeTruthy();
    });
  });

  describe('without decoded call (unknown-call)', () => {
    it('shows Digests and Raw tabs only, defaults to Digests', () => {
      render(
        <TxDataPanel tx={txWithoutDecoded} request={request} chainId={1} />,
      );
      expect(screen.queryByText('Decoded')).toBeNull();
      expect(screen.getByText('Digests')).toBeTruthy();
      expect(screen.getByText('Raw')).toBeTruthy();
      expect(screen.getByText(/Calldata Digest: 0x[0-9a-f]{64}/)).toBeTruthy();
    });

    it('switches to Raw tab', () => {
      render(
        <TxDataPanel tx={txWithoutDecoded} request={request} chainId={1} />,
      );
      fireEvent.press(screen.getByText('Raw'));
      expect(screen.getByText(new RegExp(CALLDATA))).toBeTruthy();
    });
  });
});
