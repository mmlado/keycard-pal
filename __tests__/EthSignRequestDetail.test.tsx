import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RLP } from '@ethereumjs/rlp';

import EthSignRequestDetail from '../src/components/SignRequestDetail/eth/SignRequestDetail';
import type { EthSignRequest } from '../src/types';

jest.mock('react-native-paper', () => {
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    MD3DarkTheme: { colors: {} },
    Text,
    Icon: () => null,
    SegmentedButtons: ({
      buttons,
      onValueChange,
    }: {
      value: string;
      onValueChange: (v: string) => void;
      buttons: { value: string; label: string }[];
    }) => (
      <View>
        {buttons.map(b => (
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

const mockEnsNames: Record<string, string> = {};
jest.mock('../src/components/ens/AddressInfoRow.online', () => ({
  __esModule: true,
  default: ({ label, value }: { label: string; value: string }) => {
    const { Text, View } = require('react-native');
    const ensName = mockEnsNames[value];
    return (
      <View>
        <Text>{label}</Text>
        {ensName && <Text>{ensName}</Text>}
        <Text>{value}</Text>
      </View>
    );
  },
}));

jest.mock('../src/hooks/useTokenImagesEnabled.online', () => ({
  __esModule: true,
  default: () => false,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bn(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array(0);
  const hex = n.toString(16);
  return Buffer.from(hex.length % 2 === 0 ? hex : '0' + hex, 'hex');
}

function addr(hex: string): Uint8Array {
  return Buffer.from(hex.replace('0x', ''), 'hex');
}

/** Legacy unsigned tx: RLP([nonce, gasPrice, gasLimit, to, value, data]) */
function legacyTxHex(value: bigint = 1_000_000_000_000_000_000n): string {
  return Buffer.from(
    RLP.encode([
      bn(1n),
      bn(20_000_000_000n),
      bn(21000n),
      addr('0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef'),
      bn(value),
      new Uint8Array(0),
    ]),
  ).toString('hex');
}

/** EIP-1559 tx: 0x02 || RLP([chainId, nonce, maxPFG, maxFG, gasLimit, to, value, data, []]) */
function eip1559TxHex(
  chainId: bigint,
  value: bigint = 50_000_000_000_000_000n,
): string {
  const rlp = Buffer.from(
    RLP.encode([
      bn(chainId),
      bn(1n),
      bn(1_000_000_000n),
      bn(10_000_000_000n),
      bn(21000n),
      addr('0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef'),
      bn(value),
      new Uint8Array(0),
      [],
    ]),
  );
  return Buffer.concat([Buffer.from([0x02]), rlp]).toString('hex');
}

/** EIP-2930 tx: 0x01 || RLP([chainId, nonce, gasPrice, gasLimit, to, value, data, []]) */
function eip2930TxHex(value: bigint = 500_000_000_000_000_000n): string {
  const rlp = Buffer.from(
    RLP.encode([
      bn(1n),
      bn(2n),
      bn(15_000_000_000n),
      bn(30000n),
      addr('0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef'),
      bn(value),
      new Uint8Array(0),
      [],
    ]),
  );
  return Buffer.concat([Buffer.from([0x01]), rlp]).toString('hex');
}

function renderDetail(request: EthSignRequest) {
  return render(<EthSignRequestDetail request={request} />);
}

function typedDataHex(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('hex');
}

// ---------------------------------------------------------------------------
// Chain name display
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — chain name', () => {
  it('shows chain name for BNB Smart Chain (56)', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 56,
    });
    expect(screen.getByText('BNB Smart Chain Mainnet')).toBeTruthy();
  });

  it('shows chain name for Polygon (137)', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 137,
    });
    expect(screen.getByText('Polygon Mainnet')).toBeTruthy();
  });

  it('shows chain name for Base (8453)', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 8453,
    });
    expect(screen.getByText('Base')).toBeTruthy();
  });

  it('falls back to "Chain N" for unknown chain', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 0xdeadbeef,
    });
    expect(screen.getByText('Chain 3735928559')).toBeTruthy();
  });

  it('omits chain row when chainId is undefined', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
    });
    expect(screen.queryByText('Chain')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Native currency symbol in amount
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — native currency symbol', () => {
  it('shows ETH symbol for Ethereum Mainnet (chainId=1)', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    expect(screen.getByText(/ETH/)).toBeTruthy();
  });

  it('shows BNB symbol for BNB Smart Chain (chainId=56)', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 56,
    });
    // "1 BNB" is the formatted native amount; distinct from the chain name "BNB Smart Chain Mainnet"
    expect(screen.getByText('1 BNB')).toBeTruthy();
  });

  it('shows POL symbol for Polygon Mainnet (chainId=137)', () => {
    renderDetail({
      signData: eip1559TxHex(137n),
      dataType: 4,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 137,
    });
    expect(screen.getByText(/POL/)).toBeTruthy();
  });

  it('shows correct symbol for EIP-2930 tx on chainId=1', () => {
    renderDetail({
      signData: eip2930TxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    expect(screen.getByText(/ETH/)).toBeTruthy();
  });

  it('defaults to ETH symbol when chainId is undefined', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
    });
    expect(screen.getByText(/ETH/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Transaction type labels
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — transaction type labels', () => {
  it('shows "EIP-1559 Transaction" label for dataType=4', () => {
    renderDetail({
      signData: eip1559TxHex(1n),
      dataType: 4,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    expect(screen.getByText('EIP-1559 Transaction')).toBeTruthy();
  });

  it('shows "EIP-2930 Transaction" label for 0x01-prefixed dataType=1', () => {
    renderDetail({
      signData: eip2930TxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    expect(screen.getByText('EIP-2930 Transaction')).toBeTruthy();
  });

  it('shows max fee and priority fee for EIP-1559 tx', () => {
    renderDetail({
      signData: eip1559TxHex(1n),
      dataType: 4,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    expect(screen.getByText('Max fee')).toBeTruthy();
    expect(screen.getByText('Priority fee')).toBeTruthy();
  });
});

describe('EthSignRequestDetail — EIP-55 address display', () => {
  it('checksums signer and transaction recipient addresses before display', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
    });

    expect(
      screen.getByText('0xabCDEF1234567890ABcDEF1234567890aBCDeF12'),
    ).toBeTruthy();
    expect(
      screen.getByText('0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef'),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ENS address rows
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — ENS address display', () => {
  beforeEach(() => {
    Object.keys(mockEnsNames).forEach(k => delete mockEnsNames[k]);
  });

  it('shows ENS name and raw address for resolved recipient', () => {
    mockEnsNames['0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef'] =
      'recipient.eth';
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
      address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    });

    expect(screen.getByText('recipient.eth')).toBeTruthy();
    expect(
      screen.getByText('0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef'),
    ).toBeTruthy();
  });

  it('shows raw address only when ENS not resolved', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
      address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    });

    expect(screen.queryByText('recipient.eth')).toBeNull();
    expect(
      screen.getByText('0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef'),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Zero value + decoded ERC-20 call hides native amount row
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — amount row visibility', () => {
  // ERC-20 transfer calldata for transfer(address, uint256)
  const ERC20_TRANSFER =
    'a9059cbb' +
    '000000000000000000000000d3cda913deb6f4967b2ef3aa68f5a843da74c4ef' +
    '0000000000000000000000000000000000000000000000000de0b6b3a7640000';

  function erc20TxHex(): string {
    const data = Buffer.from(ERC20_TRANSFER, 'hex');
    return Buffer.from(
      RLP.encode([
        bn(1n),
        bn(20_000_000_000n),
        bn(60000n),
        addr('0xdac17f958d2ee523a2206206994597c13d831ec7'),
        bn(0n), // zero ETH value
        data,
      ]),
    ).toString('hex');
  }

  it('hides native amount when value is zero and decoded ERC-20 call present', () => {
    renderDetail({
      signData: erc20TxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    // DecodedCallSection renders, native amount row does not
    expect(screen.getByText('ERC-20 Transfer')).toBeTruthy();
    // No formatted native value (e.g. "1 ETH") — zero-value native row is suppressed
    expect(screen.queryByText(/\d.*ETH/)).toBeNull();
  });

  it('shows native amount when value is non-zero even with decoded call', () => {
    // 0.001 ETH + ERC-20 calldata (unusual but valid)
    const data = Buffer.from(ERC20_TRANSFER, 'hex');
    const txHex = Buffer.from(
      RLP.encode([
        bn(1n),
        bn(20_000_000_000n),
        bn(60000n),
        addr('0xdac17f958d2ee523a2206206994597c13d831ec7'),
        bn(1_000_000_000_000_000n), // 0.001 ETH
        data,
      ]),
    ).toString('hex');
    renderDetail({
      signData: txHex,
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    expect(screen.getByText('0.001 ETH')).toBeTruthy();
  });
});

describe('EthSignRequestDetail — EIP-712 special renderers', () => {
  it('shows message fields for generic EIP-712 typed data', () => {
    renderDetail({
      signData: typedDataHex({
        types: {
          EIP712Domain: [{ name: 'name', type: 'string' }],
          Message: [{ name: 'contents', type: 'string' }],
        },
        primaryType: 'Message',
        domain: { name: 'Example Dapp' },
        message: {
          contents: 'Approve login',
          approved: true,
        },
      }),
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });

    expect(screen.getByText('Message Fields')).toBeTruthy();
    expect(screen.getByText('contents')).toBeTruthy();
    expect(screen.getByText('Approve login')).toBeTruthy();
    expect(screen.getByText('approved')).toBeTruthy();
    expect(screen.getByText('true')).toBeTruthy();
  });

  it('shows Permit allowance, spender, and deadline with token formatting', () => {
    renderDetail({
      signData: typedDataHex({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 1,
          verifyingContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        },
        message: {
          owner: '0x2222222222222222222222222222222222222222',
          spender: '0x1111111111111111111111111111111111111111',
          value: '1000000',
          nonce: '7',
          deadline: '1712345678',
        },
      }),
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });

    expect(screen.getByText('EIP-712 Permit')).toBeTruthy();
    expect(
      screen.getByText('0x1111111111111111111111111111111111111111'),
    ).toBeTruthy();
    expect(
      screen.getByText('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
    ).toBeTruthy();
    expect(screen.getByText('1 USDC')).toBeTruthy();
    expect(screen.getByText('1712345678')).toBeTruthy();
    expect(screen.queryByText('Message Fields')).toBeNull();
  });

  it('flags unlimited PermitSingle approvals', () => {
    renderDetail({
      signData: typedDataHex({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          PermitSingle: [
            { name: 'details', type: 'PermitDetails' },
            { name: 'spender', type: 'address' },
            { name: 'sigDeadline', type: 'uint256' },
          ],
          PermitDetails: [
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint160' },
            { name: 'expiration', type: 'uint48' },
            { name: 'nonce', type: 'uint48' },
          ],
        },
        primaryType: 'PermitSingle',
        domain: {
          name: 'Permit2',
          chainId: 1,
          verifyingContract: '0x000000000022d473030f116ddee9f6b43ac78ba3',
        },
        message: {
          details: {
            token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            amount: (2n ** 160n - 1n).toString(),
            expiration: '1712345000',
            nonce: '1',
          },
          spender: '0x1111111111111111111111111111111111111111',
          sigDeadline: '1712345678',
        },
      }),
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });

    expect(screen.getByText('Unlimited USDC')).toBeTruthy();
    expect(screen.getByText(/Unlimited permit/)).toBeTruthy();
  });

  it('decodes SafeTx inner calldata through the selector database', () => {
    renderDetail({
      signData: typedDataHex({
        types: {
          EIP712Domain: [
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          SafeTx: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
            { name: 'operation', type: 'uint8' },
            { name: 'safeTxGas', type: 'uint256' },
            { name: 'baseGas', type: 'uint256' },
            { name: 'gasPrice', type: 'uint256' },
            { name: 'gasToken', type: 'address' },
            { name: 'refundReceiver', type: 'address' },
            { name: 'nonce', type: 'uint256' },
          ],
        },
        primaryType: 'SafeTx',
        domain: {
          chainId: 1,
          verifyingContract: '0x3333333333333333333333333333333333333333',
        },
        message: {
          to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          value: '0',
          data: '0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa9604500000000000000000000000000000000000000000000000000000000000f4240',
          operation: 0,
          safeTxGas: '100000',
          baseGas: '21000',
          gasPrice: '0',
          gasToken: '0x0000000000000000000000000000000000000000',
          refundReceiver: '0x0000000000000000000000000000000000000000',
          nonce: '12',
        },
      }),
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });

    expect(screen.getByText('Safe Transaction')).toBeTruthy();
    expect(screen.getByText('ERC-20 Transfer')).toBeTruthy();
    expect(screen.getByText('1 USDC')).toBeTruthy();
    expect(screen.queryByText(/a9059cbb/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// request.address, requestId, origin fields
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — optional fields', () => {
  it('shows derivation path row when request.address is set', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0/0",
      address: '0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef',
    });
    expect(screen.getByText("m/44'/60'/0'/0/0")).toBeTruthy();
    expect(screen.getByText('Path')).toBeTruthy();
  });

  it('shows request ID row when requestId is present', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      requestId: 'req-abc-123',
    });
    expect(screen.getByText('req-abc-123')).toBeTruthy();
  });

  it('shows origin row when origin is present', () => {
    renderDetail({
      signData: legacyTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      origin: 'app.uniswap.org',
    });
    expect(screen.getByText('app.uniswap.org')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Pre-hashed EIP-712 (DataTabPanel eip712Prehashed branch)
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — pre-hashed EIP-712', () => {
  it('shows domain separator and message hash for a 0x1901 payload', () => {
    const domainHash =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const messageHash =
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    renderDetail({
      signData: '1901' + domainHash + messageHash,
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
    });
    expect(screen.getByText(/Domain separator/)).toBeTruthy();
    expect(screen.getByText(/Message hash/)).toBeTruthy();
  });
});
