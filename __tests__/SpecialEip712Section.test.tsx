import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import SpecialEip712Section from '../src/components/SignRequestDetail/eth/DataTabPanel/SpecialEip712Section';
import { CUSTOM_TOKEN_CAPTION } from '../src/constants/customTokens';
import { MISCASED_ADDRESS_WARNING } from '../src/constants/eip712';
import type { Eip712SpecialReview } from '../src/utils/eip712';

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

jest.mock(
  '../src/components/SignRequestDetail/eth/DataTabPanel/DecodedCallSection',
  () => {
    const { Text } = require('react-native');
    return ({ chainId }: { chainId: number | undefined }) => (
      <Text>{`DecodedCallSection chainId=${chainId}`}</Text>
    );
  },
);

const mockLookupToken = jest.fn((..._args: unknown[]): unknown => null);

jest.mock('../src/utils/tokenMetadata', () => ({
  lookupToken: (...args: unknown[]) => mockLookupToken(...args),
  formatTokenAmount: (amount: bigint, token: { symbol: string }) =>
    `${amount} ${token.symbol}`,
  bundledSymbolOnChain: () => false,
}));

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

const mockNavigate = jest.fn();

jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => true,
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
}));

beforeEach(() => {
  mockLookupToken.mockReset().mockReturnValue(null);
  mockNavigate.mockReset();
});

const SPENDER = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const TOKEN = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const SAFE = '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const GAS_TOKEN = '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
const REFUND = '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';

describe('SpecialEip712Section — permit', () => {
  const permit: Eip712SpecialReview = {
    kind: 'permit',
    tokenContract: TOKEN,
    spender: SPENDER,
    amount: 1000n,
    unlimited: false,
    miscased: [],
  };

  it('offers to add a permit token nothing knows, on the chain of the message', () => {
    render(<SpecialEip712Section special={permit} fallbackChainId={1} />);
    fireEvent.press(screen.getByText('Add token'));
    expect(mockNavigate).toHaveBeenCalledWith('CustomToken', {
      mode: 'add',
      chainId: 1,
      address: TOKEN,
    });
  });

  it('captions the allowance of a custom token and offers nothing', () => {
    mockLookupToken.mockReturnValue({
      symbol: 'FOO',
      decimals: 0,
      custom: true,
    });
    render(<SpecialEip712Section special={permit} fallbackChainId={1} />);
    expect(screen.getByText('Allowance: 1000 FOO')).toBeTruthy();
    expect(screen.getByText(CUSTOM_TOKEN_CAPTION)).toBeTruthy();
    expect(screen.queryByText('Add token')).toBeNull();
  });

  it('shows spender, allowance, and deadline', () => {
    const special: Eip712SpecialReview = {
      kind: 'permit',
      spender: SPENDER,
      amount: 1000n,
      deadline: '2024-12-31',
      unlimited: false,
      miscased: [],
    };
    render(<SpecialEip712Section special={special} fallbackChainId={1} />);
    expect(screen.getByText('EIP-712 Permit')).toBeTruthy();
    expect(screen.getByText(`Spender: ${SPENDER}`)).toBeTruthy();
    expect(screen.getByText('Allowance: 1000')).toBeTruthy();
    expect(screen.getByText('Deadline: 2024-12-31')).toBeTruthy();
    expect(screen.queryByText(/Unlimited permit/)).toBeNull();
  });

  it('shows token contract when provided', () => {
    const special: Eip712SpecialReview = {
      kind: 'permit',
      tokenContract: TOKEN,
      spender: SPENDER,
      amount: 500n,
      unlimited: false,
      miscased: [],
    };
    render(<SpecialEip712Section special={special} fallbackChainId={1} />);
    expect(screen.getByText(`Token contract: ${TOKEN}`)).toBeTruthy();
  });

  it('shows unlimited warning for max allowance', () => {
    const special: Eip712SpecialReview = {
      kind: 'permit',
      spender: SPENDER,
      amount: 2n ** 256n - 1n,
      unlimited: true,
      miscased: [],
    };
    render(<SpecialEip712Section special={special} fallbackChainId={1} />);
    expect(screen.getByText('Allowance: Unlimited')).toBeTruthy();
    expect(screen.getByText(/Unlimited permit/)).toBeTruthy();
  });
});

describe('SpecialEip712Section — permit-single', () => {
  it('shows expiration when present', () => {
    const special: Eip712SpecialReview = {
      kind: 'permit-single',
      tokenContract: TOKEN,
      spender: SPENDER,
      amount: 1000n,
      expiration: '2025-06-01',
      unlimited: false,
      miscased: [],
    };
    render(<SpecialEip712Section special={special} fallbackChainId={1} />);
    expect(screen.getByText('Expiration: 2025-06-01')).toBeTruthy();
  });

  it('omits expiration when not present', () => {
    const special: Eip712SpecialReview = {
      kind: 'permit-single',
      tokenContract: TOKEN,
      spender: SPENDER,
      amount: 1000n,
      unlimited: false,
      miscased: [],
    };
    render(<SpecialEip712Section special={special} fallbackChainId={1} />);
    expect(screen.queryByText(/Expiration/)).toBeNull();
  });
});

