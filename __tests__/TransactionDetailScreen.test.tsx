import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import TransactionDetailScreen from '../src/screens/TransactionDetailScreen';
import type { EthSignRequest } from '../src/types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
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

const mockRespondError = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/hooks/useWalletConnectSession.online', () => ({
  useWalletConnectSession: () => ({
    phase: 'idle',
    activeSession: null,
    pendingRequest: null,
    pair: jest.fn(),
    approveSession: jest.fn(),
    rejectSession: jest.fn(),
    disconnect: jest.fn(),
    respondSuccess: jest.fn(),
    respondError: mockRespondError,
  }),
}));

jest.mock('../src/hooks/ens/useEnsName.online', () => ({
  useEnsName: () => ({
    name: null,
    loading: false,
    error: false,
    retry: jest.fn(),
  }),
}));

// PSBT with one input and one output so inspectBtcPsbt can parse it fully
const VALID_PSBT_HEX = (() => {
  const { Psbt, payments, networks } = require('bitcoinjs-lib');
  const psbt = new Psbt({ network: networks.testnet });
  const fakePubkey = Buffer.alloc(33, 0x02);
  const { output } = payments.p2wpkh({
    pubkey: fakePubkey,
    network: networks.testnet,
  });
  psbt.addInput({
    hash: Buffer.alloc(32, 0xaa),
    index: 0,
    bip32Derivation: [
      {
        masterFingerprint: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
        path: "m/84'/1'/0'/0/0",
        pubkey: fakePubkey,
      },
    ],
  });
  psbt.addOutput({ script: output!, value: 90_000 });
  return psbt.toBuffer().toString('hex');
})();

