import { render, screen } from '@testing-library/react-native';
import React from 'react';

import DecodedCallSection from '../src/components/SignRequestDetail/eth/DataTabPanel/DecodedCallSection';

import type { DecodedCall } from '../src/utils/txParser';

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

jest.mock('../src/data/token-logos-index.json', () => ({
  '1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'png',
}));

const ADDR_A = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ADDR_B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const UINT256_MAX = 2n ** 256n - 1n;

// Real addresses from the bundled token list
const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';
const MAINNET = 1;

describe('DecodedCallSection', () => {
  describe('erc20-transfer', () => {
    const call: DecodedCall = {
      kind: 'erc20-transfer',
      to: ADDR_A,
      amount: 1000n,
    };

    it('shows ERC-20 Transfer heading and recipient', () => {
      render(<DecodedCallSection call={call} />);
      expect(screen.getByText('ERC-20 Transfer')).toBeTruthy();
      expect(screen.getByText(`Recipient: ${ADDR_A}`)).toBeTruthy();
      expect(screen.getByText('Amount (raw units): 1000')).toBeTruthy();
    });

    it('shows token contract row when provided', () => {
      render(<DecodedCallSection call={call} tokenContract={ADDR_B} />);
      expect(screen.getByText(`Token contract: ${ADDR_B}`)).toBeTruthy();
    });

    it('omits token contract row when not provided', () => {
      render(<DecodedCallSection call={call} />);
      expect(screen.queryByText(/Token contract/)).toBeNull();
    });
  });

  describe('erc20-transferFrom', () => {
    const call: DecodedCall = {
      kind: 'erc20-transferFrom',
      from: ADDR_A,
      to: ADDR_B,
      amount: 500n,
    };

    it('shows ERC-20 Transfer From heading, from, and recipient', () => {
      render(<DecodedCallSection call={call} />);
      expect(screen.getByText('ERC-20 Transfer From')).toBeTruthy();
      expect(screen.getByText(`From: ${ADDR_A}`)).toBeTruthy();
      expect(screen.getByText(`Recipient: ${ADDR_B}`)).toBeTruthy();
      expect(screen.getByText('Amount (raw units): 500')).toBeTruthy();
    });

    it('shows token contract row when provided', () => {
      render(<DecodedCallSection call={call} tokenContract={ADDR_A} />);
      expect(screen.getByText(`Token contract: ${ADDR_A}`)).toBeTruthy();
    });
  });

  describe('erc20-approve', () => {
    it('shows limited approval without warning', () => {
      const call: DecodedCall = {
        kind: 'erc20-approve',
        spender: ADDR_A,
        amount: 100n,
      };
      render(<DecodedCallSection call={call} />);
      expect(screen.getByText('ERC-20 Approve')).toBeTruthy();
      expect(screen.getByText(`Spender: ${ADDR_A}`)).toBeTruthy();
      expect(screen.getByText('Allowance: 100')).toBeTruthy();
      expect(screen.queryByText(/Unlimited approval/)).toBeNull();
    });

    it('shows "Unlimited" and warning for max uint256', () => {
      const call: DecodedCall = {
        kind: 'erc20-approve',
        spender: ADDR_A,
        amount: UINT256_MAX,
      };
      render(<DecodedCallSection call={call} />);
      expect(screen.getByText('Allowance: Unlimited')).toBeTruthy();
      expect(screen.getByText(/Unlimited approval/)).toBeTruthy();
    });

    it('shows token contract row when provided', () => {
      const call: DecodedCall = {
        kind: 'erc20-approve',
        spender: ADDR_A,
        amount: 1n,
      };
      render(<DecodedCallSection call={call} tokenContract={ADDR_B} />);
      expect(screen.getByText(`Token contract: ${ADDR_B}`)).toBeTruthy();
    });
  });

  describe('unknown-call', () => {
    it('shows raw selector', () => {
      const call: DecodedCall = {
        kind: 'unknown-call',
        selector: '0xdeadbeef',
      };
      render(<DecodedCallSection call={call} />);
      expect(screen.getByText('Contract call: 0xdeadbeef')).toBeTruthy();
    });
  });

  describe('contract-call', () => {
    it('shows function signature and decoded args', () => {
      const call: DecodedCall = {
        kind: 'contract-call',
        selector: '0xd0e30db0',
        functionName: 'deposit',
        signature: 'deposit()',
        args: [],
      };
      render(<DecodedCallSection call={call} />);
      expect(screen.getByText('Contract Call')).toBeTruthy();
      expect(screen.getByText('Function: deposit()')).toBeTruthy();
    });

    it('shows a high-risk warning when present', () => {
      const call: DecodedCall = {
        kind: 'contract-call',
        selector: '0xa22cb465',
        functionName: 'setApprovalForAll',
        signature: 'setApprovalForAll(address,bool)',
        args: [
          { name: 'operator', type: 'address', value: ADDR_A },
          { name: 'approved', type: 'bool', value: 'true' },
        ],
        highRisk: true,
        risk: 'Operator can move all NFTs from this collection',
      };
      render(<DecodedCallSection call={call} />);
      expect(screen.getByText(`operator (address): ${ADDR_A}`)).toBeTruthy();
      expect(screen.getByText('approved (bool): true')).toBeTruthy();
      expect(screen.getByText(/High-risk approval/)).toBeTruthy();
    });

    it('shows fallback warning text for high-risk calls without a risk message', () => {
      const call: DecodedCall = {
        kind: 'contract-call',
        selector: '0xa22cb465',
        functionName: 'setApprovalForAll',
        signature: 'setApprovalForAll(address,bool)',
        args: [],
        highRisk: true,
      };
      render(<DecodedCallSection call={call} />);
      expect(
        screen.getByText(
          /High-risk approval: review this contract permission carefully/,
        ),
      ).toBeTruthy();
    });
  });

  describe('universal-router-execute', () => {
    it('lists Universal Router subcommands with decoded parameters', () => {
      const call: DecodedCall = {
        kind: 'universal-router-execute',
        deadline: '1712345678',
        commands: [
          {
            index: 0,
            command: '0x08',
            name: 'V2 Swap Exact In',
            allowRevert: false,
            args: [
              { name: 'recipient', type: 'address', value: ADDR_A },
              { name: 'amountIn', type: 'uint256', value: '1000000' },
            ],
          },
          {
            index: 1,
            command: '0x05',
            name: 'Transfer',
            allowRevert: true,
            args: [{ name: 'value', type: 'uint256', value: '500' }],
          },
        ],
      };
      render(<DecodedCallSection call={call} />);

      expect(screen.getByText('Uniswap Universal Router')).toBeTruthy();
      expect(screen.getByText('Deadline: 1712345678')).toBeTruthy();
      expect(screen.getByText('Command 1: V2 Swap Exact In')).toBeTruthy();
      expect(screen.getByText(`recipient (address): ${ADDR_A}`)).toBeTruthy();
      expect(screen.getByText('amountIn (uint256): 1000000')).toBeTruthy();
      expect(
        screen.getByText('Command 2: Transfer (allow revert)'),
      ).toBeTruthy();
      expect(screen.getByText('value (uint256): 500')).toBeTruthy();
    });

    it('shows Universal Router decode errors without dropping raw input', () => {
      const call: DecodedCall = {
        kind: 'universal-router-execute',
        commands: [
          {
            index: 0,
            command: '0x08',
            name: 'V2 Swap Exact In',
            allowRevert: false,
            args: [],
            error: 'Could not decode command input',
            rawInput: '0xdeadbeef',
          },
        ],
      };
      render(<DecodedCallSection call={call} />);

      expect(
        screen.getByText('Decode: Could not decode command input'),
      ).toBeTruthy();
      expect(screen.getByText('Input: 0xdeadbeef')).toBeTruthy();
    });

    it('shows top-level router error', () => {
      const call: DecodedCall = {
        kind: 'universal-router-execute',
        error: 'Failed to decode commands',
        commands: [],
      };
      render(<DecodedCallSection call={call} />);
      expect(screen.getByText('Failed to decode commands')).toBeTruthy();
    });
  });

  describe('with token metadata (chainId + known contract)', () => {
    it('shows symbol and formatted amount for a known ERC-20 transfer', () => {
      const call: DecodedCall = {
        kind: 'erc20-transfer',
        to: ADDR_A,
        amount: 1_000_000n, // 1.00 USDC
      };
      render(
        <DecodedCallSection
          call={call}
          tokenContract={USDC_ADDRESS}
          chainId={MAINNET}
        />,
      );
      expect(screen.getByText('USDC')).toBeTruthy();
      expect(screen.getByText('Amount: 1 USDC')).toBeTruthy();
    });

    it('renders bundled token logos when INTERNET is disabled', () => {
      const call: DecodedCall = {
        kind: 'erc20-transfer',
        to: ADDR_A,
        amount: 1_000_000n,
      };
      render(
        <DecodedCallSection
          call={call}
          tokenContract={USDC_ADDRESS}
          chainId={MAINNET}
        />,
      );
      expect(screen.getByTestId('token-logo').props.source).toEqual({
        uri: `asset:/token-logos/${MAINNET}-${USDC_ADDRESS}.png`,
      });
    });

    it('omits remote token logos when INTERNET is disabled', () => {
      const call: DecodedCall = {
        kind: 'erc20-transfer',
        to: ADDR_A,
        amount: 1_000_000_000_000_000_000n,
      };
      render(
        <DecodedCallSection
          call={call}
          tokenContract={DAI_ADDRESS}
          chainId={MAINNET}
        />,
      );
      expect(screen.queryByTestId('token-logo')).toBeNull();
    });

    it('shows symbol and formatted amount for a known ERC-20 approve', () => {
      const call: DecodedCall = {
        kind: 'erc20-approve',
        spender: ADDR_A,
        amount: 1_000_000n, // 1.00 USDC
      };
      render(
        <DecodedCallSection
          call={call}
          tokenContract={USDC_ADDRESS}
          chainId={MAINNET}
        />,
      );
      expect(screen.getByText('Allowance: 1 USDC')).toBeTruthy();
    });

    it('shows "Unlimited USDC" for max uint256 approve', () => {
      const call: DecodedCall = {
        kind: 'erc20-approve',
        spender: ADDR_A,
        amount: UINT256_MAX,
      };
      render(
        <DecodedCallSection
          call={call}
          tokenContract={USDC_ADDRESS}
          chainId={MAINNET}
        />,
      );
      expect(screen.getByText('Allowance: Unlimited USDC')).toBeTruthy();
    });

    it('shows symbol and formatted amount for a known ERC-20 transferFrom', () => {
      const call: DecodedCall = {
        kind: 'erc20-transferFrom',
        from: ADDR_A,
        to: ADDR_B,
        amount: 2_000_000n, // 2.00 USDC
      };
      render(
        <DecodedCallSection
          call={call}
          tokenContract={USDC_ADDRESS}
          chainId={MAINNET}
        />,
      );
      expect(screen.getByText('USDC')).toBeTruthy();
      expect(screen.getByText('Amount: 2 USDC')).toBeTruthy();
    });

    it('falls back to raw units when chainId is missing', () => {
      const call: DecodedCall = {
        kind: 'erc20-transfer',
        to: ADDR_A,
        amount: 1_000_000n,
      };
      render(<DecodedCallSection call={call} tokenContract={USDC_ADDRESS} />);
      expect(screen.getByText('Amount (raw units): 1000000')).toBeTruthy();
    });

    it('falls back to raw units for an unknown contract', () => {
      const call: DecodedCall = {
        kind: 'erc20-transfer',
        to: ADDR_A,
        amount: 999n,
      };
      render(
        <DecodedCallSection
          call={call}
          tokenContract={ADDR_B}
          chainId={MAINNET}
        />,
      );
      expect(screen.getByText('Amount (raw units): 999')).toBeTruthy();
    });
  });
});