describe('SpecialEip712Section — safe-tx', () => {
  const base = {
    kind: 'safe-tx' as const,
    to: SPENDER,
    value: '0',
    operation: 'Call',
    safeTxGas: '0',
    baseGas: '0',
    gasPrice: '0',
    gasToken: GAS_TOKEN,
    refundReceiver: REFUND,
    nonce: '1',
    miscased: [],
  };

  it('shows safe transaction fields', () => {
    render(<SpecialEip712Section special={base} fallbackChainId={1} />);
    expect(screen.getByText('Safe Transaction')).toBeTruthy();
    expect(screen.getByText(`To: ${SPENDER}`)).toBeTruthy();
    expect(screen.getByText('Nonce: 1')).toBeTruthy();
    expect(screen.getByText(`Gas token: ${GAS_TOKEN}`)).toBeTruthy();
  });

  it('shows safe address when provided', () => {
    const special: Eip712SpecialReview = { ...base, safeAddress: SAFE };
    render(<SpecialEip712Section special={special} fallbackChainId={1} />);
    expect(screen.getByText(`Safe: ${SAFE}`)).toBeTruthy();
  });

  it('renders DecodedCallSection with fallbackChainId when decodedCall is present', () => {
    const special: Eip712SpecialReview = {
      ...base,
      decodedCall: {
        kind: 'erc20-transfer',
        to: SPENDER,
        amount: 100n,
      },
    };
    render(<SpecialEip712Section special={special} fallbackChainId={1} />);
    expect(screen.getByText('DecodedCallSection chainId=1')).toBeTruthy();
  });

  it('shows raw data when no decodedCall', () => {
    const special: Eip712SpecialReview = {
      ...base,
      data: '0xdeadbeef',
    };
    render(<SpecialEip712Section special={special} fallbackChainId={1} />);
    expect(screen.getByText('Data: 0xdeadbeef')).toBeTruthy();
  });

  it('uses special.chainId when fallbackChainId is undefined', () => {
    const special: Eip712SpecialReview = {
      ...base,
      chainId: 137,
      decodedCall: { kind: 'erc20-transfer', to: SPENDER, amount: 100n },
    };
    render(
      <SpecialEip712Section special={special} fallbackChainId={undefined} />,
    );
    expect(screen.getByText('DecodedCallSection chainId=137')).toBeTruthy();
  });

  it('prefers special.chainId over fallbackChainId when both present', () => {
    const special: Eip712SpecialReview = {
      ...base,
      chainId: 137,
      decodedCall: { kind: 'erc20-transfer', to: SPENDER, amount: 100n },
    };
    render(<SpecialEip712Section special={special} fallbackChainId={1} />);
    expect(screen.getByText('DecodedCallSection chainId=137')).toBeTruthy();
  });
});

describe('SpecialEip712Section: mis-cased addresses', () => {
  const texts = () =>
    screen
      .getAllByText(/./)
      .map(node => node.props.children)
      .filter((child): child is string => typeof child === 'string');

  it('warns under each Permit row the review names', () => {
    render(
      <SpecialEip712Section
        special={{
          kind: 'permit-single',
          tokenContract: TOKEN,
          spender: SPENDER,
          amount: 1n,
          unlimited: false,
          miscased: ['spender'],
        }}
        fallbackChainId={1}
      />,
    );
    const shown = texts();
    expect(shown.filter(t => t === MISCASED_ADDRESS_WARNING)).toHaveLength(1);
    expect(shown[shown.indexOf(`Spender: ${SPENDER}`) + 1]).toBe(
      MISCASED_ADDRESS_WARNING,
    );
  });

  it('warns under each SafeTx row the review names', () => {
    render(
      <SpecialEip712Section
        special={{
          kind: 'safe-tx',
          safeAddress: SAFE,
          to: SPENDER,
          value: '0',
          operation: 'Call',
          safeTxGas: '0',
          baseGas: '0',
          gasPrice: '0',
          gasToken: GAS_TOKEN,
          refundReceiver: REFUND,
          nonce: '1',
          miscased: ['safeAddress', 'to', 'gasToken', 'refundReceiver'],
        }}
        fallbackChainId={1}
      />,
    );
    const shown = texts();
    for (const row of [
      `Safe: ${SAFE}`,
      `To: ${SPENDER}`,
      `Gas token: ${GAS_TOKEN}`,
      `Refund receiver: ${REFUND}`,
    ]) {
      expect(shown[shown.indexOf(row) + 1]).toBe(MISCASED_ADDRESS_WARNING);
    }
  });

  it('shows no warning when the review names none', () => {
    render(
      <SpecialEip712Section
        special={{
          kind: 'permit',
          spender: SPENDER,
          amount: 1n,
          unlimited: false,
          miscased: [],
        }}
        fallbackChainId={1}
      />,
    );
    expect(screen.queryByText(MISCASED_ADDRESS_WARNING)).toBeNull();
  });
});
