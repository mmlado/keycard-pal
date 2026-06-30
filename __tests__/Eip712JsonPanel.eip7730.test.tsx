import React from 'react';
import { render, screen } from '@testing-library/react-native';

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
  default: {
    colors: {
      onSurfaceVariant: '#aaa',
      negative: '#f00',
      primary: '#1e88e5',
    },
  },
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
    <Text>{`ADDR ${label}: ${value}`}</Text>
  );
});

jest.mock(
  '../src/components/SignRequestDetail/eth/DataTabPanel/SpecialEip712Section',
  () => {
    const { Text } = require('react-native');
    return () => <Text>SpecialEip712Section</Text>;
  },
);

const mockLookupEip712 = jest.fn();
jest.mock('../src/utils/eip7730/lookup', () => ({
  lookupEip712: (...args: any[]) => mockLookupEip712(...args),
}));

beforeEach(() => jest.clearAllMocks());

const VERIFYING = '0x000000000022d473030f116ddee9f6b43ac78ba3';

function buildPayload(message: Record<string, unknown>) {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'verifyingContract', type: 'address' },
        { name: 'chainId', type: 'uint256' },
      ],
      PermitSingle: [
        { name: 'spender', type: 'address' },
        { name: 'sigDeadline', type: 'uint256' },
      ],
    },
    primaryType: 'PermitSingle',
    domain: {
      name: 'Permit2',
      verifyingContract: VERIFYING,
      chainId: 1,
    },
    message,
  };
}

function buildRequest(payload: object): EthSignRequest {
  return {
    signData: Buffer.from(JSON.stringify(payload), 'utf8').toString('hex'),
    dataType: 2,
    derivationPath: "m/44'/60'/0'/0",
  };
}

function buildSummary(message: Record<string, string>): Eip712Summary {
  return {
    rawJson: JSON.stringify(buildPayload(message), null, 2),
    primaryType: 'PermitSingle',
    domain: {
      name: 'Permit2',
      verifyingContract: VERIFYING,
      chainId: '1',
    },
    message,
  };
}

describe('Eip712JsonPanel EIP-7730 integration', () => {
  it('renders descriptor intent + fields when descriptor found, bypasses SpecialEip712Section', () => {
    mockLookupEip712.mockReturnValue({
      intent: 'Approve spender',
      fields: [
        { path: 'spender', label: 'Spender', format: 'addressName' },
        { path: 'sigDeadline', label: 'Expires', format: 'date' },
      ],
    });
    const payload = buildPayload({
      spender: '0xabc0000000000000000000000000000000000001',
      sigDeadline: '1700000000',
    });
    const eip712 = {
      ...buildSummary({
        spender: '0xabc0000000000000000000000000000000000001',
        sigDeadline: '1700000000',
      }),
      special: { kind: 'permit' } as any,
    };

    render(
      <Eip712JsonPanel
        request={buildRequest(payload)}
        eip712={eip712}
        chainId={1}
      />,
    );

    expect(screen.getByText('Approve spender')).toBeTruthy();
    expect(
      screen.getByText(
        'ADDR Spender: 0xabc0000000000000000000000000000000000001',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('SpecialEip712Section')).toBeNull();
  });

  it('falls back to SpecialEip712Section when descriptor not found', () => {
    mockLookupEip712.mockReturnValue(null);
    const eip712 = {
      ...buildSummary({ spender: '0xabc' }),
      special: { kind: 'permit' } as any,
    };
    render(
      <Eip712JsonPanel
        request={buildRequest(buildPayload({ spender: '0xabc' }))}
        eip712={eip712}
        chainId={1}
      />,
    );
    expect(screen.getByText('SpecialEip712Section')).toBeTruthy();
  });

  it('does not call lookup when verifyingContract is missing', () => {
    const payload = {
      types: { EIP712Domain: [], Mail: [] },
      primaryType: 'Mail',
      domain: { name: 'NoContract' },
      message: {},
    };
    const eip712: Eip712Summary = {
      rawJson: JSON.stringify(payload),
      primaryType: 'Mail',
      domain: { name: 'NoContract' },
      message: {},
    };
    render(
      <Eip712JsonPanel
        request={buildRequest(payload)}
        eip712={eip712}
        chainId={1}
      />,
    );
    expect(mockLookupEip712).not.toHaveBeenCalled();
  });

  it('does not call lookup when chainId is undefined', () => {
    render(
      <Eip712JsonPanel
        request={buildRequest(buildPayload({}))}
        eip712={buildSummary({})}
        chainId={undefined}
      />,
    );
    expect(mockLookupEip712).not.toHaveBeenCalled();
  });
});
