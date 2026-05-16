import { act, renderHook } from '@testing-library/react-native';

import { useGenerateSlip39Shares } from '../src/hooks/keycard/useGenerateSlip39Shares';

type OperationFn = (cmdSet: any, helpers: any) => Promise<Uint8Array>;

let capturedOperation: OperationFn | null = null;
let capturedOptions: {
  requiresPin?: boolean;
  requiresMasterKey?: boolean;
} | null = null;

const mockStart = jest.fn();

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOp: (
    fn: OperationFn,
    opts: { requiresPin?: boolean; requiresMasterKey?: boolean },
  ) => {
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

describe('useGenerateSlip39Shares', () => {
  beforeEach(() => {
    mockStart.mockClear();
    capturedOperation = null;
    capturedOptions = null;
  });

  it('reads Keycard entropy without requiring PIN', async () => {
    const { result } = renderHook(() => useGenerateSlip39Shares(3, 2));
    await act(async () => {
      result.current.start();
    });

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(capturedOptions).toEqual({
      requiresPin: false,
      requiresMasterKey: false,
    });

    const entropy = new Uint8Array([1, 2, 3]);
    const checkOK = jest.fn();
    const setStatus = jest.fn();
    const opResult = await capturedOperation!(
      {
        generateMnemonic: jest.fn().mockResolvedValue({
          data: entropy,
          checkOK,
        }),
      },
      { setStatus },
    );

    expect(setStatus).toHaveBeenCalledWith('Reading Keycard entropy...');
    expect(checkOK).toHaveBeenCalledTimes(1);
    expect(opResult).toBe(entropy);
  });

  it('validates generation settings before requesting NFC', () => {
    const { result } = renderHook(() => useGenerateSlip39Shares(3, 1));

    expect(() => result.current.start()).toThrow(/at least 2/);
    expect(mockStart).not.toHaveBeenCalled();
  });
});
