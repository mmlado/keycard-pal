import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text, Pressable, View } = require('react-native');
  const colors = {
    primary: '#FF6400',
    secondary: '#1C8A80',
    surface: '#1e1e1e',
    background: '#121212',
    onSurface: '#ffffff',
    onSurfaceVariant: '#aaaaaa',
    surfaceVariant: '#2a2a2a',
    error: '#cf6679',
    outline: '#555',
    outlineVariant: '#333',
  };
  return {
    MD3DarkTheme: { colors },
    ActivityIndicator: () => require('react').createElement(View),
    Button: ({ children, onPress }: any) =>
      require('react').createElement(
        Pressable,
        { onPress },
        require('react').createElement(Text, null, children),
      ),
    Checkbox: { Android: () => require('react').createElement(View) },
    RadioButton: {
      Group: ({ children }: any) =>
        require('react').createElement(View, null, children),
      Android: ({ onPress }: any) =>
        require('react').createElement(Pressable, { onPress }),
    },
    Text: ({ children, ...rest }: any) =>
      require('react').createElement(Text, rest, children),
  };
});

jest.mock('react-native-svg', () => ({ SvgXml: () => null }));

jest.mock('../src/assets/icons', () => {
  const { View } = require('react-native');
  const Icon = () => require('react').createElement(View);
  return {
    Icons: { scan: Icon, nfcActivate: Icon },
  };
});

jest.mock('../src/components/AddressText', () => {
  const { Text } = require('react-native');
  return ({ address }: any) =>
    require('react').createElement(Text, null, address);
});

jest.mock('../src/components/PrimaryButton', () => {
  const { Pressable, Text } = require('react-native');
  return ({ label, onPress, disabled }: any) =>
    require('react').createElement(
      Pressable,
      { onPress, disabled },
      require('react').createElement(Text, null, label),
    );
});

jest.mock('../src/components/NFCBottomSheet', () => {
  const { Pressable, Text } = require('react-native');
  return ({ onCancel }: any) =>
    require('react').createElement(
      Pressable,
      { onPress: onCancel },
      require('react').createElement(Text, null, 'Cancel NFC'),
    );
});

const mockPair = jest.fn().mockResolvedValue(undefined);
const mockRejectSession = jest.fn().mockResolvedValue(undefined);
const mockApproveSession = jest.fn().mockResolvedValue(undefined);
const mockStartNfc = jest.fn();
const mockCancelNfc = jest.fn();
const mockDeriveAddresses = jest.fn(
  (_key: unknown, count: number, _derive: unknown, start: number) =>
    Array.from({ length: count }, (_, i) => `0xADDR${start + i}`),
);
let capturedKeycardOp: ((cmdSet: any) => Promise<unknown>) | null = null;

let mockPhase: any = 'pairing';
let mockNfcPhase: string = 'idle';
let mockNfcResult: any = null;

jest.mock('../src/hooks/useWalletConnectSession.online', () => ({
  useWalletConnectSession: () => ({
    phase: mockPhase,
    activeSession: null,
    pendingRequest: null,
    pair: mockPair,
    approveSession: mockApproveSession,
    rejectSession: mockRejectSession,
    disconnect: jest.fn(),
    respondSuccess: jest.fn(),
    respondError: jest.fn(),
  }),
}));

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOp: (op: any, _opts: any) => {
    capturedKeycardOp = op;
    return {
      phase: mockNfcPhase,
      status: '',
      result: mockNfcResult,
      start: mockStartNfc,
      cancel: mockCancelNfc,
      submitPin: jest.fn(),
    };
  },
}));

jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    BIP32KeyPair: {
      extendedKey: jest.fn((data: unknown) => ({ extendedKeyData: data })),
    },
  },
}));

jest.mock('../src/utils/hdAddress', () => ({
  deriveAddresses: (...args: unknown[]) => mockDeriveAddresses(...args),
}));

jest.mock('../src/utils/ethereumAddress', () => ({
  pubKeyToEthAddress: jest.fn(),
}));

