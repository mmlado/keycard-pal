import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
} from '@testing-library/react-native';
import React from 'react';
import { encodeFunctionData, parseAbiItem, type AbiFunction } from 'viem';

import { useCallDescription } from '../src/hooks/useCallDescription';
import { useTenderlyConfig } from '../src/hooks/useTenderlyConfig.online';

import SimulationAddressProvider from '../src/components/SignRequestDetail/SimulationAddressProvider';
import TxDataPanel from '../src/components/SignRequestDetail/eth/DataTabPanel/TxDataPanel';
import { DESCRIPTOR_CHECK_FAILED_WARNING } from '../src/constants/eip7730';
import * as eip7730Lookup from '../src/utils/eip7730/lookup';
import { setSavedIndex } from '../src/utils/eip7730/lookup';
import type { ParsedTx } from '../src/utils/txParser';
import type { EthSignRequest } from '../src/types';
import type { SimulationResult } from '../src/utils/tenderly/client.online';

// The panel reads the address op from the provider, so every render sits inside one.
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SimulationAddressProvider derivationPath="m/44'/60'/0'/0">
      {children}
    </SimulationAddressProvider>
  );
}

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper });
}

// Hands the panel the call description SignRequestDetail does.
function Panel({
  tx,
  request: req,
  chainId,
}: {
  tx: ParsedTx;
  request: EthSignRequest;
  chainId: number | undefined;
}) {
  const { description } = useCallDescription({
    chainId,
    contract: tx.to,
    data: tx.data ?? '',
    from: req.address,
    value: tx.valueWei,
    depth: 0,
  });
  return (
    <TxDataPanel
      tx={tx}
      request={req}
      chainId={chainId}
      description={description}
    />
  );
}

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

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

const mockCredentials = {
  accountSlug: 'acme',
  projectSlug: 'proj',
  apiKey: 'key123',
};

jest.mock('../src/hooks/useTenderlyConfig.online', () => ({
  useTenderlyConfig: jest.fn(() => ({ credentials: null })),
}));

const mockSimulate = jest.fn<Promise<SimulationResult>, []>();
jest.mock('../src/utils/tenderly/client.online', () => ({
  simulateTransaction: (...args: unknown[]) => mockSimulate(...(args as [])),
}));

jest.mock('react-native-paper', () => {
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
    Icon: () => <View />,
    ActivityIndicator: () => <Text>loading</Text>,
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
  default: {
    colors: {
      primary: '#FF6400',
      onSurface: '#fff',
      onSurfaceVariant: '#aaa',
      onSurfaceMuted: '#888',
      onSurfaceSubtle: '#666',
      onSurfaceDisabled: '#444',
      surfaceVariant: '#2d2d2d',
      error: '#E95460',
      success: '#1C8A80',
    },
  },
}));

jest.mock('../src/components/InfoRow', () => {
  const { Text } = require('react-native');
  return ({ label, value }: { label: string; value: string }) => (
    <Text>{`${label}: ${value}`}</Text>
  );
});

jest.mock(
  '../src/components/SignRequestDetail/eth/DataTabPanel/CallSection',
  () => {
    const { Text, View } = require('react-native');
    return ({ description: { descriptor } }: { description: any }) => (
      <View>
        <Text>CallSection</Text>
        {descriptor && (
          <Text>{`descriptor: ${
            descriptor.format.intent
          }, recipient ${descriptor.resolvePath('recipient')}`}</Text>
        )}
      </View>
    );
  },
);

jest.mock('../src/components/PrimaryButton', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return ({ label, onPress }: { label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress}>
      <Text>{label}</Text>
    </TouchableOpacity>
  );
});

const CALLDATA =
  '0xa9059cbb000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0000000000000000000000000000000000000000000000000de0b6b3a7640000';
// A selector selectors.json does not know.
const UNKNOWN_CALLDATA =
  '0xdeadbeef0000000000000000000000000000000000000000000000000000000000000001';

const request: EthSignRequest = {
  signData: CALLDATA,
  dataType: 1,
  derivationPath: "m/44'/60'/0'/0",
  address: '0xAbCd000000000000000000000000000000000001',
};

const txWithDecoded: ParsedTx = {
  to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  data: CALLDATA,
  valueWei: '0',
  fees: { kind: 'unknown' },
};

const txWithoutDecoded: ParsedTx = {
  to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  data: UNKNOWN_CALLDATA,
  valueWei: '0',
  fees: { kind: 'unknown' },
};

const unknownRequest: EthSignRequest = {
  ...request,
  signData: UNKNOWN_CALLDATA,
};

const txNoData: ParsedTx = {
  to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  fees: { kind: 'unknown' },
};

// Contract creation — no to address
const txNoTo: ParsedTx = {
  fees: { kind: 'unknown' },
};

// In the bundled index; selectors.json does not know the selector.
const ONEINCH_V4 = '0x1111111254fb6c44bac0bed2854e76f90643097d';
const CLIPPER_SWAP_TO =
  'clipperSwapTo(address recipient, address srcToken, address dstToken, uint256 amount, uint256 minReturn)';
