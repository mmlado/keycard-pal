import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { RLP } from '@ethereumjs/rlp';
import {
  encodeFunctionData,
  parseAbi,
  parseAbiItem,
  type AbiFunction,
} from 'viem';

import SimulationAddressProvider from '../src/components/SignRequestDetail/SimulationAddressProvider';
import EthSignRequestDetail from '../src/components/SignRequestDetail/eth/SignRequestDetail';
import { MISCASED_ADDRESS_WARNING } from '../src/constants/eip712';
import type { EthSignRequest } from '../src/types';
import { setSavedIndex } from '../src/utils/eip7730/lookup';
import { wcRequestToScanResult } from '../src/utils/walletConnect/requestAdapter';

import { PAYLOAD_REQUESTS } from './ethPayloads.testUtils';

const mockNavigation = {
  goBack: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useFocusEffect: jest.fn(),
}));

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

/** EIP-155 legacy unsigned tx: RLP([nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0]) */
function legacyTx(fields: Uint8Array[], chainId: bigint = 1n): string {
  return Buffer.from(
    RLP.encode([...fields, bn(chainId), new Uint8Array(0), new Uint8Array(0)]),
  ).toString('hex');
}

function legacyTxHex(
  value: bigint = 1_000_000_000_000_000_000n,
  chainId: bigint = 1n,
): string {
  return legacyTx(
    [
      bn(1n),
      bn(20_000_000_000n),
      bn(21000n),
      addr('0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef'),
      bn(value),
      new Uint8Array(0),
    ],
    chainId,
  );
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
  return render(
    <SimulationAddressProvider
      derivationPath={request.derivationPath}
      title="Review transaction"
    >
      <EthSignRequestDetail request={request} />
    </SimulationAddressProvider>,
  );
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
      signData: legacyTxHex(1_000_000_000_000_000_000n, BigInt(56)),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 56,
    });
    expect(screen.getByText('BNB Smart Chain Mainnet')).toBeTruthy();
  });

  it('shows chain name for Polygon (137)', () => {
    renderDetail({
      signData: legacyTxHex(1_000_000_000_000_000_000n, BigInt(137)),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 137,
    });
    expect(screen.getByText('Polygon Mainnet')).toBeTruthy();
  });

  it('shows chain name for Base (8453)', () => {
    renderDetail({
      signData: legacyTxHex(1_000_000_000_000_000_000n, BigInt(8453)),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 8453,
    });
    expect(screen.getByText('Base')).toBeTruthy();
  });

  it('falls back to "Chain N" for unknown chain', () => {
    renderDetail({
      signData: legacyTxHex(1_000_000_000_000_000_000n, BigInt(0xdeadbeef)),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 0xdeadbeef,
    });
    expect(screen.getByText('Chain 3735928559')).toBeTruthy();
  });

  it('omits chain row for a message when the request names no chain', () => {
    renderDetail({
      signData: Buffer.from('hello', 'utf8').toString('hex'),
      dataType: 3,
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
      signData: legacyTxHex(1_000_000_000_000_000_000n, 56n),
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

  it("takes the symbol from the transaction's own chain when the request names none", () => {
    renderDetail({
      signData: legacyTxHex(1_000_000_000_000_000_000n, 56n),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
    });
    expect(screen.getByText('1 BNB')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Transaction type labels
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — transaction type labels', () => {
  it.each([
    ['tx-legacy', 'Legacy Transaction'],
    ['tx-eip2930', 'EIP-2930 Transaction'],
    ['tx-eip1559', 'EIP-1559 Transaction'],
    ['personal-message', 'Personal Message'],
    ['eip712-json', 'Mail'],
    ['eip712-prehashed', 'EIP-712 Typed Data'],
    ['raw-digest', 'Hash'],
    ['invalid', 'Ethereum request'],
  ] as const)('labels a %s payload %s', (kind, label) => {
    renderDetail({
      ...PAYLOAD_REQUESTS[kind],
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    // An EIP-712 message also shows its primaryType below the chip.
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  // The classification refuses dataType 1 bytes that start 0x02, so no transaction type is named.
  it('names no transaction type for EIP-1559 bytes sent as dataType 1', () => {
    renderDetail({
      signData: PAYLOAD_REQUESTS['tx-eip1559'].signData,
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    expect(screen.getByText('Ethereum request')).toBeTruthy();
    expect(screen.queryByText('EIP-1559 Transaction')).toBeNull();
  });

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

describe('EthSignRequestDetail: EIP-712 addresses', () => {
  // EIP-55 test vectors, and one of them in mixed case that is not its EIP-55 form.
  const VERIFIER = '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb';
  const BOB = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
  const BOB_MISCASED = '0x5aaeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
  const CAROL = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';
  const NOTE = '0xfb6916095CA1df60bB79Ce92cE3Ea74c37c5d359';

  function mailRequest(to: string, verifyingContract: string): EthSignRequest {
    return {
      signData: typedDataHex({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Mail: [
            { name: 'to', type: 'address' },
            { name: 'from', type: 'address' },
            { name: 'note', type: 'string' },
          ],
        },
        primaryType: 'Mail',
        domain: { name: 'Mail', verifyingContract },
        message: { to, from: CAROL.toLowerCase(), note: NOTE },
      }),
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    };
  }

  it('signs a mis-cased address, shows it in EIP-55 and warns on its row', () => {
    renderDetail(mailRequest(BOB_MISCASED, VERIFIER.toLowerCase()));
    expect(screen.queryByText(/This request cannot be signed/)).toBeNull();
    expect(screen.getByText(BOB)).toBeTruthy();
    expect(screen.getAllByText(MISCASED_ADDRESS_WARNING)).toHaveLength(1);
  });

  it("warns on a mis-cased spender in the app's Permit review", () => {
    renderDetail({
      signData: typedDataHex({
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        domain: { name: 'Token', chainId: 1, verifyingContract: VERIFIER },
        message: {
          owner: CAROL,
          spender: BOB_MISCASED,
          value: '1',
          nonce: '0',
          deadline: '1',
        },
      }),
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    expect(screen.getByText('EIP-712 Permit')).toBeTruthy();
    expect(screen.queryByText(/This request cannot be signed/)).toBeNull();
    expect(screen.getByText(BOB)).toBeTruthy();
    expect(screen.getAllByText(MISCASED_ADDRESS_WARNING)).toHaveLength(1);
  });

  it('warns on mis-cased addresses in a registry descriptor view', () => {
    // The DeGate Withdrawal vector from the clear-signing registry (CC0).
    const degate = (cased: (address: string) => string) => ({
      signData: typedDataHex({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Withdrawal: [
            { name: 'owner', type: 'address' },
            { name: 'accountID', type: 'uint32' },
            { name: 'tokenID', type: 'uint32' },
            { name: 'amount', type: 'uint248' },
            { name: 'feeTokenID', type: 'uint32' },
            { name: 'maxFee', type: 'uint96' },
            { name: 'to', type: 'address' },
            { name: 'minGas', type: 'uint248' },
            { name: 'validUntil', type: 'uint32' },
            { name: 'storageID', type: 'uint32' },
          ],
        },
        primaryType: 'Withdrawal',
        domain: {
          name: 'DeGate Protocol',
          version: '0.1.0',
          chainId: 1,
          verifyingContract: cased(
            '0xe63602a9B3DFe983187525AC985Fec4F57B24eD5',
          ),
        },
        message: {
          owner: cased('0x36B2E1B2e6F6F2b82BaA2E4837F6b0dE58Ae9815'),
          accountID: 10425,
          tokenID: 0,
          amount: '1500000000000000000',
          feeTokenID: 2,
          maxFee: '3000000000000000',
          to: cased('0x36B2E1B2e6F6F2b82BaA2E4837F6b0dE58Ae9815'),
          minGas: '100000',
          validUntil: 1774000000,
          storageID: 58,
        },
      }),
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });

    const { unmount } = renderDetail(degate(address => address));
    expect(screen.getByText('DeGate Withdrawal')).toBeTruthy();
    expect(screen.queryByText('Message Fields')).toBeNull();
    // The domain's verifyingContract, Owner and To.
    expect(screen.getAllByText(MISCASED_ADDRESS_WARNING)).toHaveLength(3);
    unmount();

    renderDetail(degate(address => address.toLowerCase()));
    expect(screen.getByText('DeGate Withdrawal')).toBeTruthy();
    expect(screen.queryByText(MISCASED_ADDRESS_WARNING)).toBeNull();
  });

  it('warns on a mis-cased domain address too', () => {
    const verifier = VERIFIER.replace('D1220A', 'D1220a');
    renderDetail(mailRequest(BOB, verifier));
    expect(screen.getByText(VERIFIER)).toBeTruthy();
    expect(screen.getAllByText(MISCASED_ADDRESS_WARNING)).toHaveLength(1);
  });

  it('shows lowercase addresses in EIP-55 with no warning, and a string as written', () => {
    renderDetail(mailRequest(BOB.toLowerCase(), VERIFIER.toLowerCase()));
    expect(screen.getByText(VERIFIER)).toBeTruthy();
    expect(screen.getByText(BOB)).toBeTruthy();
    expect(screen.getByText(CAROL)).toBeTruthy();
    expect(screen.getByText(NOTE)).toBeTruthy();
    expect(screen.queryByText(MISCASED_ADDRESS_WARNING)).toBeNull();
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
    return legacyTx([
      bn(1n),
      bn(20_000_000_000n),
      bn(60000n),
      addr('0xdac17f958d2ee523a2206206994597c13d831ec7'),
      bn(0n), // zero ETH value
      data,
    ]);
  }

  it('hides native amount when value is zero and decoded ERC-20 call present', () => {
    renderDetail({
      signData: erc20TxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    // Decoded section renders (EIP-7730 descriptor wins over Erc20TransferSection when present)
    expect(screen.getByText(/Send|ERC-20 Transfer/)).toBeTruthy();
    // No formatted native value (e.g. "1 ETH") — zero-value native row is suppressed
    expect(screen.queryByText(/\d.*ETH/)).toBeNull();
  });

  it('shows native amount when value is non-zero even with decoded call', () => {
    // 0.001 ETH + ERC-20 calldata (unusual but valid)
    const data = Buffer.from(ERC20_TRANSFER, 'hex');
    const txHex = legacyTx([
      bn(1n),
      bn(20_000_000_000n),
      bn(60000n),
      addr('0xdac17f958d2ee523a2206206994597c13d831ec7'),
      bn(1_000_000_000_000_000n), // 0.001 ETH
      data,
    ]);
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

  // Descriptors bind USDC's Permit to "USD Coin" version 2 and Permit2 to "Permit2".
  function usdcPermit(version: string): EthSignRequest {
    return {
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
          version,
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
    };
  }

  function unlimitedPermitSingle(domainName: string): EthSignRequest {
    return {
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
          name: domainName,
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
    };
  }

  it("shows the app's Permit reviewer when no descriptor matches", () => {
    renderDetail(usdcPermit('1'));

    expect(screen.getByText('EIP-712 Permit')).toBeTruthy();
    expect(
      screen.getByText('0x1111111111111111111111111111111111111111'),
    ).toBeTruthy();
    // The domain's lowercase verifyingContract and the Permit's token, both in EIP-55.
    expect(
      screen.getAllByText('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
    ).toHaveLength(2);
    expect(screen.getByText('1 USDC')).toBeTruthy();
    expect(screen.getByText('1712345678')).toBeTruthy();
    expect(screen.queryByText('Message Fields')).toBeNull();
  });

  function usdcTransferAuthorization(): EthSignRequest {
    return {
      signData: typedDataHex({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
          ],
        },
        primaryType: 'TransferWithAuthorization',
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 1,
          verifyingContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        },
        message: {
          from: '0x2222222222222222222222222222222222222222',
          to: '0x1111111111111111111111111111111111111111',
          value: '1000000',
          validAfter: '0',
          validBefore: '1712345678',
          nonce: `0x${'ab'.repeat(32)}`,
        },
      }),
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    };
  }

  it("keeps the app's Permit reviewer over a registry descriptor nobody reviewed", () => {
    renderDetail(usdcPermit('2'));

    expect(screen.getByText('EIP-712 Permit')).toBeTruthy();
    expect(screen.getByText('1 USDC')).toBeTruthy();
    expect(screen.queryByText('Authorize spending of tokens')).toBeNull();
  });

  it('shows a reviewed registry descriptor and who reviewed it', () => {
    renderDetail(usdcTransferAuthorization());

    expect(screen.getByText('Authorize USDC transfer')).toBeTruthy();
    expect(screen.getByText('Reviewed by Cyfrin')).toBeTruthy();
    expect(screen.getByText('1 USDC')).toBeTruthy();
  });

  it('shows the registry descriptor for a WalletConnect request, which carries no chainId', () => {
    const signer = '0x2222222222222222222222222222222222222222';
    const scan = wcRequestToScanResult(
      {
        id: 1,
        topic: 'topic',
        method: 'eth_signTypedData_v4',
        params: [
          signer,
          Buffer.from(usdcTransferAuthorization().signData, 'hex').toString(
            'utf8',
          ),
        ],
      },
      new Map([[signer, "m/44'/60'/0'/0/0"]]),
    );
    if (scan.kind !== 'eth-sign-request') throw new Error(scan.kind);
    renderDetail(scan.request);

    expect(screen.getByText('Authorize USDC transfer')).toBeTruthy();
    expect(screen.getByText('1 USDC')).toBeTruthy();
  });

  it("flags an unlimited PermitSingle in the app's reviewer", () => {
    renderDetail(unlimitedPermitSingle('Not Permit2'));

    expect(screen.getByText('Unlimited USDC')).toBeTruthy();
    expect(screen.getByText(/Unlimited permit/)).toBeTruthy();
  });

  it("keeps the app's reviewer for Permit2, whose registry descriptor nobody reviewed", () => {
    renderDetail(unlimitedPermitSingle('Permit2'));

    expect(screen.getByText(/Unlimited permit/)).toBeTruthy();
    expect(screen.queryByText('Authorize spending of token')).toBeNull();
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

  it('refuses SafeTx data with an odd number of hex digits and shows it as written', () => {
    const data =
      '0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa9604500000000000000000000000000000000000000000000000000000000000f424';
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
          data,
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

    expect(
      screen.getByText(/This request cannot be signed. .*message\.data/),
    ).toBeTruthy();
    expect(screen.getByText('Safe Transaction')).toBeTruthy();
    expect(screen.queryByText('ERC-20 Transfer')).toBeNull();
    expect(screen.getByText(data)).toBeTruthy();
  });

  const NOTE_TYPES = {
    EIP712Domain: [{ name: 'name', type: 'string' }],
    Note: [{ name: 'text', type: 'string' }],
  };

  it('refuses typed data that names no primaryType and says why', () => {
    renderDetail({
      signData: typedDataHex({
        types: NOTE_TYPES,
        domain: { name: 'Notes' },
        message: { text: 'hello' },
      }),
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
    });

    expect(
      screen.getByText(
        'This request cannot be signed. EIP-712 typed data names no primaryType.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('shows a declared domain member named __proto__, which is signed', () => {
    renderDetail({
      signData: Buffer.from(
        '{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"__proto__","type":"string"}],"Note":[{"name":"text","type":"string"}]},"primaryType":"Note","domain":{"name":"Notes","__proto__":"hidden"},"message":{"text":"hello"}}',
        'utf8',
      ).toString('hex'),
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
    });

    expect(screen.queryByText(/This request cannot be signed/)).toBeNull();
    expect(screen.getByText('__proto__')).toBeTruthy();
    expect(screen.getByText('hidden')).toBeTruthy();
  });

  it('refuses a domain field the signature would not cover and names it', () => {
    renderDetail({
      signData: typedDataHex({
        types: NOTE_TYPES,
        primaryType: 'Note',
        domain: { name: 'Notes', chainId: 1 },
        message: { text: 'hello' },
      }),
      dataType: 2,
      derivationPath: "m/44'/60'/0'/0",
    });

    expect(
      screen.getByText(
        'This request cannot be signed. The EIP-712 domain has fields the signature would not cover: chainId.',
      ),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// request.address, requestId, origin fields
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — registry entries for calls the app cannot decode', () => {
  const ONEINCH_V4 = '0x1111111254fb6c44bac0bed2854e76f90643097d';
  const RECIPIENT = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';

  function swapTxHex(): string {
    const data = encodeFunctionData({
      abi: [
        parseAbiItem(
          'function clipperSwapTo(address recipient, address srcToken, address dstToken, uint256 amount, uint256 minReturn)',
        ) as AbiFunction,
      ],
      args: [
        RECIPIENT,
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        1_500_000n,
        1_400_000n,
      ],
    });
    return legacyTx([
      bn(1n),
      bn(20_000_000_000n),
      bn(200_000n),
      addr(ONEINCH_V4),
      bn(0n),
      Buffer.from(data.slice(2), 'hex'),
    ]);
  }

  it("shows the entry's sentence in place of its intent", () => {
    const UNIBTC = '0x004e9c3ef86bc1ca1f0bb5c7662861ee93350568';
    const data = encodeFunctionData({
      abi: [
        parseAbiItem(
          'function transfer(address to, uint256 amount)',
        ) as AbiFunction,
      ],
      args: [RECIPIENT, 150_000_000n],
    });
    renderDetail({
      signData: legacyTx([
        bn(1n),
        bn(20_000_000_000n),
        bn(100_000n),
        addr(UNIBTC),
        bn(0n),
        Buffer.from(data.slice(2), 'hex'),
      ]),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });

    expect(screen.getByText(`Send 1.5 uniBTC to ${RECIPIENT}`)).toBeTruthy();
    expect(screen.queryByText('Send')).toBeNull();
    expect(screen.getByText('Amount to Send')).toBeTruthy();
  });

  it('shows every call a multicall holds, each through its own entry', () => {
    const AAVE_V3_POOL = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
    const inner = (signature: string, args: unknown[]) =>
      encodeFunctionData({
        abi: [parseAbiItem(`function ${signature}`) as AbiFunction],
        args,
      });
    const data = encodeFunctionData({
      abi: [parseAbiItem('function multicall(bytes[] data)') as AbiFunction],
      args: [
        [
          inner('withdraw(address asset, uint256 amount, address to)', [
            '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            1_500_000n,
            RECIPIENT,
          ]),
          inner(
            'setUserUseReserveAsCollateral(address asset, bool useAsCollateral)',
            ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', false],
          ),
        ],
      ],
    });
    renderDetail({
      signData: legacyTx([
        bn(1n),
        bn(20_000_000_000n),
        bn(300_000n),
        addr(AAVE_V3_POOL),
        bn(0n),
        Buffer.from(data.slice(2), 'hex'),
      ]),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });

    expect(screen.getByText('Call 1 of 2')).toBeTruthy();
    expect(screen.getByText('Call 2 of 2')).toBeTruthy();
    expect(screen.getByText('Withdraw')).toBeTruthy();
    expect(screen.getByText('1.5 USDT')).toBeTruthy();
    expect(screen.getByText('Manage collateral')).toBeTruthy();
  });

  it("decodes the call by the entry's own signature and shows its fields", () => {
    renderDetail({
      signData: swapTxHex(),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });

    expect(screen.getByText('Decoded')).toBeTruthy();
    expect(screen.getByText('Swap')).toBeTruthy();
    expect(screen.getByText('1.5 USDC')).toBeTruthy();
    expect(screen.getByText('1.4 USDT')).toBeTruthy();
    expect(screen.getByText(RECIPIENT)).toBeTruthy();
  });
});

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

// ---------------------------------------------------------------------------
// personal_sign (dataType=3 → PersonalMessagePanel)
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — personal_sign', () => {
  const messageHex = Buffer.from('hello world', 'utf8').toString('hex');

  it('shows the decoded message instead of the raw hex', () => {
    renderDetail({
      signData: messageHex,
      dataType: 3,
      derivationPath: "m/44'/60'/0'/0",
    });
    expect(screen.getByText('Personal Message')).toBeTruthy();
    expect(screen.getByText('hello world')).toBeTruthy();
    expect(screen.queryByText(messageHex)).toBeNull();
  });

  it('shows the ERC-191 Digest on the Digests tab', () => {
    renderDetail({
      signData: messageHex,
      dataType: 3,
      derivationPath: "m/44'/60'/0'/0",
    });
    fireEvent.press(screen.getByText('Digests'));
    expect(screen.getByText('ERC-191 Digest')).toBeTruthy();
    expect(
      screen.getByText(
        '0xd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68',
      ),
    ).toBeTruthy();
  });

  it('shows the digest for a message that is not UTF-8', () => {
    renderDetail({
      signData: 'fffe80',
      dataType: 3,
      derivationPath: "m/44'/60'/0'/0",
    });
    expect(screen.getByText(/not UTF-8 text/)).toBeTruthy();
    fireEvent.press(screen.getByText('Digests'));
    expect(screen.getByText('ERC-191 Digest')).toBeTruthy();
    expect(screen.getByText(/^0x[0-9a-f]{64}$/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Invalid payload banner (classifyEthPayload → kind 'invalid')
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — the chain a transaction signs for', () => {
  it('refuses a transaction for another chain than the request names', () => {
    renderDetail({
      signData: eip1559TxHex(1n),
      dataType: 4,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 11155111,
    });
    expect(
      screen.getByText(
        /The transaction is for Ethereum Mainnet, but the request says Ethereum Sepolia\./,
      ),
    ).toBeTruthy();
    expect(screen.getByText('Ethereum Mainnet')).toBeTruthy();
    expect(screen.queryByText('Ethereum Sepolia')).toBeNull();
  });

  it("reviews a request that names no chain on the transaction's own", () => {
    renderDetail({
      signData: eip1559TxHex(137n),
      dataType: 4,
      derivationPath: "m/44'/60'/0'/0",
    });
    expect(screen.getByText('Polygon Mainnet')).toBeTruthy();
    expect(screen.queryByText(/This request cannot be signed/)).toBeNull();
  });
});

describe('EthSignRequestDetail — invalid payload banner', () => {
  it('shows the cannot-sign banner with the classification reason', () => {
    renderDetail({
      signData: 'ab'.repeat(31), // 31 bytes — not a valid 32-byte digest
      dataType: 0,
      derivationPath: "m/44'/60'/0'/0",
    });
    expect(screen.getByText(/This request cannot be signed/)).toBeTruthy();
    expect(screen.getByText(/31 bytes/)).toBeTruthy();
  });

  it('shows a malformed transaction as written under the banner', () => {
    renderDetail({
      signData: 'e8aabbccdd',
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    expect(
      screen.getByText(
        'This request cannot be signed. The transaction is not valid RLP.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('e8aabbccdd')).toBeTruthy();
    expect(screen.queryByText('To')).toBeNull();
  });

  it('refuses a legacy transaction without EIP-155', () => {
    renderDetail({
      signData: Buffer.from(
        RLP.encode([
          bn(1n),
          bn(20_000_000_000n),
          bn(21000n),
          addr('0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef'),
          bn(1n),
          new Uint8Array(0),
        ]),
      ).toString('hex'),
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    });
    expect(screen.getByText(/has no EIP-155 chain ID/)).toBeTruthy();
  });

  it('does not show the banner for a signable payload', () => {
    renderDetail({
      signData: 'ab'.repeat(32),
      dataType: 0,
      derivationPath: "m/44'/60'/0'/0",
    });
    expect(screen.queryByText(/This request cannot be signed/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The destination row
// ---------------------------------------------------------------------------

describe('EthSignRequestDetail — destination', () => {
  const DEST = '0x1111111254eeb25477b68fb85ed929f73a960582';
  const ACCOUNT = '0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef';

  function callTx(data: string): EthSignRequest {
    const hex = legacyTx([
      bn(1n),
      bn(20_000_000_000n),
      bn(100_000n),
      addr(DEST),
      bn(0n),
      Buffer.from(data.replace('0x', ''), 'hex'),
    ]);
    return {
      signData: hex,
      dataType: 1,
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
    };
  }

  const encode = (signature: string, name: string, args: unknown[]) =>
    encodeFunctionData({
      abi: parseAbi([signature]),
      functionName: name,
      args,
    } as never);

  it.each([
    ['a plain transfer of ether', '0x'],
    [
      'a call whose selector the app cannot decode',
      `0xdeadbeef${'00'.repeat(32)}`,
    ],
    [
      'a Uniswap Universal Router execute',
      encode(
        'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
        'execute',
        ['0x08', ['0xdeadbeef'], 1712345678n],
      ),
    ],
    [
      'a decoded contract call',
      encode(
        'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
        'borrow',
        [ACCOUNT, 1n, 2n, 0, ACCOUNT],
      ),
    ],
  ])('shows To for %s', (_name, data) => {
    renderDetail(callTx(data));
    expect(screen.getByText('To')).toBeTruthy();
    expect(screen.getByText(new RegExp(DEST, 'i'))).toBeTruthy();
  });

  it.each([
    [
      'transfer',
      encode('function transfer(address to, uint256 amount)', 'transfer', [
        ACCOUNT,
        1n,
      ]),
    ],
    [
      'approve',
      encode('function approve(address spender, uint256 amount)', 'approve', [
        ACCOUNT,
        1n,
      ]),
    ],
    [
      'transferFrom',
      encode(
        'function transferFrom(address from, address to, uint256 amount)',
        'transferFrom',
        [ACCOUNT, ACCOUNT, 1n],
      ),
    ],
  ])('leaves an ERC-20 %s to its own Token contract row', (_name, data) => {
    renderDetail(callTx(data));
    expect(screen.queryByText('To')).toBeNull();
    expect(screen.getAllByText('Token contract')).toHaveLength(1);
  });
});

describe('EthSignRequestDetail — a saved descriptor index', () => {
  const hex = legacyTx([
    bn(1n),
    bn(20_000_000_000n),
    bn(100_000n),
    addr('0x000000000000000000000000000000000000c0d3'),
    bn(1_000_000_000_000_000n),
    Buffer.from(`deadbeef${'00'.repeat(32)}`, 'hex'),
  ]);
  const request: EthSignRequest = {
    signData: hex,
    dataType: 1,
    derivationPath: "m/44'/60'/0'/0",
    chainId: 1,
  };

  it('shows the To and Amount rows together with the panel once the slice is read', async () => {
    setSavedIndex({ generatedAt: '2026-10-12T00:00:00.000Z' });
    try {
      renderDetail(request);
      expect(screen.queryByText('To')).toBeNull();
      expect(screen.queryByText('0.001 ETH')).toBeNull();
      expect(screen.queryByText('Digests')).toBeNull();

      await act(async () => {});
      expect(screen.getByText('To')).toBeTruthy();
      expect(screen.getByText('0.001 ETH')).toBeTruthy();
      expect(screen.getByText('Digests')).toBeTruthy();
    } finally {
      act(() => setSavedIndex(null));
    }
  });

  it('keeps the chosen tab when the source changes under the review', async () => {
    renderDetail(request);
    fireEvent.press(screen.getByText('Raw'));
    expect(screen.getByText(hex)).toBeTruthy();
    try {
      act(() => setSavedIndex({ generatedAt: '2026-10-12T00:00:00.000Z' }));
      await act(async () => {});
      expect(screen.getByText(hex)).toBeTruthy();
    } finally {
      act(() => setSavedIndex(null));
    }
  });
});
