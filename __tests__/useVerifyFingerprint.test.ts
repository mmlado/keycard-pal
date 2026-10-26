import { act, renderHook } from '@testing-library/react-native';

import { useVerifyFingerprint } from '../src/hooks/keycard/useVerifyFingerprint';

type OperationFn = (cmdSet: any, expected: number) => Promise<any>;

let capturedOperation: OperationFn | null = null;
let capturedOptions: { requiresPin?: boolean } | null = null;

const mockStart = jest.fn();
const mockPubKeyFingerprint = jest.fn();
const mockFromTLV = jest.fn();

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

jest.mock('../src/utils/cryptoAccount', () => ({
  pubKeyFingerprint: (...args: any[]) => mockPubKeyFingerprint(...args),
}));

jest.mock('keycard-sdk', () => ({
  BIP32KeyPair: { fromTLV: (...args: any[]) => mockFromTLV(...args) },
}));

const expectedFingerprint = 0xdeadbeef;

describe('useVerifyFingerprint', () => {
  beforeEach(() => {
    mockStart.mockClear();
    mockPubKeyFingerprint.mockClear();
    mockFromTLV.mockClear();
    capturedOperation = null;
    capturedOptions = null;
  });

  it('requires the PIN and re-runs from SELECT on a re-tap', () => {
    renderHook(() => useVerifyFingerprint());

    expect(capturedOptions).toEqual({
      requiresPin: true,
      retryOnTagLoss: true,
      successMessage: 'Compared with Keycard',
    });
  });

  it('hands the expected fingerprint to the runner', async () => {
    const { result } = renderHook(() => useVerifyFingerprint());
    await act(async () => {
      result.current.start(expectedFingerprint);
    });

    expect(mockStart).toHaveBeenCalledWith(expectedFingerprint);
  });

  it('returns match when fingerprints match', async () => {
    const cardPubKey = new Uint8Array([4, 9, 8]);
    mockFromTLV.mockReturnValue({ publicKey: cardPubKey });
    mockPubKeyFingerprint.mockReturnValueOnce(expectedFingerprint);
    const checkOK = jest.fn();
    const cmdSet = {
      exportKey: jest.fn().mockResolvedValue({ checkOK, data: cardPubKey }),
    };
    renderHook(() => useVerifyFingerprint());

    const opResult = await capturedOperation!(cmdSet, expectedFingerprint);

    expect(opResult).toBe('match');
    expect(cmdSet.exportKey).toHaveBeenCalledWith(0, true, 'm', false);
    expect(checkOK).toHaveBeenCalledTimes(1);
  });

  it('returns mismatch when fingerprints differ', async () => {
    mockFromTLV.mockReturnValue({ publicKey: new Uint8Array([4, 9, 8]) });
    mockPubKeyFingerprint.mockReturnValueOnce(2);
    renderHook(() => useVerifyFingerprint());

    const opResult = await capturedOperation!(
      {
        exportKey: jest.fn().mockResolvedValue({
          checkOK: jest.fn(),
          data: new Uint8Array([4, 9, 8]),
        }),
      },
      1,
    );

    expect(opResult).toBe('mismatch');
  });
});
