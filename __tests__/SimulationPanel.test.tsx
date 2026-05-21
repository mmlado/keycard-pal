import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SimulationPanel from '../src/components/SignRequestDetail/eth/DataTabPanel/SimulationPanel';
import type { SimulationState } from '../src/components/SignRequestDetail/eth/DataTabPanel/SimulationPanel';
import type { SimulationResult } from '../src/utils/tenderly/client.online';

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return {
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
    ActivityIndicator: () => <Text>loading</Text>,
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

jest.mock('../src/components/PrimaryButton', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({ label, onPress }: { label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress}>
      <Text>{label}</Text>
    </TouchableOpacity>
  );
});

const onSimulate = jest.fn();

beforeEach(() => {
  onSimulate.mockClear();
});

function renderPanel(state: SimulationState) {
  return render(<SimulationPanel state={state} onSimulate={onSimulate} />);
}

describe('SimulationPanel', () => {
  describe('idle phase', () => {
    it('shows Simulate button', () => {
      renderPanel({ phase: 'idle' });
      expect(screen.getByText('Simulate')).toBeTruthy();
    });

    it('calls onSimulate when Simulate pressed', () => {
      renderPanel({ phase: 'idle' });
      fireEvent.press(screen.getByText('Simulate'));
      expect(onSimulate).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading phase', () => {
    it('shows loading indicator', () => {
      renderPanel({ phase: 'loading' });
      expect(screen.getByText('loading')).toBeTruthy();
    });

    it('shows Simulating text', () => {
      renderPanel({ phase: 'loading' });
      expect(screen.getByText('Simulating…')).toBeTruthy();
    });
  });

  describe('error phase', () => {
    it('shows error message', () => {
      renderPanel({ phase: 'error', message: 'API error 401: Unauthorized' });
      expect(screen.getByText('API error 401: Unauthorized')).toBeTruthy();
    });

    it('shows Retry button', () => {
      renderPanel({ phase: 'error', message: 'fail' });
      expect(screen.getByText('Retry')).toBeTruthy();
    });

    it('calls onSimulate when Retry pressed', () => {
      renderPanel({ phase: 'error', message: 'fail' });
      fireEvent.press(screen.getByText('Retry'));
      expect(onSimulate).toHaveBeenCalledTimes(1);
    });
  });

  describe('result phase — success', () => {
    const successResult: SimulationResult = {
      status: 'success',
      assetChanges: [],
      traceUrl: 'https://dashboard.tenderly.co/acme/proj/simulation/abc',
    };

    it('shows Success chip', () => {
      renderPanel({ phase: 'result', data: successResult });
      expect(screen.getByText('Success')).toBeTruthy();
    });

    it('shows trace link', () => {
      renderPanel({ phase: 'result', data: successResult });
      expect(screen.getByText('View trace →')).toBeTruthy();
    });

    it('opens trace URL when trace link pressed', () => {
      const openURL = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined);
      renderPanel({ phase: 'result', data: successResult });
      fireEvent.press(screen.getByText('View trace →'));
      expect(openURL).toHaveBeenCalledWith(successResult.traceUrl);
      openURL.mockRestore();
    });

    it('hides trace link when traceUrl is empty', () => {
      renderPanel({
        phase: 'result',
        data: { ...successResult, traceUrl: '' },
      });
      expect(screen.queryByText('View trace →')).toBeNull();
    });
  });

  describe('result phase — reverted', () => {
    const revertedResult: SimulationResult = {
      status: 'reverted',
      revertReason: 'execution reverted',
      assetChanges: [],
      traceUrl: '',
    };

    it('shows Reverted chip', () => {
      renderPanel({ phase: 'result', data: revertedResult });
      expect(screen.getByText('Reverted')).toBeTruthy();
    });

    it('shows revert reason', () => {
      renderPanel({ phase: 'result', data: revertedResult });
      expect(screen.getByText('execution reverted')).toBeTruthy();
    });

    it('does not show revert reason when null', () => {
      renderPanel({
        phase: 'result',
        data: { ...revertedResult, revertReason: null },
      });
      expect(screen.queryByText('execution reverted')).toBeNull();
    });
  });

  describe('asset changes', () => {
    it('shows token symbol and amount', () => {
      const result: SimulationResult = {
        status: 'success',
        assetChanges: [
          {
            tokenSymbol: 'USDC',
            tokenAddress: '0xusdc',
            from: '0xaaaa000000000000000000000000000000000001',
            to: '0xbbbb000000000000000000000000000000000002',
            amount: '1',
          },
        ],
        traceUrl: '',
      };
      renderPanel({ phase: 'result', data: result });
      expect(screen.getByText('USDC')).toBeTruthy();
      expect(screen.getByText('1')).toBeTruthy();
    });

    it('shows from→to addresses truncated', () => {
      const result: SimulationResult = {
        status: 'success',
        assetChanges: [
          {
            tokenSymbol: 'ETH',
            tokenAddress: '',
            from: '0xaaaa000000000000000000000000000000000001',
            to: '0xbbbb000000000000000000000000000000000002',
            amount: '0.5',
          },
        ],
        traceUrl: '',
      };
      renderPanel({ phase: 'result', data: result });
      expect(screen.getByText(/0xaaaa.*0001/)).toBeTruthy();
    });

    it('shows Asset changes label when changes present', () => {
      const result: SimulationResult = {
        status: 'success',
        assetChanges: [
          {
            tokenSymbol: 'ETH',
            tokenAddress: '',
            from: '0x1111111111111111111111111111111111111111',
            to: '0x2222222222222222222222222222222222222222',
            amount: '1',
          },
        ],
        traceUrl: '',
      };
      renderPanel({ phase: 'result', data: result });
      expect(screen.getByText('Asset changes')).toBeTruthy();
    });

    it('hides Asset changes section when empty', () => {
      renderPanel({
        phase: 'result',
        data: { status: 'success', assetChanges: [], traceUrl: '' },
      });
      expect(screen.queryByText('Asset changes')).toBeNull();
    });
  });
});