const RECIPIENT = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
const swapData = encodeFunctionData({
  abi: [parseAbiItem(`function ${CLIPPER_SWAP_TO}`) as AbiFunction],
  args: [
    RECIPIENT,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    1500000n,
    1400000n,
  ],
});
const txUnknownWithDescriptor: ParsedTx = {
  to: ONEINCH_V4,
  data: swapData,
  valueWei: '0',
  fees: { kind: 'unknown' },
};

describe('TxDataPanel', () => {
  beforeEach(() => {
    (useTenderlyConfig as jest.Mock).mockReturnValue({ credentials: null });
    mockSimulate.mockReset();
  });

  describe('with no tx.data', () => {
    it('shows Digests tab with null digest (no calldata)', () => {
      render(<Panel tx={txNoData} request={request} chainId={1} />);
      expect(screen.getByText('Digests')).toBeTruthy();
      expect(screen.queryByText(/Calldata Digest:/)).toBeNull();
      expect(screen.queryByTestId('digest-explainer')).toBeNull();
    });
  });

  describe('with decoded call', () => {
    it('shows Decoded tab by default and renders decoded section', () => {
      render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
      expect(screen.getByText('Decoded')).toBeTruthy();
      expect(screen.getByText('Digests')).toBeTruthy();
      expect(screen.getByText('Raw')).toBeTruthy();
      expect(screen.getByText('CallSection')).toBeTruthy();
    });

    it('switches to Digests tab and shows calldata digest', () => {
      render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
      fireEvent.press(screen.getByText('Digests'));
      expect(screen.getByText(/Calldata Digest: 0x[0-9a-f]{64}/)).toBeTruthy();
      expect(screen.getByTestId('digest-explainer')).toBeTruthy();
    });

    it('switches to Raw tab and shows signData', () => {
      render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
      fireEvent.press(screen.getByText('Raw'));
      expect(screen.getByText(new RegExp(CALLDATA))).toBeTruthy();
    });
  });

  describe('without decoded call (unknown-call)', () => {
    it('shows Digests and Raw tabs only, defaults to Digests', () => {
      render(
        <Panel tx={txWithoutDecoded} request={unknownRequest} chainId={1} />,
      );
      expect(screen.queryByText('Decoded')).toBeNull();
      expect(screen.getByText('Digests')).toBeTruthy();
      expect(screen.getByText('Raw')).toBeTruthy();
      expect(screen.getByText(/Calldata Digest: 0x[0-9a-f]{64}/)).toBeTruthy();
    });

    it('switches to Raw tab', () => {
      render(
        <Panel tx={txWithoutDecoded} request={unknownRequest} chainId={1} />,
      );
      fireEvent.press(screen.getByText('Raw'));
      expect(screen.getByText(new RegExp(UNKNOWN_CALLDATA))).toBeTruthy();
    });
  });

  describe('with a registry entry', () => {
    it("shows an unknown call through the entry's own signature", () => {
      render(
        <Panel
          tx={txUnknownWithDescriptor}
          request={{ ...request, signData: swapData }}
          chainId={1}
        />,
      );
      expect(screen.getByText('Decoded')).toBeTruthy();
      expect(
        screen.getByText(`descriptor: Swap, recipient ${RECIPIENT}`),
      ).toBeTruthy();
    });

    it('drops an entry whose signature does not fit the bytes', () => {
      const cut = swapData.slice(0, 74);
      render(
        <Panel
          tx={{ ...txUnknownWithDescriptor, data: cut }}
          request={{ ...request, signData: cut }}
          chainId={1}
        />,
      );
      expect(screen.queryByText('Decoded')).toBeNull();
      expect(screen.queryByText(/descriptor:/)).toBeNull();
    });

    it('falls back to the app view of a known call when the entry does not fit', () => {
      jest.spyOn(eip7730Lookup, 'lookupCalldata').mockReturnValue({
        intent: 'Send',
        signature: 'transfer(address to, uint256 amount, bytes memo)',
        fields: [],
      });
      try {
        render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
        expect(screen.getByText('CallSection')).toBeTruthy();
        expect(screen.queryByText(/descriptor:/)).toBeNull();
      } finally {
        jest.restoreAllMocks();
      }
    });

    describe('with a mustMatch check', () => {
      const transferEntry = (allowed: string[]) => ({
        intent: 'Send',
        signature: 'transfer(address recipient, uint256 amount)',
        fields: [
          {
            path: 'recipient',
            label: 'To',
            format: 'raw' as const,
            visible: { mustMatch: allowed },
          },
        ],
      });

      afterEach(() => jest.restoreAllMocks());

      it('uses the entry when the value is listed', () => {
        jest
          .spyOn(eip7730Lookup, 'lookupCalldata')
          .mockReturnValue(transferEntry([`0x${'aa'.repeat(20)}`]));
        render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
        expect(screen.getByText(/^descriptor: Send/)).toBeTruthy();
        expect(screen.queryByText(DESCRIPTOR_CHECK_FAILED_WARNING)).toBeNull();
      });

      it("drops the entry when it is not, above every tab, for the app's own view", () => {
        jest
          .spyOn(eip7730Lookup, 'lookupCalldata')
          .mockReturnValue(transferEntry([`0x${'bb'.repeat(20)}`]));
        render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
        expect(screen.getByText(DESCRIPTOR_CHECK_FAILED_WARNING)).toBeTruthy();
        expect(screen.getByText('CallSection')).toBeTruthy();
        expect(screen.queryByText(/descriptor:/)).toBeNull();
        fireEvent.press(screen.getByText('Raw'));
        expect(screen.getByText(DESCRIPTOR_CHECK_FAILED_WARNING)).toBeTruthy();
      });
    });

    it('shows nothing while a saved slice is read, then decides its tabs', async () => {
      setSavedIndex({ generatedAt: '2026-10-12T00:00:00.000Z' });
      try {
        render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
        expect(screen.queryByText('Digests')).toBeNull();

        // No slice file here, so no entry: the app's own view follows.
        await act(async () => {});
        expect(screen.getByText('CallSection')).toBeTruthy();
        expect(screen.queryByText(/descriptor:/)).toBeNull();
      } finally {
        act(() => setSavedIndex(null));
      }
    });

    it('keeps its tab when the source changes under it', async () => {
      render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
      fireEvent.press(screen.getByText('Raw'));
      expect(screen.getByText(new RegExp(CALLDATA))).toBeTruthy();
      try {
        act(() => setSavedIndex({ generatedAt: '2026-10-12T00:00:00.000Z' }));
        expect(screen.queryByText('Digests')).toBeNull();

        await act(async () => {});
        expect(screen.getByText(new RegExp(CALLDATA))).toBeTruthy();
        expect(screen.queryByText('CallSection')).toBeNull();
      } finally {
        act(() => setSavedIndex(null));
      }
    });
  });

  describe('Simulation tab', () => {
    it('absent when credentials null', () => {
      (useTenderlyConfig as jest.Mock).mockReturnValue({ credentials: null });
      render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
      expect(screen.queryByText('Simulation')).toBeNull();
    });

    it('present when credentials set and tx has to address', () => {
      (useTenderlyConfig as jest.Mock).mockReturnValue({
        credentials: mockCredentials,
      });
      render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
      expect(screen.getByText('Simulation')).toBeTruthy();
    });

    it('absent when tx has no to address', () => {
      (useTenderlyConfig as jest.Mock).mockReturnValue({
        credentials: mockCredentials,
      });
      render(<Panel tx={txNoTo} request={request} chainId={1} />);
      expect(screen.queryByText('Simulation')).toBeNull();
    });

    it('shows Simulate button in idle state', () => {
      (useTenderlyConfig as jest.Mock).mockReturnValue({
        credentials: mockCredentials,
      });
      render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
      fireEvent.press(screen.getByText('Simulation'));
      expect(screen.getByText('Simulate')).toBeTruthy();
    });

    it('shows loader then result after successful simulation', async () => {
      (useTenderlyConfig as jest.Mock).mockReturnValue({
        credentials: mockCredentials,
      });
      const result: SimulationResult = {
        status: 'success',
        assetChanges: [],
        traceUrl: 'https://dashboard.tenderly.co/acme/proj/simulation/abc',
      };
      mockSimulate.mockResolvedValue(result);

      render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
      fireEvent.press(screen.getByText('Simulation'));
      fireEvent.press(screen.getByText('Simulate'));

      expect(screen.getByText('loading')).toBeTruthy();

      await act(async () => {});

      expect(screen.getByText('Success')).toBeTruthy();
      expect(screen.getByText('View trace →')).toBeTruthy();
    });

    it('shows error and retry on simulation failure', async () => {
      (useTenderlyConfig as jest.Mock).mockReturnValue({
        credentials: mockCredentials,
      });
      mockSimulate.mockRejectedValue(new Error('API error 401: Unauthorized'));

      render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
      fireEvent.press(screen.getByText('Simulation'));
      fireEvent.press(screen.getByText('Simulate'));

      await act(async () => {});

      expect(screen.getByText('API error 401: Unauthorized')).toBeTruthy();
      expect(screen.getByText('Retry')).toBeTruthy();
    });

    it('result persists when switching tabs and back', async () => {
      (useTenderlyConfig as jest.Mock).mockReturnValue({
        credentials: mockCredentials,
      });
      const result: SimulationResult = {
        status: 'reverted',
        revertReason: 'execution reverted',
        assetChanges: [],
        traceUrl: '',
      };
      mockSimulate.mockResolvedValue(result);

      render(<Panel tx={txWithDecoded} request={request} chainId={1} />);
      fireEvent.press(screen.getByText('Simulation'));
      fireEvent.press(screen.getByText('Simulate'));

      await act(async () => {});

      expect(screen.getByText('Reverted')).toBeTruthy();

      // switch away and back
      fireEvent.press(screen.getByText('Decoded'));
      fireEvent.press(screen.getByText('Simulation'));

      expect(screen.getByText('Reverted')).toBeTruthy();
      expect(screen.getByText('execution reverted')).toBeTruthy();
    });
  });
});
