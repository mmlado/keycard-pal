import { render, screen } from '@testing-library/react-native';
import React from 'react';

import EthDataTabPanel from '../src/components/SignRequestDetail/eth/DataTabPanel';
import type { EthSignRequest } from '../src/types';
import type { ParsedTx } from '../src/utils/txParser';

jest.mock('../src/components/NFCBottomSheet', () => () => null);
jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOp: () => ({
    phase: 'idle',
    status: '',
    cardName: null,
    pinError: null,
    result: null,
    start: jest.fn(),
    cancel: jest.fn(),
    submitPin: jest.fn(),
    reset: jest.fn(),
    retry: jest.fn(),
    proceedWithNonGenuine: jest.fn(),
  }),
}));
jest.mock('../src/hooks/useTenderlyConfig.online', () => ({
  useTenderlyConfig: jest.fn(() => ({ credentials: null })),
}));
jest.mock('../src/utils/tenderly/client.online', () => ({
  simulateTransaction: jest.fn(),
}));

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
  '../src/components/SignRequestDetail/eth/DataTabPanel/DecodedCallSection',
  () => {
    const { Text } = require('react-native');
    return () => <Text>DecodedCallSection</Text>;
  },
);

jest.mock(
  '../src/components/SignRequestDetail/eth/DataTabPanel/SpecialEip712Section',
  () => {
    const { Text } = require('react-native');
    return () => <Text>SpecialEip712Section</Text>;
  },
);

jest.mock('../src/utils/erc8213', () => ({
  computeCalldataDigest: () => '0x' + 'ab'.repeat(32),
  computeEip712DigestFromJson: () => '0x' + 'cd'.repeat(32),
  computeEip712DigestFromPrehashed: () => '0x' + 'ef'.repeat(32),
}));

const LEGACY_TX_HEX =
  'e9018504a817c80082520894d3cda913deb6f4967b2ef3aa68f5a843da74c4ef8806f05b59d3b2000080018080';

const request: EthSignRequest = {
  signData: LEGACY_TX_HEX,
  dataType: 1,
  derivationPath: "m/44'/60'/0'/0",
};

describe('EthDataTabPanel dispatch', () => {
  it('renders TxDataPanel (Digests tab) for a pure ETH transfer with no calldata', () => {
    const tx: ParsedTx = {
      to: '0xd3CdA913deB6f4967b2Ef3aa68f5A843dA74C4ef',
      fees: { kind: 'unknown' },
    };
    render(
      <EthDataTabPanel
        request={request}
        tx={tx}
        eip712={null}
        eip712Prehashed={null}
        chainId={1}
      />,
    );
    expect(screen.getByText('Digests')).toBeTruthy();
    expect(screen.getByText('Raw')).toBeTruthy();
  });

  it('falls back to raw InfoRow when tx is null and no eip712', () => {
    render(
      <EthDataTabPanel
        request={request}
        tx={null}
        eip712={null}
        eip712Prehashed={null}
        chainId={1}
      />,
    );
    expect(screen.getByText(new RegExp(LEGACY_TX_HEX))).toBeTruthy();
  });
});
