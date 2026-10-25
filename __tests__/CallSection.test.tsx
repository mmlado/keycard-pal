import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { encodeFunctionData, parseAbiItem, type AbiFunction } from 'viem';

import CallSection from '../src/components/SignRequestDetail/eth/DataTabPanel/CallSection';

import {
  describeCall,
  type CallDescription,
} from '../src/utils/callDescription';
import * as eip7730Lookup from '../src/utils/eip7730/lookup';
import { checksumEthAddress } from '../src/utils/ethereumAddress';

jest.mock('react-native-paper', () => {
  const { Text, View } = require('react-native');
  return {
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
    Icon: () => <View />,
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

jest.mock('../src/utils/buildConfig', () => ({
  INTERNET_ENABLED: false,
}));

jest.mock('../src/hooks/useTokenImagesEnabled.online', () => ({
  __esModule: true,
  default: () => false,
}));

const RECIPIENT = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const UNKNOWN = '0x000000000000000000000000000000000000dEaD';
const MAINNET = 1;

function encode(signature: string, args: unknown[]): string {
  return encodeFunctionData({
    abi: [parseAbiItem(`function ${signature}`) as AbiFunction],
    args,
  });
}

function described(contract: string, data: string): CallDescription {
  const description = describeCall({
    chainId: MAINNET,
    contract,
    data,
    depth: 0,
  });
  if (description instanceof Promise) throw new Error('waited for a slice');
  return description;
}

function show(contract: string, data: string) {
  return render(
    <CallSection
      description={described(contract, data)}
      contract={contract}
      chainId={MAINNET}
    />,
  );
}

// An entry that reads its token from the contract it is called on.
const amountAtTo = (signature: string) => ({
  intent: 'Approve',
  signature,
  fields: [
    {
      path: 'amount',
      label: 'Amount',
      format: 'tokenAmount' as const,
      params: { tokenPath: '@.to' },
    },
  ],
});

afterEach(() => jest.restoreAllMocks());

describe('CallSection', () => {
  it("keeps a token call's contract row above the registry's entry", () => {
    show(
      USDT,
      encode('transfer(address to, uint256 amount)', [RECIPIENT, 1_500_000n]),
    );
    expect(screen.getByText('Send')).toBeTruthy();
    expect(
      screen.getByText(`Token contract: ${checksumEthAddress(USDT)}`),
    ).toBeTruthy();
    expect(screen.getByText('Amount: 1.5 USDT')).toBeTruthy();
    expect(screen.queryByText('ERC-20 Transfer')).toBeNull();
  });

  it('names an unknown token contract once on a token call', () => {
    jest
      .spyOn(eip7730Lookup, 'lookupCalldata')
      .mockReturnValue(amountAtTo('approve(address spender, uint256 amount)'));
    show(
      UNKNOWN,
      encode('approve(address spender, uint256 amount)', [RECIPIENT, 7n]),
    );
    expect(screen.getByText('Unknown token')).toBeTruthy();
    expect(
      screen.getAllByText(`Token contract: ${checksumEthAddress(UNKNOWN)}`),
    ).toHaveLength(1);
  });

  it("keeps the entry's own token contract row on any other call", () => {
    const signature = 'keycardPalPull(uint256 amount)';
    jest
      .spyOn(eip7730Lookup, 'lookupCalldata')
      .mockReturnValue(amountAtTo(signature));
    show(UNKNOWN, encode(signature, [7n]));
    expect(
      screen.getByText(`Token contract: ${checksumEthAddress(UNKNOWN)}`),
    ).toBeTruthy();
  });

  it('leaves the contract row to the header for other calls, unknown ones included', () => {
    const signature = 'keycardPalSwap(uint256 amount)';
    jest
      .spyOn(eip7730Lookup, 'lookupCalldata')
      .mockReturnValue({ intent: 'Swap', signature, fields: [] });
    show(UNKNOWN, encode(signature, [7n]));
    expect(screen.getByText('Swap')).toBeTruthy();
    expect(screen.queryByText(/Token contract/)).toBeNull();
    expect(screen.queryByText(/Contract call/)).toBeNull();
  });

  it("shows the app's own section when no entry describes the call", () => {
    show(
      UNKNOWN,
      encode('transfer(address to, uint256 amount)', [RECIPIENT, 7n]),
    );
    expect(screen.getByText('ERC-20 Transfer')).toBeTruthy();
  });

  it('renders nothing for a call the review shows as written', () => {
    const view = show(UNKNOWN, '0xdeadbeef');
    expect(view.toJSON()).toBeNull();
  });
});
