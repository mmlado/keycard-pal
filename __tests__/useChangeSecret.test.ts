import { act, renderHook } from '@testing-library/react-native';

import { useChangeSecret } from '../src/hooks/keycard/useChangeSecret';

type OperationFn = (cmdSet: any) => Promise<void>;

let capturedOperation: OperationFn | null = null;
let capturedOptions: {
  requiresPin?: boolean;
  requiresMasterKey?: boolean;
  requiresRoute?: string;
  retryOnTagLoss?: boolean;
  successMessage?: string;
} | null = null;

const mockExecute = jest.fn(
  (
    fn: OperationFn,
    opts: {
      requiresPin?: boolean;
      requiresMasterKey?: boolean;
      requiresRoute?: string;
      retryOnTagLoss?: boolean;
      successMessage?: string;
    },
  ) => {
    capturedOperation = fn;
    capturedOptions = opts;
  },
);

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOperation: () => ({
    phase: 'idle',
    status: '',
    cardName: null,
    result: null,
    pinError: null,
    execute: mockExecute,
    cancel: jest.fn(),
    reset: jest.fn(),
    submitPin: jest.fn(),
    clearPinError: jest.fn(),
    proceedWithNonGenuine: jest.fn(),
  }),
}));

describe('useChangeSecret', () => {
  beforeEach(() => {
    mockExecute.mockClear();
    capturedOperation = null;
    capturedOptions = null;
  });

  it('does not require master key', async () => {
    const { result } = renderHook(() => useChangeSecret('pin'));
    await act(async () => {
      result.current.start('123456');
    });

    expect(capturedOptions).toEqual({
      requiresMasterKey: false,
      successMessage: 'PIN changed',
    });
  });

  // Newer cards have no pairing secret. The screen identifies the card first;
  // this is what stops a different card being tapped the second time.
  it('binds only the pairing secret to cards that have one', async () => {
    const pairing = renderHook(() => useChangeSecret('pairing'));
    await act(async () => {
      pairing.result.current.start('newpassword');
    });
    expect(capturedOptions?.requiresRoute).toBe('ChangePairingSecret');

    for (const secretType of ['pin', 'puk'] as const) {
      const { result } = renderHook(() => useChangeSecret(secretType));
      await act(async () => {
        result.current.start('123456');
      });
      expect(capturedOptions?.requiresRoute).toBeUndefined();
    }
  });

  // A replayed write could land twice, so none of the three may opt in.
  it.each(['pin', 'puk', 'pairing'] as const)(
    'never retries a %s change on tag loss',
    async secretType => {
      const { result } = renderHook(() => useChangeSecret(secretType));
      await act(async () => {
        result.current.start('123456');
      });
      expect(capturedOptions?.retryOnTagLoss).toBeUndefined();
    },
  );

  it('changes PIN', async () => {
    const { result } = renderHook(() => useChangeSecret('pin'));
    await act(async () => {
      result.current.start('123456');
    });

    const checkOK = jest.fn();
    const cmdSet = { changePIN: jest.fn().mockResolvedValue({ checkOK }) };
    await capturedOperation!(cmdSet);

    expect(cmdSet.changePIN).toHaveBeenCalledWith('123456');
    expect(checkOK).toHaveBeenCalledTimes(1);
  });

  it('changes PUK', async () => {
    const { result } = renderHook(() => useChangeSecret('puk'));
    await act(async () => {
      result.current.start('123456789012');
    });

    const checkOK = jest.fn();
    const cmdSet = { changePUK: jest.fn().mockResolvedValue({ checkOK }) };
    await capturedOperation!(cmdSet);

    expect(cmdSet.changePUK).toHaveBeenCalledWith('123456789012');
    expect(checkOK).toHaveBeenCalledTimes(1);
  });

  it('changes pairing password', async () => {
    const { result } = renderHook(() => useChangeSecret('pairing'));
    await act(async () => {
      result.current.start('newpassword');
    });

    const checkOK = jest.fn();
    const cmdSet = {
      changePairingPassword: jest.fn().mockResolvedValue({ checkOK }),
    };
    await capturedOperation!(cmdSet);

    expect(cmdSet.changePairingPassword).toHaveBeenCalledWith('newpassword');
    expect(checkOK).toHaveBeenCalledTimes(1);
  });
});
