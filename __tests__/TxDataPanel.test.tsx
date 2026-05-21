import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { useTenderlyConfig } from '../src/hooks/useTenderlyConfig.online';

import TxDataPanel from '../src/components/SignRequestDetail/eth/DataTabPanel/TxDataPanel';
import type { ParsedTx } from '../src/utils/txParser';
import type { EthSignRequest } from '../src/types';
import type { SimulationResult } from '../src/utils/tenderly/client.online';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
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
  '../src/components/SignRequestDetail/eth/DataTabPanel/DecodedCallSection',
  () => {
    const { Text } = require('react-native');
    return () => <Text>DecodedCallSection</Text>;
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
  decodedCall: {
    kind: 'erc20-transfer',
    to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    amount: 1000000000000000000n,
  },
  fees: { kind: 'unknown' },
};

const txWithoutDecoded: ParsedTx = {
  to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  data: CALLDATA,
  valueWei: '0',
  decodedCall: { kind: 'unknown-call', selector: '0xa9059cbb' },
  fees: { kind: 'unknown' },
};

const txNoData: ParsedTx = {
  to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  fees: { kind: 'unknown' },
};

// Contract creation — no to address
const txNoTo: ParsedTx = {
  fees: { kind: 'unknown' },
};

describe('TxDataPanel', () => {
  beforeEach(() => {
    (useTenderlyConfig as jest.Mock).mockReturnValue({ credentials: null });
    mockSimulate.mockReset();
  });

  describe('with no tx.data', () => {
    it('shows Digests tab with null digest (no calldata)', () => {
      render(<TxDataPanel tx={txNoData} request={request} chainId={1} />);
      expect(screen.getByText('Digests')).toBeTruthy();
      expect(screen.queryByText(/Calldata Digest:/)).toBeNull();
    });
  });

  describe('with decoded call', () => {
    it('shows Decoded tab by default and renders decoded section', () => {
      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
      expect(screen.getByText('Decoded')).toBeTruthy();
      expect(screen.getByText('Digests')).toBeTruthy();
      expect(screen.getByText('Raw')).toBeTruthy();
      expect(screen.getByText('DecodedCallSection')).toBeTruthy();
    });

    it('switches to Digests tab and shows calldata digest', () => {
      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
      fireEvent.press(screen.getByText('Digests'));
      expect(screen.getByText(/Calldata Digest: 0x[0-9a-f]{64}/)).toBeTruthy();
    });

    it('switches to Raw tab and shows signData', () => {
      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
      fireEvent.press(screen.getByText('Raw'));
      expect(screen.getByText(new RegExp(CALLDATA))).toBeTruthy();
    });
  });

  describe('without decoded call (unknown-call)', () => {
    it('shows Digests and Raw tabs only, defaults to Digests', () => {
      render(
        <TxDataPanel tx={txWithoutDecoded} request={request} chainId={1} />,
      );
      expect(screen.queryByText('Decoded')).toBeNull();
      expect(screen.getByText('Digests')).toBeTruthy();
      expect(screen.getByText('Raw')).toBeTruthy();
      expect(screen.getByText(/Calldata Digest: 0x[0-9a-f]{64}/)).toBeTruthy();
    });

    it('switches to Raw tab', () => {
      render(
        <TxDataPanel tx={txWithoutDecoded} request={request} chainId={1} />,
      );
      fireEvent.press(screen.getByText('Raw'));
      expect(screen.getByText(new RegExp(CALLDATA))).toBeTruthy();
    });
  });

  describe('Simulation tab', () => {
    it('absent when credentials null', () => {
      (useTenderlyConfig as jest.Mock).mockReturnValue({ credentials: null });
      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
      expect(screen.queryByText('Simulation')).toBeNull();
    });

    it('present when credentials set and tx has to address', () => {
      (useTenderlyConfig as jest.Mock).mockReturnValue({
        credentials: mockCredentials,
      });
      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
      expect(screen.getByText('Simulation')).toBeTruthy();
    });

    it('absent when tx has no to address', () => {
      (useTenderlyConfig as jest.Mock).mockReturnValue({
        credentials: mockCredentials,
      });
      render(<TxDataPanel tx={txNoTo} request={request} chainId={1} />);
      expect(screen.queryByText('Simulation')).toBeNull();
    });

    it('shows Simulate button in idle state', () => {
      (useTenderlyConfig as jest.Mock).mockReturnValue({
        credentials: mockCredentials,
      });
      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
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

      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
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

      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
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

      render(<TxDataPanel tx={txWithDecoded} request={request} chainId={1} />);
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