jest.mock('../src/utils/chainMetadata', () => ({
  getChainName: (id: number) => `Chain ${id}`,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import WalletConnectPairingScreen from '../src/screens/WalletConnectPairingScreen';

const navigation = {
  reset: jest.fn(),
  setOptions: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
};
const route = { params: { uri: 'wc:test-uri@2?relay-protocol=irn' } };

async function renderScreen() {
  const view = render(
    <WalletConnectPairingScreen
      navigation={navigation as any}
      route={route as any}
    />,
  );
  await act(async () => {});
  return view;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockPhase = 'pairing';
  mockNfcPhase = 'idle';
  mockNfcResult = null;
  capturedKeycardOp = null;
});

describe('WalletConnectPairingScreen', () => {
  it('calls pair() with the uri on mount', async () => {
    await renderScreen();
    expect(mockPair).toHaveBeenCalledWith('wc:test-uri@2?relay-protocol=irn');
  });

  it('shows spinner in pairing phase', async () => {
    await renderScreen();
    expect(screen.getByText('Connecting to dApp…')).toBeTruthy();
  });

  it('shows proposal UI when wcPhase is proposal', async () => {
    mockPhase = {
      kind: 'proposal',
      proposal: {
        id: 1,
        params: {
          id: 1,
          proposer: {
            metadata: { name: 'TestDApp', url: 'https://test.io', icons: [] },
          },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
          },
          optionalNamespaces: {},
        },
      },
    };
    await renderScreen();
    expect(screen.getByText('TestDApp')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Reject')).toBeTruthy();
  });

  it('shows relay privacy notice in proposal phase', async () => {
    mockPhase = {
      kind: 'proposal',
      proposal: {
        id: 1,
        params: {
          id: 1,
          proposer: { metadata: { name: 'App', url: '', icons: [] } },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1'], methods: [] },
          },
          optionalNamespaces: {},
        },
      },
    };
    await renderScreen();
    expect(screen.getByText('Relay privacy notice')).toBeTruthy();
  });

  it('shows error UI in error phase', async () => {
    mockPhase = { kind: 'error', message: 'Pairing failed' };
    await renderScreen();
    expect(screen.getByText('Pairing failed')).toBeTruthy();
    expect(screen.getByText('Go back to Dashboard')).toBeTruthy();
  });

  it('shows requested chain names in proposal phase', async () => {
    mockPhase = {
      kind: 'proposal',
      proposal: {
        id: 1,
        params: {
          id: 1,
          proposer: { metadata: { name: 'App', url: '', icons: [] } },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1', 'eip155:137'], methods: [] },
          },
          optionalNamespaces: {},
        },
      },
    };
    await renderScreen();
    expect(screen.getByText('Chain 1')).toBeTruthy();
    expect(screen.getByText('Chain 137')).toBeTruthy();
  });

  it('shows error banner when required method is unsupported', async () => {
    mockPhase = {
      kind: 'proposal',
      proposal: {
        id: 1,
        params: {
          id: 1,
          proposer: { metadata: { name: 'App', url: '', icons: [] } },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1'], methods: ['eth_sendTransaction'] },
          },
          optionalNamespaces: {},
        },
      },
    };
    await renderScreen();
    expect(screen.getByText(/eth_sendTransaction/)).toBeTruthy();
  });

  it('shows error banner when required namespace is unsupported', async () => {
    mockPhase = {
      kind: 'proposal',
      proposal: {
        id: 1,
        params: {
          id: 1,
          proposer: { metadata: { name: 'App', url: '', icons: [] } },
          requiredNamespaces: {
            cosmos: { chains: ['cosmos:cosmoshub-4'], methods: [] },
            eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
          },
          optionalNamespaces: {},
        },
      },
    };
    await renderScreen();
    expect(screen.getByText(/cosmos/)).toBeTruthy();
  });

  it('shows error banner listing unsupported required chains', async () => {
    mockPhase = {
      kind: 'proposal',
      proposal: {
        id: 1,
        params: {
          id: 1,
          proposer: { metadata: { name: 'App', url: '', icons: [] } },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1', 'eip155:56'], methods: [] },
          },
          optionalNamespaces: {},
        },
      },
    };
    await renderScreen();
    expect(screen.getAllByText(/56/).length).toBeGreaterThan(0);
  });

  it('shows approving phase after Confirm is pressed', async () => {
    mockPhase = {
      kind: 'proposal',
      proposal: {
        id: 1,
        params: {
          id: 1,
          proposer: { metadata: { name: 'App', url: '', icons: [] } },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
          },
          optionalNamespaces: {},
        },
      },
    };
    await renderScreen();

    fireEvent.press(screen.getByText('Confirm'));
    await act(async () => {});

    expect(screen.getByText('Tap Keycard to connect…')).toBeTruthy();
  });

  it('navigates to Dashboard when active phase arrives after approving', async () => {
    mockPhase = {
      kind: 'proposal',
      proposal: {
        id: 1,
        params: {
          id: 1,
          proposer: { metadata: { name: 'App', url: '', icons: [] } },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
          },
          optionalNamespaces: {},
        },
      },
    };
    const { rerender } = render(
      <WalletConnectPairingScreen
        navigation={navigation as any}
        route={route as any}
      />,
    );
    await act(async () => {});

    // Simulate user clicking Confirm (sets localPhase to 'approving')
    fireEvent.press(screen.getByText('Confirm'));
    await act(async () => {});

    // Now active phase arrives
    mockPhase = {
      kind: 'active',
      session: {
        topic: 't',
        peer: { metadata: { name: 'App', url: '', icons: [] } },
        namespaces: {},
      },
    };
    rerender(
      <WalletConnectPairingScreen
        navigation={navigation as any}
        route={route as any}
      />,
    );
    await act(async () => {});

    expect(navigation.reset).toHaveBeenCalledWith(
      expect.objectContaining({ routes: [{ name: 'Dashboard' }] }),
    );
  });

  it('calls rejectSession and navigates back when Reject is pressed', async () => {
    const fakeProposal = {
      id: 1,
      params: {
        id: 1,
        proposer: { metadata: { name: 'App', url: '', icons: [] } },
        requiredNamespaces: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
        optionalNamespaces: {},
      },
    };
    mockPhase = { kind: 'proposal', proposal: fakeProposal };
    await renderScreen();

    fireEvent.press(screen.getByText('Reject'));
    await act(async () => {});

    expect(mockRejectSession).toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalled();
  });

  it('exports the selected account key from Keycard', async () => {
    await renderScreen();
    const response = { data: 'extended-key-data', checkOK: jest.fn() };
    const cmdSet = {
      exportExtendedKey: jest.fn().mockResolvedValue(response),
    };

    await expect(capturedKeycardOp?.(cmdSet)).resolves.toEqual({
      extendedKeyData: 'extended-key-data',
    });

    expect(cmdSet.exportExtendedKey).toHaveBeenCalledWith(
      0,
      "m/44'/60'/0'",
      false,
    );
    expect(response.checkOK).toHaveBeenCalled();
  });

  it('cancels NFC approval, rejects the proposal, and returns to Dashboard', async () => {
    mockPhase = {
      kind: 'proposal',
      proposal: {
        id: 1,
        params: {
          id: 1,
          proposer: { metadata: { name: 'App', url: '', icons: [] } },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
          },
          optionalNamespaces: {},
        },
      },
    };
    await renderScreen();

    fireEvent.press(screen.getByText('Confirm'));
    await act(async () => {});
    fireEvent.press(screen.getByText('Cancel NFC'));
    await act(async () => {});

    expect(mockCancelNfc).toHaveBeenCalled();
    expect(mockRejectSession).toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith(
      expect.objectContaining({ routes: [{ name: 'Dashboard' }] }),
    );
  });

  it('derives addresses after NFC export and approves selected address', async () => {
    const derivedKey = { id: 'external-key' };
    mockNfcPhase = 'done';
    mockNfcResult = { deriveChild: jest.fn(() => derivedKey) };
    mockPhase = {
      kind: 'proposal',
      proposal: {
        id: 1,
        params: {
          id: 1,
          proposer: { metadata: { name: 'App', url: '', icons: [] } },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
          },
          optionalNamespaces: {},
        },
      },
    };

    const { UNSAFE_getByType } = await renderScreen();

    expect(mockNfcResult.deriveChild).toHaveBeenCalledWith(0);
    expect(mockDeriveAddresses).toHaveBeenCalledWith(
      derivedKey,
      20,
      expect.any(Function),
      0,
    );
    expect(screen.getByText('0xADDR1')).toBeTruthy();

    fireEvent.press(screen.getByText('0xADDR1'));
    await act(async () => {});
    fireEvent.press(screen.getByText('Connect'));
    await act(async () => {});

    expect(mockApproveSession).toHaveBeenCalledWith(
      '0xADDR1',
      "m/44'/60'/0'/0/1",
    );

    await act(async () => {
      UNSAFE_getByType(FlatList).props.onEndReached();
    });

    expect(mockDeriveAddresses).toHaveBeenLastCalledWith(
      derivedKey,
      20,
      expect.any(Function),
      20,
    );
  });

  it('cancels address selection and rejects the proposal', async () => {
    mockNfcPhase = 'done';
    mockNfcResult = { deriveChild: jest.fn(() => ({ id: 'external-key' })) };
    mockPhase = {
      kind: 'proposal',
      proposal: {
        id: 1,
        params: {
          id: 1,
          proposer: { metadata: { name: 'App', url: '', icons: [] } },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
          },
          optionalNamespaces: {},
        },
      },
    };

    await renderScreen();
    fireEvent.press(screen.getByText('Cancel'));
    await act(async () => {});

    expect(mockRejectSession).toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith(
      expect.objectContaining({ routes: [{ name: 'Dashboard' }] }),
    );
  });

  it('navigates back from the connection error screen', async () => {
    mockPhase = { kind: 'error', message: 'Pairing failed' };
    await renderScreen();

    fireEvent.press(screen.getByText('Go back to Dashboard'));

    expect(navigation.reset).toHaveBeenCalledWith(
      expect.objectContaining({ routes: [{ name: 'Dashboard' }] }),
    );
  });
});
