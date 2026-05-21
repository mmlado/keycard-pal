import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { EthSignRequest } from '../src/types';
import type { ParsedTx } from '../src/utils/txParser';
import type { SimulationResult } from '../src/utils/tenderly/client.online';

// --- mocks ---

const mockSimulate = jest.fn<Promise<SimulationResult>, any[]>();
jest.mock('../src/utils/tenderly/client.online', () => ({
  simulateTransaction: (...args: any[]) => mockSimulate(...args),
}));

const mockUseTenderlyConfig = jest.fn();
jest.mock('../src/hooks/useTenderlyConfig.online', () => ({
  useTenderlyConfig: () => mockUseTenderlyConfig(),
}));

const mockStart = jest.fn();
const mockCancel = jest.fn();
let mockPhase = 'idle';
let mockResult: string | null = null;

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOp: () => ({
    phase: mockPhase,
    status: '',
    cardName: null,
    pinError: null,
    result: mockResult,
    start: mockStart,
    cancel: mockCancel,
    submitPin: jest.fn(),
    reset: jest.fn(),
    retry: jest.fn(),
    proceedWithNonGenuine: jest.fn(),
  }),
}));

jest.mock('../src/utils/ethereumAddress', () => ({
  pubKeyToEthAddress: (_key: Uint8Array) => '0xDerived',
}));

// useSimulation imports keycard-sdk transitively via the op fn; mock it
jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    BIP32KeyPair: {
      extendedKey: () => ({ publicKey: new Uint8Array(33) }),
    },
  },
}));

// --- import after mocks ---
import { useSimulation } from '../src/components/SignRequestDetail/eth/DataTabPanel/useSimulation';

// --- fixtures ---

const CREDS = { accountSlug: 'acme', projectSlug: 'proj', apiKey: 'key123' };

const REQUEST: EthSignRequest = {
  signData: '0xdeadbeef',
  dataType: 1,
  derivationPath: "m/44'/60'/0'/0",
  address: '0xABCD000000000000000000000000000000000001',
};

const REQUEST_NO_ADDR: EthSignRequest = {
  signData: '0xdeadbeef',
  dataType: 1,
  derivationPath: "m/44'/60'/0'/0",
};

const TX: ParsedTx = {
  to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  data: '0x',
  valueWei: '0',
  fees: { kind: 'unknown' },
};

const TX_NO_TO: ParsedTx = { fees: { kind: 'unknown' } };

const SUCCESS: SimulationResult = {
  status: 'success',
  assetChanges: [],
  traceUrl: 'https://dashboard.tenderly.co/acme/proj/simulation/xyz',
};

// --- helpers ---

function renderSim(
  request: EthSignRequest = REQUEST,
  tx: ParsedTx = TX,
  chainId: number | undefined = 1,
) {
  return renderHook(
    ({
      req,
      parsedTx,
      cid,
    }: {
      req: EthSignRequest;
      parsedTx: ParsedTx;
      cid: number | undefined;
    }) => useSimulation(req, parsedTx, cid),
    { initialProps: { req: request, parsedTx: tx, cid: chainId } },
  );
}

// --- tests ---

