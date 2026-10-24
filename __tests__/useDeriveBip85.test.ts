import { act, renderHook } from '@testing-library/react-native';

import {
  UNEXPECTED_BIP85_LENGTH,
  useDeriveBip85,
  type Bip85Request,
} from '../src/hooks/keycard/useDeriveBip85';

type OperationFn = (cmdSet: any, request: Bip85Request) => Promise<any>;

let capturedOperation: OperationFn | null = null;
let capturedOptions: object | null = null;

const mockStart = jest.fn();

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOp: (fn: OperationFn, opts: object) => {
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

function cardAnswering(data: Uint8Array) {
  const checkOK = jest.fn();
  return {
    checkOK,
    cmdSet: {
      exportBIP85: jest.fn().mockResolvedValue({ checkOK, data }),
    },
  };
}

describe('useDeriveBip85', () => {
  beforeEach(() => {
    mockStart.mockClear();
    capturedOperation = null;
    capturedOptions = null;
  });

  it('requires the PIN and a 4.x card, and re-runs from SELECT on a re-tap', () => {
    renderHook(() => useDeriveBip85());

    expect(capturedOptions).toEqual({
      requiresPin: true,
      requiresRoute: 'Bip85',
      retryOnTagLoss: true,
    });
  });

  it('hands the request to the runner', async () => {
    const { result } = renderHook(() => useDeriveBip85());
    await act(async () => {
      result.current.start({ format: 'words12', index: 3 });
    });

    expect(mockStart).toHaveBeenCalledWith({ format: 'words12', index: 3 });
  });

  it('asks the card for the path and length of the format', async () => {
    const data = new Uint8Array(64).fill(7);
    const { cmdSet, checkOK } = cardAnswering(data);
    renderHook(() => useDeriveBip85());

    const entropy = await capturedOperation!(cmdSet, {
      format: 'password',
      index: 12,
    });

    expect(cmdSet.exportBIP85).toHaveBeenCalledWith(
      "m/83696968'/707764'/21'/12'",
      64,
    );
    expect(checkOK).toHaveBeenCalledTimes(1);
    expect(entropy).toBe(data);
  });

  it('refuses an answer of the wrong length', async () => {
    const { cmdSet } = cardAnswering(new Uint8Array(32));
    renderHook(() => useDeriveBip85());

    await expect(
      capturedOperation!(cmdSet, { format: 'xprv', index: 0 }),
    ).rejects.toThrow(UNEXPECTED_BIP85_LENGTH);
  });

  it('passes on a refusal from the card', async () => {
    const checkOK = jest.fn(() => {
      throw new Error('0x6A80');
    });
    const cmdSet = {
      exportBIP85: jest.fn().mockResolvedValue({ checkOK, data: undefined }),
    };
    renderHook(() => useDeriveBip85());

    await expect(
      capturedOperation!(cmdSet, { format: 'hex32', index: 0 }),
    ).rejects.toThrow('0x6A80');
  });
});
