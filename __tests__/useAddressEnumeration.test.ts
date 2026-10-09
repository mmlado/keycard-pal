import { act, renderHook } from '@testing-library/react-native';

import { useAddressEnumeration } from '../src/hooks/keycard/useAddressEnumeration';

// ---------------------------------------------------------------------------
// Mock the NFC layer — captures the operation; phase/result are controlled
// per test through mutable variables.
// ---------------------------------------------------------------------------

type OperationFn = (cmdSet: any) => Promise<any>;

let capturedOperation: OperationFn | null = null;
let capturedOptions: { requiresPin?: boolean } | null = null;
let mockPhase = 'idle';
let mockResult: any = null;
const mockStart = jest.fn();

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOp: (fn: OperationFn, opts: { requiresPin?: boolean }) => {
    capturedOperation = fn;
    capturedOptions = opts;
    return {
      phase: mockPhase,
      status: '',
      result: mockResult,
      start: mockStart,
      cancel: jest.fn(),
      reset: jest.fn(),
      submitPin: jest.fn(),
    };
  },
}));

const mockExtendedKey = jest.fn();
jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    BIP32KeyPair: { extendedKey: (...args: any[]) => mockExtendedKey(...args) },
  },
}));

// ---------------------------------------------------------------------------
// Fake HD keys: deriveChild(i) yields a key whose publicKey encodes the full
// child index chain, so an address can be traced back to its derivation.
// ---------------------------------------------------------------------------

function fakeKey(indices: number[]): any {
  return {
    publicKey: new Uint8Array(indices),
    deriveChild: (i: number) => fakeKey([...indices, i]),
  };
}

const addressFn = (pub: Uint8Array) => `addr[${Array.from(pub).join('/')}]`;

const ACCOUNT_PATH = "m/44'/60'/0'";

function renderEnumeration(
  options?: Parameters<typeof useAddressEnumeration>[2],
) {
  return renderHook(() =>
    options === undefined
      ? useAddressEnumeration(ACCOUNT_PATH, addressFn)
      : useAddressEnumeration(ACCOUNT_PATH, addressFn, options),
  );
}

async function completeNfc(
  rerender: () => void,
  accountKey: any = fakeKey([]),
) {
  mockPhase = 'done';
  mockResult = accountKey;
  // Two acts: the first flushes the done-effect (which schedules the batch
  // derivation), the second runs the scheduled timer.
  await act(async () => {
    rerender();
  });
  await act(async () => {
    jest.runAllTimers();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedOperation = null;
  capturedOptions = null;
  mockPhase = 'idle';
  mockResult = null;
});

describe('useAddressEnumeration', () => {
  it('exports the account path over NFC with PIN required', async () => {
    renderEnumeration();
    expect(capturedOptions).toEqual({
      requiresPin: true,
      retryOnTagLoss: true,
    });

    const checkOK = jest.fn();
    const exportExtendedKey = jest
      .fn()
      .mockResolvedValue({ checkOK, data: new Uint8Array([7]) });
    mockExtendedKey.mockReturnValue(fakeKey([]));

    await capturedOperation!({ exportExtendedKey });

    expect(exportExtendedKey).toHaveBeenCalledWith(0, ACCOUNT_PATH, false);
    expect(checkOK).toHaveBeenCalled();
    expect(mockExtendedKey).toHaveBeenCalledWith(new Uint8Array([7]));
  });

  it('each row pairs the address with the path of the same child key', async () => {
    const { result, rerender } = renderEnumeration({ batchSize: 3 });
    await completeNfc(() => rerender({}));

    // hasExternalChain default: enumeration key is accountKey/0, so child i
    // has index chain [0, i] and path accountPath/0/i.
    expect(result.current.rows).toEqual([
      { address: 'addr[0/0]', path: "m/44'/60'/0'/0/0" },
      { address: 'addr[0/1]', path: "m/44'/60'/0'/0/1" },
      { address: 'addr[0/2]', path: "m/44'/60'/0'/0/2" },
    ]);
  });

  it('hasExternalChain: false derives directly off the account key', async () => {
    const { result, rerender } = renderEnumeration({
      hasExternalChain: false,
      batchSize: 2,
    });
    await completeNfc(() => rerender({}));

    expect(result.current.rows).toEqual([
      { address: 'addr[0]', path: "m/44'/60'/0'/0" },
      { address: 'addr[1]', path: "m/44'/60'/0'/1" },
    ]);
  });

  it('loadMore appends the next batch with no gap or overlap', async () => {
    const { result, rerender } = renderEnumeration({ batchSize: 2 });
    await completeNfc(() => rerender({}));
    expect(result.current.rows).toHaveLength(2);

    await act(async () => {
      result.current.loadMore();
      jest.runAllTimers();
    });

    expect(result.current.rows.map(r => r.path)).toEqual([
      "m/44'/60'/0'/0/0",
      "m/44'/60'/0'/0/1",
      "m/44'/60'/0'/0/2",
      "m/44'/60'/0'/0/3",
    ]);
    expect(result.current.rows[3].address).toBe('addr[0/3]');
  });

  it('loadMore is a no-op before the NFC export finished', async () => {
    const { result } = renderEnumeration();
    await act(async () => {
      result.current.loadMore();
      jest.runAllTimers();
    });
    expect(result.current.rows).toEqual([]);
  });

  it('ignores loadMore while a batch is still deriving', async () => {
    const { result, rerender } = renderEnumeration({ batchSize: 2 });
    await completeNfc(() => rerender({}));

    await act(async () => {
      result.current.loadMore();
      result.current.loadMore(); // second call during pending derivation
      jest.runAllTimers();
    });

    // One extra batch, not two.
    expect(result.current.rows).toHaveLength(4);
  });

  it('exposes loading while a batch derives', async () => {
    const { result, rerender } = renderEnumeration({ batchSize: 2 });
    await completeNfc(() => rerender({}));

    act(() => {
      result.current.loadMore();
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      jest.runAllTimers();
    });
    expect(result.current.loading).toBe(false);
  });

  it('returns the underlying NFC operation for the bottom sheet', () => {
    const { result } = renderEnumeration();
    expect(result.current.nfc.start).toBe(mockStart);
    expect(result.current.nfc.phase).toBe('idle');
  });
});
