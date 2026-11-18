import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';

import Eip712JsonPanel from '../src/components/SignRequestDetail/eth/DataTabPanel/Eip712JsonPanel';
import { UNCOVERED_VALUES_WARNING } from '../src/constants/eip712';
import { parseEip712Summary, type Eip712Summary } from '../src/utils/eip712';
import { classifyEthPayload } from '../src/utils/ethPayload';
import type { EthSignRequest } from '../src/types';

// The classification SignRequestDetail hands the panel.
function Panel(
  props: Omit<React.ComponentProps<typeof Eip712JsonPanel>, 'payload'>,
) {
  return (
    <Eip712JsonPanel
      {...props}
      payload={classifyEthPayload(
        props.request.signData,
        props.request.dataType,
      )}
    />
  );
}

jest.mock('react-native-paper', () => {
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    Icon: () => <View />,
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
  miscasedAddresses: [],
  uncoveredValues: false,
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
    render(<Panel request={request} eip712={eip712} chainId={1} />);
    expect(screen.getByText('Primary type: Mail')).toBeTruthy();
    expect(screen.getByText('name: Ether Mail')).toBeTruthy();
  });

  it("switches to Digests tab and shows the classification's digest", () => {
    const payload = classifyEthPayload(request.signData, request.dataType);
    if (payload.kind !== 'eip712-json') throw new Error(payload.kind);
    render(<Panel request={request} eip712={eip712} chainId={1} />);
    fireEvent.press(screen.getByText('Digests'));
    expect(screen.getByText(`EIP-712 Digest: ${payload.digest}`)).toBeTruthy();
    expect(screen.getByTestId('digest-explainer')).toBeTruthy();
  });

  describe('a SafeTx', () => {
    const SAFE = '0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe' as const;
    const ZERO = '0x0000000000000000000000000000000000000000' as const;
    const message = {
      to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
      value: '0',
      data: '0xdeadbeef' as const,
      operation: 1,
      safeTxGas: '0',
      baseGas: '0',
      gasPrice: '0',
      gasToken: ZERO,
      refundReceiver: ZERO,
      nonce: '42',
    };
    const SAFE_TX = [
      ['to', 'address'],
      ['value', 'uint256'],
      ['data', 'bytes'],
      ['operation', 'uint8'],
      ['safeTxGas', 'uint256'],
      ['baseGas', 'uint256'],
      ['gasPrice', 'uint256'],
      ['gasToken', 'address'],
      ['refundReceiver', 'address'],
      ['nonce', 'uint256'],
    ].map(([name, type]) => ({ name, type }));
    const typed = (safeTx = SAFE_TX) => ({
      types: {
        EIP712Domain: [
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        SafeTx: safeTx,
      },
      primaryType: 'SafeTx',
      domain: { chainId: 1, verifyingContract: SAFE },
      message,
    });
    // Safe 1.4.1's getTransactionHash, with the constants from Safe.sol.
    const safeTxHash = () => {
      const domainSeparator = keccak256(
        encodeAbiParameters(parseAbiParameters('bytes32, uint256, address'), [
          '0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218',
          1n,
          SAFE,
        ]),
      );
      const structHash = keccak256(
        encodeAbiParameters(
          parseAbiParameters(
            'bytes32, address, uint256, bytes32, uint8, uint256, uint256, uint256, address, address, uint256',
          ),
          [
            '0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8',
            message.to,
            0n,
            keccak256(message.data),
            1,
            0n,
            0n,
            0n,
            ZERO,
            ZERO,
            42n,
          ],
        ),
      );
      return keccak256(
        `0x1901${domainSeparator.slice(2)}${structHash.slice(2)}`,
      );
    };
    const show = (data: object) => {
      const signData = Buffer.from(JSON.stringify(data), 'utf8').toString(
        'hex',
      );
      render(
        <Panel
          request={{ ...request, signData }}
          eip712={parseEip712Summary(signData)!}
          chainId={1}
        />,
      );
      fireEvent.press(screen.getByText('Digests'));
    };

    it("names its digest the safeTxHash, Safe's own hash of it", () => {
      show(typed());
      expect(
        screen.getByText(`EIP-712 Digest (safeTxHash): ${safeTxHash()}`),
      ).toBeTruthy();
    });

    it('names no safeTxHash for types Safe does not hash', () => {
      show(typed(SAFE_TX.filter(member => member.name !== 'nonce')));
      expect(screen.getByText(/^EIP-712 Digest: 0x/)).toBeTruthy();
    });
  });

  it('switches to Raw tab and shows raw JSON', () => {
    render(<Panel request={request} eip712={eip712} chainId={1} />);
    fireEvent.press(screen.getByText('Raw'));
    expect(screen.getByText(new RegExp('Data:'))).toBeTruthy();
  });

  it('says when the request carries values its signature does not cover', () => {
    render(<Panel request={request} eip712={eip712} chainId={1} />);
    expect(screen.queryByText(UNCOVERED_VALUES_WARNING)).toBeNull();
    screen.unmount();

    render(
      <Panel
        request={request}
        eip712={{ ...eip712, uncoveredValues: true }}
        chainId={1}
      />,
    );
    expect(screen.getByText(UNCOVERED_VALUES_WARNING)).toBeTruthy();
  });

  it('shows message fields when no special review', () => {
    render(<Panel request={request} eip712={eip712} chainId={1} />);
    expect(
      screen.getByText('from: 0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'),
    ).toBeTruthy();
  });

  it('renders special EIP-712 review section when available', () => {
    render(
      <Panel
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
    render(<Panel request={invalidRequest} eip712={eip712} chainId={1} />);
    fireEvent.press(screen.getByText('Digests'));
    expect(screen.queryByText(/EIP-712 Digest:/)).toBeNull();
  });
});
