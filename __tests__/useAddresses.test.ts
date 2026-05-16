import { act, renderHook } from '@testing-library/react-native';
import { useAddresses } from '../src/hooks/keycard/useAddresses';

// ---------------------------------------------------------------------------
// Mock useKeycardOperation — captures the operation callback for direct testing
// ---------------------------------------------------------------------------

type OperationFn = (cmdSet: any) => Promise<any>;

let capturedOperation: OperationFn | null = null;
let capturedOptions: { requiresPin?: boolean } | null = null;

const mockStart = jest.fn();

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOp: (fn: OperationFn, opts: { requiresPin?: boolean }) => {
    capturedOperation = fn;
    capturedOptions = opts;
    return {
      phase: 'idle',
      status: '',
      result: null,
      start: mockStart,
      cancel: jest.fn(),
      reset: jest.fn(),
      submitPin: jest.fn(),
    };
  },
}));

// ---------------------------------------------------------------------------
// Mock BIP32KeyPair.extendedKey
// ---------------------------------------------------------------------------

const mockHDKey = {
  publicKey: new Uint8Array(33),
  chainCode: new Uint8Array(32),
};
const mockExtendedKey = jest.fn().mockReturnValue(mockHDKey);

jest.mock('keycard-sdk', () => ({
  BIP32KeyPair: { extendedKey: (...args: any[]) => mockExtendedKey(...args) },
}));

jest.mock('../src/utils/hdAddress', () => ({
  deriveAddresses: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAddresses', () => {
  beforeEach(() => {
    mockStart.mockClear();
    mockExtendedKey.mockClear();
    capturedOperation = null;
    capturedOptions = null;
  });

  describe('start()', () => {
    it('calls execute with requiresPin: true', async () => {
      const { result } = renderHook(() => useAddresses('eth'));
      await act(async () => {
        result.current.start();
      });
      expect(mockStart).toHaveBeenCalledTimes(1);
      expect(capturedOptions).toEqual({ requiresPin: true });
    });
  });

  describe('ETH operation', () => {
    async function runEthOperation(cmdSet: any) {
      const { result } = renderHook(() => useAddresses('eth'));
      await act(async () => {
        result.current.start();
      });
      return capturedOperation!(cmdSet);
    }

    it("calls exportExtendedKey with the ETH path m/44'/60'/0'", async () => {
      const mockCheckOK = jest.fn();
      const mockExport = jest.fn().mockResolvedValue({
        checkOK: mockCheckOK,
        data: new Uint8Array(10),
      });
      await runEthOperation({ exportExtendedKey: mockExport });
      expect(mockExport).toHaveBeenCalledWith(0, "m/44'/60'/0'", false);
    });

    it('calls resp.checkOK()', async () => {
      const mockCheckOK = jest.fn();
      await runEthOperation({
        exportExtendedKey: jest.fn().mockResolvedValue({
          checkOK: mockCheckOK,
          data: new Uint8Array(10),
        }),
      });
      expect(mockCheckOK).toHaveBeenCalled();
    });

    it('calls BIP32KeyPair.extendedKey with the response data', async () => {
      const data = new Uint8Array([1, 2, 3]);
      await runEthOperation({
        exportExtendedKey: jest
          .fn()
          .mockResolvedValue({ checkOK: jest.fn(), data }),
      });
      expect(mockExtendedKey).toHaveBeenCalledWith(data);
    });

    it('returns the HDKey from BIP32KeyPair.extendedKey', async () => {
      const result = await runEthOperation({
        exportExtendedKey: jest.fn().mockResolvedValue({
          checkOK: jest.fn(),
          data: new Uint8Array(10),
        }),
      });
      expect(result).toBe(mockHDKey);
    });
  });

  describe('BTC operation', () => {
    it("calls exportExtendedKey with the BTC path m/84'/0'/0'", async () => {
      const { result } = renderHook(() => useAddresses('btc'));
      await act(async () => {
        result.current.start();
      });
      const mockExport = jest.fn().mockResolvedValue({
        checkOK: jest.fn(),
        data: new Uint8Array(10),
      });
      await capturedOperation!({ exportExtendedKey: mockExport });
      expect(mockExport).toHaveBeenCalledWith(0, "m/84'/0'/0'", false);
    });
  });
});