const BIP322_PSBT_HEX = (() => {
  const {
    Psbt,
    Transaction,
    payments,
    networks,
    script,
    opcodes,
  } = require('bitcoinjs-lib');

  const fakePubkey = Buffer.alloc(33, 0x02);
  const { output } = payments.p2wpkh({
    pubkey: fakePubkey,
    network: networks.testnet,
  });

  const toSpend = new Transaction();
  toSpend.version = 0;
  toSpend.addInput(
    Buffer.alloc(32, 0x00),
    0xffffffff,
    0,
    script.compile([opcodes.OP_0, Buffer.alloc(32, 0x11)]),
  );
  toSpend.addOutput(output!, 0);

  const psbt = new Psbt({ network: networks.testnet });
  psbt.setVersion(0);
  psbt.addInput({
    hash: toSpend.getHash(),
    index: 0,
    sequence: 0,
    witnessUtxo: {
      script: output!,
      value: 0,
    },
    bip32Derivation: [
      {
        masterFingerprint: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
        path: "m/84'/1'/0'/0/0",
        pubkey: fakePubkey,
      },
    ],
  });
  psbt.addOutput({ script: Buffer.from([0x6a]), value: 0 });

  return psbt.toBuffer().toString('hex');
})();

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Use react-native's own Text so rendered content is visible in the JSON tree.
jest.mock('react-native-paper', () => {
  const { Text, Pressable, TouchableOpacity, View } = require('react-native');
  return {
    MD3DarkTheme: { colors: {} },
    Text,
    Icon: () => null,
    Button: ({ children, onPress }: any) =>
      require('react').createElement(
        Pressable,
        { onPress },
        require('react').createElement(Text, null, children),
      ),
    SegmentedButtons: ({
      buttons,
      onValueChange,
    }: {
      value: string;
      onValueChange: (v: string) => void;
      buttons: { value: string; label: string }[];
    }) => (
      <View>
        {buttons.map((b: { value: string; label: string }) => (
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderScreen(result: any) {
  const navigation = { navigate: jest.fn() } as any;
  const view = render(
    <TransactionDetailScreen
      route={
        {
          params: { result },
          key: 'TransactionDetail',
          name: 'TransactionDetail',
        } as any
      }
      navigation={navigation}
    />,
  );
  return { ...view, navigation };
}

const wcContext = { id: 1, topic: 'test-topic' };

function renderScreenWithWc(result: any) {
  const navigation = {
    navigate: jest.fn(),
    reset: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  } as any;
  const view = render(
    <TransactionDetailScreen
      route={
        {
          params: { result, wcContext },
          key: 'TransactionDetail',
          name: 'TransactionDetail',
        } as any
      }
      navigation={navigation}
    />,
  );
  return { ...view, navigation };
}

const fullRequest: EthSignRequest = {
  signData: 'aabbccdd',
  dataType: 1,
  derivationPath: "m/44'/60'/0'/0",
  chainId: 1,
  address: '0xabcdef1234567890abcdef1234567890abcdef12',
  origin: 'MetaMask',
  requestId: '01020304',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransactionDetailScreen – error result', () => {
  it('renders without crashing', async () => {
    expect(
      renderScreen({ kind: 'error', message: 'Parse failed' }),
    ).toBeDefined();
  });

  it('displays the error message', async () => {
    renderScreen({
      kind: 'error',
      message: 'Parse failed',
    });
    expect(screen.getByText('Parse failed')).toBeTruthy();
  });

  it('does not show the Sign transaction button', async () => {
    renderScreen({ kind: 'error', message: 'error' });
    expect(screen.queryByText('Sign transaction')).toBeNull();
  });
});

describe('TransactionDetailScreen – unsupported result', () => {
  it('renders without crashing', async () => {
    expect(
      renderScreen({ kind: 'unsupported', type: 'eth-signature' }),
    ).toBeDefined();
  });

  it('displays the unsupported UR type', async () => {
    renderScreen({
      kind: 'unsupported',
      type: 'eth-signature',
    });
    expect(screen.getByText('eth-signature')).toBeTruthy();
  });

  it('does not show the Sign transaction button', async () => {
    renderScreen({
      kind: 'unsupported',
      type: 'eth-signature',
    });
    expect(screen.queryByText('Sign transaction')).toBeNull();
  });
});

describe('TransactionDetailScreen – eth-sign-request result', () => {
  it('renders without crashing', async () => {
    expect(
      renderScreen({ kind: 'eth-sign-request', request: fullRequest }),
    ).toBeDefined();
  });

  it('displays the sign data', async () => {
    renderScreen({
      kind: 'eth-sign-request',
      request: fullRequest,
    });
    expect(screen.getByText('aabbccdd')).toBeTruthy();
  });

  it('displays the derivation path', async () => {
    renderScreen({
      kind: 'eth-sign-request',
      request: fullRequest,
    });
    expect(screen.getByText("m/44'/60'/0'/0")).toBeTruthy();
  });

  it('displays optional fields when present', async () => {
    renderScreen({
      kind: 'eth-sign-request',
      request: fullRequest,
    });
    expect(
      screen.getByText('0xabCDEF1234567890ABcDEF1234567890aBCDeF12'),
    ).toBeTruthy();
    expect(screen.getByText('MetaMask')).toBeTruthy();
    expect(screen.getByText('01020304')).toBeTruthy();
    expect(screen.getByText('Ethereum Mainnet')).toBeTruthy();
  });

  it('shows the correct data type label for a known type', async () => {
    renderScreen({
      kind: 'eth-sign-request',
      request: fullRequest,
    }); // dataType: 1
    expect(screen.getByText('Legacy Transaction')).toBeTruthy();
  });

  it('falls back to "Unknown (N)" for an unrecognised data type', async () => {
    const request = { ...fullRequest, dataType: 99 };
    renderScreen({ kind: 'eth-sign-request', request });
    expect(screen.getByText('Unknown (99)')).toBeTruthy();
  });

  it('shows the Sign transaction button', async () => {
    renderScreen({
      kind: 'eth-sign-request',
      request: fullRequest,
    });
    expect(screen.getByText('Sign transaction')).toBeTruthy();
  });

  it('navigates to Keycard with Ethereum signing params', async () => {
    const { navigation } = renderScreen({
      kind: 'eth-sign-request',
      request: fullRequest,
    });
    fireEvent.press(screen.getByText('Sign transaction'));
    expect(navigation.navigate).toHaveBeenCalledWith('Keycard', {
      operation: 'sign',
      signMode: 'eth',
      signData: fullRequest.signData,
      derivationPath: fullRequest.derivationPath,
      chainId: fullRequest.chainId,
      requestId: fullRequest.requestId,
      dataType: fullRequest.dataType,
    });
  });

  it('renders correctly with only required fields (no optional fields)', async () => {
    const minimalRequest: EthSignRequest = {
      signData: 'cafebabe',
      dataType: 3,
      derivationPath: 'unknown',
    };
    renderScreen({
      kind: 'eth-sign-request',
      request: minimalRequest,
    });
    expect(screen.getByText('cafebabe')).toBeTruthy();
    expect(screen.getByText('Personal Message')).toBeTruthy();
    expect(screen.queryByText('MetaMask')).toBeNull();
  });

  it('displays decoded EIP-712 domain and message fields when signData is json', async () => {
    const typedDataJson = JSON.stringify({
      types: {
        EIP712Domain: [{ name: 'name', type: 'string' }],
        Mail: [{ name: 'contents', type: 'string' }],
      },
      primaryType: 'Mail',
      domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 1,
      },
      message: {
        contents: 'Hello, Bob!',
        account: '0x1234',
      },
    });
    renderScreen({
      kind: 'eth-sign-request',
      request: {
        signData: Buffer.from(typedDataJson, 'utf8').toString('hex'),
        dataType: 2,
        derivationPath: "m/44'/60'/0'/0",
        origin: 'MetaMask',
      },
    });
    expect(screen.getAllByText('Mail').length).toBeGreaterThan(0);
    expect(screen.getByText('Primary type')).toBeTruthy();
    expect(screen.getByText('EIP-712 Domain')).toBeTruthy();
    expect(screen.getByText('Ether Mail')).toBeTruthy();
    expect(screen.getByText('Message Fields')).toBeTruthy();
    expect(screen.getByText('Hello, Bob!')).toBeTruthy();
    expect(screen.getByText('0x1234')).toBeTruthy();
  });
});

describe('TransactionDetailScreen – crypto-psbt result', () => {
  it('renders without crashing', async () => {
    expect(
      renderScreen({
        kind: 'crypto-psbt',
        request: { psbtHex: VALID_PSBT_HEX },
      }),
    ).toBeDefined();
  });

  it('shows the Sign transaction button', async () => {
    renderScreen({
      kind: 'crypto-psbt',
      request: { psbtHex: VALID_PSBT_HEX },
    });
    expect(screen.getByText('Sign transaction')).toBeTruthy();
  });

  it('navigates to Keycard with PSBT signing params', async () => {
    const { navigation } = renderScreen({
      kind: 'crypto-psbt',
      request: { psbtHex: VALID_PSBT_HEX },
    });
    fireEvent.press(screen.getByText('Sign transaction'));
    expect(navigation.navigate).toHaveBeenCalledWith('Keycard', {
      operation: 'sign',
      signMode: 'btc',
      psbtHex: VALID_PSBT_HEX,
    });
  });

  it('shows Bitcoin PSBT label', async () => {
    renderScreen({
      kind: 'crypto-psbt',
      request: { psbtHex: VALID_PSBT_HEX },
    });
    expect(screen.getByText('Bitcoin PSBT')).toBeTruthy();
  });

  it('shows Invalid PSBT error for malformed hex', async () => {
    renderScreen({
      kind: 'crypto-psbt',
      request: { psbtHex: 'deadbeef' },
    });
    expect(screen.getByText(/Invalid PSBT/)).toBeTruthy();
  });

  it('shows Sign transaction button even on invalid PSBT (screen-level decision)', async () => {
    renderScreen({
      kind: 'crypto-psbt',
      request: { psbtHex: 'deadbeef' },
    });
    expect(screen.getByText('Sign transaction')).toBeTruthy();
  });

  it('shows BIP-322 requests as message signing', async () => {
    renderScreen({
      kind: 'crypto-psbt',
      request: { psbtHex: BIP322_PSBT_HEX },
    });
    expect(screen.getByText('Bitcoin Message')).toBeTruthy();
    expect(screen.getByText('BIP-322 Message')).toBeTruthy();
    expect(screen.getByText('Sign message')).toBeTruthy();
  });
});

describe('TransactionDetailScreen – btc-sign-request result', () => {
  it('shows message signing details and CTA', async () => {
    renderScreen({
      kind: 'btc-sign-request',
      request: {
        requestId: '00112233445566778899aabbccddeeff',
        signDataHex: Buffer.from('hello btc', 'utf8').toString('hex'),
        dataType: 1,
        derivationPath: "m/84'/0'/0'/0/3",
        address: 'bc1qexampleaddress',
        origin: 'Sparrow',
      },
    });
    expect(screen.getByText('Bitcoin Message')).toBeTruthy();
    expect(screen.getByText('btc-sign-request')).toBeTruthy();
    expect(screen.getByText('hello btc')).toBeTruthy();
    expect(screen.getByText('Sign message')).toBeTruthy();
  });

  it('navigates to Keycard with Bitcoin message signing params', async () => {
    const request = {
      requestId: '00112233445566778899aabbccddeeff',
      signDataHex: Buffer.from('hello btc', 'utf8').toString('hex'),
      dataType: 1,
      derivationPath: "m/84'/0'/0'/0/3",
      address: 'bc1qexampleaddress',
      origin: 'Sparrow',
    };
    const { navigation } = renderScreen({
      kind: 'btc-sign-request',
      request,
    });
    fireEvent.press(screen.getByText('Sign message'));
    expect(navigation.navigate).toHaveBeenCalledWith('Keycard', {
      operation: 'sign',
      signMode: 'btc-message',
      requestId: request.requestId,
      signDataHex: request.signDataHex,
      derivationPath: request.derivationPath,
      address: request.address,
      origin: request.origin,
    });
  });
});

describe('TransactionDetailScreen – WalletConnect context', () => {
  beforeEach(() => mockRespondError.mockClear());

  it('shows Reject button when wcContext is present', async () => {
    renderScreenWithWc({ kind: 'eth-sign-request', request: fullRequest });
    expect(screen.getByText('Reject')).toBeTruthy();
  });

  it('calls respondError and navigates to Dashboard on Reject press', async () => {
    const { navigation } = renderScreenWithWc({
      kind: 'eth-sign-request',
      request: fullRequest,
    });
    fireEvent.press(screen.getByText('Reject'));
    await act(async () => {});
    expect(mockRespondError).toHaveBeenCalledWith(
      wcContext,
      4001,
      'User rejected',
    );
    expect(navigation.reset).toHaveBeenCalledWith(
      expect.objectContaining({ routes: [{ name: 'Dashboard' }] }),
    );
  });

  it('registers beforeRemove listener when wcContext is present', () => {
    const { navigation } = renderScreenWithWc({
      kind: 'eth-sign-request',
      request: fullRequest,
    });
    expect(navigation.addListener).toHaveBeenCalledWith(
      'beforeRemove',
      expect.any(Function),
    );
  });

  it('rejects WalletConnect request on back navigation', async () => {
    const { navigation } = renderScreenWithWc({
      kind: 'eth-sign-request',
      request: fullRequest,
    });
    const beforeRemove = navigation.addListener.mock.calls[0][1];

    beforeRemove();
    await act(async () => {});

    expect(mockRespondError).toHaveBeenCalledWith(
      wcContext,
      4001,
      'User rejected',
    );
  });

  it('does not reject on beforeRemove when navigating to Keycard', async () => {
    const { navigation } = renderScreenWithWc({
      kind: 'eth-sign-request',
      request: fullRequest,
    });
    const beforeRemove = navigation.addListener.mock.calls[0][1];

    fireEvent.press(screen.getByText('Sign transaction'));
    beforeRemove();
    await act(async () => {});

    expect(mockRespondError).not.toHaveBeenCalled();
  });
});
