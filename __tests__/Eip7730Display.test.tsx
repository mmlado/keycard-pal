import { act, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { encodeFunctionData, parseAbiItem, type AbiFunction } from 'viem';

import Eip7730Display, {
  DisplayNodes,
} from '../src/components/SignRequestDetail/eth/DataTabPanel/Eip7730Display';

import type {
  DescriptorDisplay,
  DisplayNode,
} from '../src/utils/eip7730/display';
import { setSavedIndex } from '../src/utils/eip7730/lookup';
import {
  BUNDLED_SOURCE_TEXT,
  NOT_REVIEWED_TEXT,
} from '../src/utils/eip7730/source';

jest.mock('../src/components/InfoRow', () => {
  const { Text, View } = require('react-native');
  return ({ label, value, name }: any) => (
    <View testID={`info-${label}`}>
      {name}
      <Text>{`${label}: ${value}`}</Text>
    </View>
  );
});

jest.mock('../src/components/ens/AddressInfoRow.online', () => {
  const { Text, View } = require('react-native');
  return ({ label, value, ens = true, name }: any) => (
    <View testID={`address-${label}`}>
      {name}
      <Text>{`${label}: ${value}${ens ? '' : ' (no ENS)'}`}</Text>
    </View>
  );
});

jest.mock('../src/utils/buildConfig', () => ({ INTERNET_ENABLED: false }));

jest.mock('../src/hooks/useTokenImagesEnabled.online', () => ({
  __esModule: true,
  default: () => false,
}));

const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const RECIPIENT = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
const transfer = encodeFunctionData({
  abi: [
    parseAbiItem(
      'function transfer(address to, uint256 amount)',
    ) as AbiFunction,
  ],
  args: [RECIPIENT, 1_500_000n],
});

const display = (overrides: Partial<DescriptorDisplay>): DescriptorDisplay => ({
  heading: 'Send',
  interpolated: false,
  source: true,
  review: NOT_REVIEWED_TEXT,
  nodes: [],
  ...overrides,
});

describe('Eip7730Display', () => {
  it('draws a text row through InfoRow and an address row through AddressInfoRow, with its token, ENS choice, caption and warnings', () => {
    const nodes: DisplayNode[] = [
      { kind: 'text', label: 'Amount', value: '1.5', warnings: ['Watch it'] },
      {
        kind: 'address',
        label: 'Spender',
        value: RECIPIENT,
        ens: false,
        token: { symbol: 'USDC', decimals: 6 },
        caption: 'The address signing this',
        warnings: [],
      },
    ];
    render(<DisplayNodes nodes={nodes} />);
    expect(
      within(screen.getByTestId('info-Amount')).getByText('Amount: 1.5'),
    ).toBeTruthy();
    expect(screen.getByText('Watch it')).toBeTruthy();
    const spender = screen.getByTestId('address-Spender');
    expect(within(spender).getByText('USDC')).toBeTruthy();
    expect(
      within(spender).getByText(`Spender: ${RECIPIENT} (no ENS)`),
    ).toBeTruthy();
    expect(screen.getByText('The address signing this')).toBeTruthy();
  });

  it("draws headings, titled and untitled blocks, a call's own warning, a token line and a group of rows", () => {
    const row = (label: string): DisplayNode => ({
      kind: 'text',
      label,
      value: 'x',
      warnings: [],
    });
    const nodes: DisplayNode[] = [
      { kind: 'section', title: 'Details' },
      { kind: 'item', title: 'Item 1 of 2', nodes: [row('First')] },
      { kind: 'item', nodes: [row('Second')] },
      { kind: 'warning', text: 'The entry does not fit' },
      { kind: 'token', token: { symbol: 'USDT', decimals: 6 } },
      {
        kind: 'group',
        rows: [
          { kind: 'text', label: 'Command 1', value: 'Wrap ETH', warnings: [] },
          {
            kind: 'address',
            label: 'recipient (address)',
            value: RECIPIENT,
            ens: true,
            warnings: [],
          },
        ],
      },
    ];
    render(<DisplayNodes nodes={nodes} />);
    for (const text of [
      'Details',
      'Item 1 of 2',
      'First: x',
      'Second: x',
      'The entry does not fit',
      'USDT',
      'Command 1: Wrap ETH',
      `recipient (address): ${RECIPIENT}`,
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it('heads an entry, says where it came from at the top level, and follows a change of registry', () => {
    render(
      <Eip7730Display display={display({ review: 'Reviewed by Cyfrin' })} />,
    );
    expect(screen.getByText('Send')).toBeTruthy();
    expect(screen.getByText(BUNDLED_SOURCE_TEXT)).toBeTruthy();
    expect(screen.getByText('Reviewed by Cyfrin')).toBeTruthy();
    try {
      act(() =>
        setSavedIndex({
          generatedAt: '2026-10-13T12:00:00.000Z',
          source: 'import',
        }),
      );
      expect(screen.getByText(/^From a registry imported on /)).toBeTruthy();
    } finally {
      act(() => setSavedIndex(null));
    }
  });

  it('leaves the source out below the top level', () => {
    render(<Eip7730Display display={display({ source: false })} />);
    expect(screen.queryByTestId('descriptor-source')).toBeNull();
    expect(screen.getByTestId('descriptor-review')).toBeTruthy();
  });

  it('describes an inner call on its own and draws its entry', () => {
    render(
      <DisplayNodes
        nodes={[
          {
            kind: 'call',
            request: { chainId: 1, contract: USDT, data: transfer, depth: 1 },
          },
        ]}
      />,
    );
    expect(screen.getByText('Send')).toBeTruthy();
    expect(screen.getByText('Amount: 1.5 USDT')).toBeTruthy();
    expect(screen.queryByTestId('descriptor-source')).toBeNull();
  });

  it('draws nothing for an inner call while its saved slice is read', async () => {
    setSavedIndex({ generatedAt: '2026-10-12T00:00:00.000Z' });
    try {
      const view = render(
        <DisplayNodes
          nodes={[
            {
              kind: 'call',
              request: { chainId: 1, contract: USDT, data: transfer, depth: 1 },
            },
          ]}
        />,
      );
      expect(view.toJSON()).toBeNull();
      // No slice file here, so no entry: the app's own section follows.
      await act(async () => {});
      expect(screen.getByText('ERC-20 Transfer')).toBeTruthy();
    } finally {
      act(() => setSavedIndex(null));
    }
  });
});
