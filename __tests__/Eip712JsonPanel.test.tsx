import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import Eip712JsonPanel from '../src/components/SignRequestDetail/eth/DataTabPanel/Eip712JsonPanel';
import type { Eip712Summary } from '../src/utils/eip712';
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

jest.mock('../src/components/ens/AddressInfoRow.online', () => {
  const { Text } = require('react-native');
  return ({ label, value }: { label: string; value: string }) => (
    <Text>{`${label}: ${value}`}</Text>
  );
});

jest.mock(
  '../src/components/SignRequestDetail/eth/DataTabPanel/SpecialEip712Section',
  () => {
    const { Text } = require('react-native');
    return () => <Text>SpecialEip712Section</Text>;
  },
);

const PAYLOAD = {
  types: {
    EIP712Domain: [{ name: 'name', type: 'string' }],
    Mail: [{ name: 'from', type: 'address' }],
  },
  primaryType: 'Mail',
  domain: { name: 'Ether Mail' },
  message: { from: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' },
};

const RAW_JSON = JSON.stringify(PAYLOAD, null, 2);

const eip712: Eip712Summary = {
  rawJson: RAW_JSON,
  primaryType: 'Mail',
  domain: { name: 'Ether Mail' },
  message: { from: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' },
};

const request: EthSignRequest = {
  signData: Buffer.from(JSON.stringify(PAYLOAD), 'utf8').toString('hex'),
  dataType: 2,
  derivationPath: "m/44'/60'/0'/0",
};

describe('Eip712JsonPanel', () => {
  it('shows Details tab by default with primary type and domain', () => {
    render(<Eip712JsonPanel request={request} eip712={eip712} chainId={1} />);
    expect(screen.getByText('Primary type: Mail')).toBeTruthy();
    expect(screen.getByText('name: Ether Mail')).toBeTruthy();
  });

  it('switches to Digests tab and shows EIP-712 digest', () => {
    render(<Eip712JsonPanel request={request} eip712={eip712} chainId={1} />);
    fireEvent.press(screen.getByText('Digests'));
    expect(screen.getByText(/EIP-712 Digest: 0x[0-9a-f]{64}/)).toBeTruthy();
  });

  it('switches to Raw tab and shows raw JSON', () => {
    render(<Eip712JsonPanel request={request} eip712={eip712} chainId={1} />);
    fireEvent.press(screen.getByText('Raw'));
    expect(screen.getByText(new RegExp('Data:'))).toBeTruthy();
  });

  it('shows message fields when no special review', () => {
    render(<Eip712JsonPanel request={request} eip712={eip712} chainId={1} />);
    expect(
      screen.getByText('from: 0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'),
    ).toBeTruthy();
  });

  it('shows pre-hashed digest on Digests tab when signData is already a 32-byte hex hash (dataType=0 WC path)', () => {
    const digest =
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const prehashedRequest: EthSignRequest = {
      signData: digest,
      dataType: 0,
      derivationPath: "m/44'/60'/0'/0",
    };
    render(
      <Eip712JsonPanel
        request={prehashedRequest}
        eip712={eip712}
        chainId={1}
      />,
    );
    fireEvent.press(screen.getByText('Digests'));
    expect(screen.getByText(`EIP-712 Digest: ${digest}`)).toBeTruthy();
  });

  it('renders special EIP-712 review section when available', () => {
    render(
      <Eip712JsonPanel
        request={request}
        eip712={{ ...eip712, special: { kind: 'permit' } as any }}
        chainId={1}
      />,
    );
    expect(screen.getByText('SpecialEip712Section')).toBeTruthy();
  });

  it('omits digest row when signData cannot be parsed or treated as a digest', () => {
    const invalidRequest: EthSignRequest = {
      signData: 'not-eip712-json-or-digest',
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
    };
    render(
      <Eip712JsonPanel request={invalidRequest} eip712={eip712} chainId={1} />,
    );
    fireEvent.press(screen.getByText('Digests'));
    expect(screen.queryByText(/EIP-712 Digest:/)).toBeNull();
  });
});
