import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import Eip712PrehashedPanel from '../src/components/SignRequestDetail/eth/DataTabPanel/Eip712PrehashedPanel';
import type { Eip712Prehashed } from '../src/utils/eip712';
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

const DOMAIN_HASH =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const MESSAGE_HASH =
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const prehashed: Eip712Prehashed = {
  domainSeparatorHash: DOMAIN_HASH,
  messageHash: MESSAGE_HASH,
};

const request: EthSignRequest = {
  signData: '1901' + DOMAIN_HASH.slice(2) + MESSAGE_HASH.slice(2),
  dataType: 2,
  derivationPath: "m/44'/60'/0'/0",
};

describe('Eip712PrehashedPanel', () => {
  it('shows Details tab by default with domain separator and message hash', () => {
    render(
      <Eip712PrehashedPanel eip712Prehashed={prehashed} request={request} />,
    );
    expect(screen.getByText(/Domain separator/)).toBeTruthy();
    expect(screen.getByText(new RegExp(DOMAIN_HASH))).toBeTruthy();
    expect(screen.getByText(/Message hash/)).toBeTruthy();
    expect(screen.getByText(new RegExp(MESSAGE_HASH))).toBeTruthy();
  });

  it('switches to Digests tab and shows all three hash rows', () => {
    render(
      <Eip712PrehashedPanel eip712Prehashed={prehashed} request={request} />,
    );
    fireEvent.press(screen.getByText('Digests'));
    expect(screen.getByText(/EIP-712 Digest/)).toBeTruthy();
    expect(screen.getByText(/Domain Hash/)).toBeTruthy();
    expect(screen.getByText(/Message Hash/)).toBeTruthy();
  });

  it('switches to Raw tab and shows signData', () => {
    render(
      <Eip712PrehashedPanel eip712Prehashed={prehashed} request={request} />,
    );
    fireEvent.press(screen.getByText('Raw'));
    expect(screen.getByText(new RegExp(request.signData))).toBeTruthy();
  });

  it('EIP-712 digest on Digests tab is a 32-byte hex hash', () => {
    render(
      <Eip712PrehashedPanel eip712Prehashed={prehashed} request={request} />,
    );
    fireEvent.press(screen.getByText('Digests'));
    const digestRow = screen.getByText(/EIP-712 Digest: 0x[0-9a-f]{64}/);
    expect(digestRow).toBeTruthy();
  });
});