describe('useSimulation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPhase = 'idle';
    mockResult = null;
    mockUseTenderlyConfig.mockReturnValue({ credentials: null });
    mockSimulate.mockResolvedValue(SUCCESS);
  });

  describe('showSimulationTab', () => {
    it('false when credentials null', () => {
      mockUseTenderlyConfig.mockReturnValue({ credentials: null });
      const { result } = renderSim();
      expect(result.current.showSimulationTab).toBe(false);
    });

    it('false when tx has no to address', () => {
      mockUseTenderlyConfig.mockReturnValue({ credentials: CREDS });
      const { result } = renderSim(REQUEST, TX_NO_TO);
      expect(result.current.showSimulationTab).toBe(false);
    });

    it('false when chainId is undefined', () => {
      mockUseTenderlyConfig.mockReturnValue({ credentials: CREDS });
      const { result } = renderHook(() =>
        useSimulation(REQUEST, TX, undefined),
      );
      expect(result.current.showSimulationTab).toBe(false);
    });

    it('true when credentials set, tx has to, chainId known', () => {
      mockUseTenderlyConfig.mockReturnValue({ credentials: CREDS });
      const { result } = renderSim();
      expect(result.current.showSimulationTab).toBe(true);
    });
  });

  describe('handleSimulate with cached address', () => {
    it('calls simulateTransaction directly', async () => {
      mockUseTenderlyConfig.mockReturnValue({ credentials: CREDS });
      const { result } = renderSim(REQUEST); // REQUEST has address
      await act(async () => {
        result.current.handleSimulate();
      });
      expect(mockSimulate).toHaveBeenCalledWith(
        CREDS,
        expect.objectContaining({ from: REQUEST.address }),
      );
    });

    it('sets simulationState to result on success', async () => {
      mockUseTenderlyConfig.mockReturnValue({ credentials: CREDS });
      const { result } = renderSim();
      await act(async () => {
        result.current.handleSimulate();
      });
      await waitFor(() =>
        expect(result.current.simulationState.phase).toBe('result'),
      );
    });

    it('sets simulationState to error on failure', async () => {
      mockUseTenderlyConfig.mockReturnValue({ credentials: CREDS });
      mockSimulate.mockRejectedValue(new Error('API error 401'));
      const { result } = renderSim();
      await act(async () => {
        result.current.handleSimulate();
      });
      await waitFor(() =>
        expect(result.current.simulationState.phase).toBe('error'),
      );
      expect(
        (result.current.simulationState as { phase: 'error'; message: string })
          .message,
      ).toBe('API error 401');
    });
  });

  describe('handleSimulate without cached address', () => {
    it('calls addressOp.start() when no cached address', () => {
      mockUseTenderlyConfig.mockReturnValue({ credentials: CREDS });
      const { result } = renderSim(REQUEST_NO_ADDR);
      act(() => {
        result.current.handleSimulate();
      });
      expect(mockStart).toHaveBeenCalledTimes(1);
      expect(mockSimulate).not.toHaveBeenCalled();
    });
  });

  describe('handleCancelNfc', () => {
    it('calls cancelAddress', () => {
      const { result } = renderSim();
      act(() => {
        result.current.handleCancelNfc();
      });
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset effect', () => {
    it('resets simulationState to idle when tx.to changes', async () => {
      mockUseTenderlyConfig.mockReturnValue({ credentials: CREDS });
      const { result, rerender } = renderSim(REQUEST, TX);
      // run a simulation to move out of idle
      await act(async () => {
        result.current.handleSimulate();
      });
      await waitFor(() =>
        expect(result.current.simulationState.phase).toBe('result'),
      );
      // change tx.to
      rerender({
        req: REQUEST,
        parsedTx: { ...TX, to: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' },
        cid: 1,
      });
      await waitFor(() =>
        expect(result.current.simulationState.phase).toBe('idle'),
      );
    });
  });

  describe('address-done effect', () => {
    it('caches derived address and runs simulation when addressOp completes', async () => {
      mockUseTenderlyConfig.mockReturnValue({ credentials: CREDS });
      mockPhase = 'done';
      mockResult = '0xDerivedAddress';

      const { result } = renderSim(REQUEST_NO_ADDR);

      await waitFor(() =>
        expect(result.current.simulationState.phase).toBe('result'),
      );
      expect(mockSimulate).toHaveBeenCalledWith(
        CREDS,
        expect.objectContaining({ from: '0xDerivedAddress' }),
      );
    });
  });

  describe('runSimulation guards', () => {
    it('does not call simulateTransaction when credentials null', async () => {
      mockUseTenderlyConfig.mockReturnValue({ credentials: null });
      const { result } = renderSim();
      await act(async () => {
        result.current.handleSimulate();
      });
      expect(mockSimulate).not.toHaveBeenCalled();
    });
  });
});
