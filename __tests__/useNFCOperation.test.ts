import { act, renderHook } from '@testing-library/react-native';
import { useCallback } from 'react';
import { useNFCOperation } from '../src/hooks/keycard/useNFCOperation';

// ---------------------------------------------------------------------------
// RNKeycard mock — captures event callbacks so tests can trigger them
// ---------------------------------------------------------------------------

let capturedOnConnected: (() => Promise<void>) | null = null;
let capturedOnDisconnected: (() => void) | null = null;
let capturedOnCancelled: (() => void) | null = null;
let capturedOnTimeout: (() => void) | null = null;

const mockStartNFC = jest.fn();
const mockStopNFC = jest.fn();
const mockStopNFCWithError = jest.fn();

jest.mock('react-native-keycard', () => ({
  __esModule: true,
  default: {
    Core: {
      onKeycardConnected: (cb: () => Promise<void>) => {
        capturedOnConnected = cb;
        return { remove: jest.fn() };
      },
      onKeycardDisconnected: (cb: () => void) => {
        capturedOnDisconnected = cb;
        return { remove: jest.fn() };
      },
      onNFCUserCancelled: (cb: () => void) => {
        capturedOnCancelled = cb;
        return { remove: jest.fn() };
      },
      onNFCTimeout: (cb: () => void) => {
        capturedOnTimeout = cb;
        return { remove: jest.fn() };
      },
      startNFC: (msg: string) => mockStartNFC(msg),
      stopNFC: (message?: string, isError?: boolean) =>
        isError ? mockStopNFCWithError(message) : mockStopNFC(),
      isNFCEnabled: () => Promise.resolve(true),
      openNFCSettings: () => Promise.resolve(true),
      setNFCMessage: () => Promise.resolve(true),
    },
    NFCCardChannel: class {},
  },
}));

jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    Commandset: class {
      select = jest.fn().mockResolvedValue({ sw: 0x9000 });
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useNFCOperation', () => {
  beforeEach(() => {
    mockStartNFC.mockResolvedValue(undefined);
    mockStopNFC.mockResolvedValue(undefined);
    mockStopNFCWithError.mockResolvedValue(undefined);
    mockStartNFC.mockClear();
    mockStopNFC.mockClear();
    mockStopNFCWithError.mockClear();
    capturedOnConnected = null;
    capturedOnDisconnected = null;
    capturedOnCancelled = null;
    capturedOnTimeout = null;
  });

  describe('initial state', () => {
    it('starts idle with empty status and null result', () => {
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(async () => 'ok', [])),
      );
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
      expect(result.current.result).toBeNull();
    });

    it('hands back its success message, for the screen to show after the tap', () => {
      const { result } = renderHook(() =>
        useNFCOperation(
          useCallback(async () => 'ok', []),
          { successMessage: 'Card reset' },
        ),
      );
      expect(result.current.successMessage).toBe('Card reset');
    });
  });

  describe('start', () => {
    it('transitions to nfc and calls startNFC', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(async () => 'ok', [])),
      );
      await act(async () => {
        result.current.start();
      });
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });

    it('sets status to "Tap your Keycard"', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(async () => 'ok', [])),
      );
      await act(async () => {
        result.current.start();
      });
      expect(result.current.status).toBe('Tap your Keycard');
    });
  });

  describe('cancel', () => {
    it('returns to idle, clears status, and stops NFC', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(async () => 'ok', [])),
      );
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        result.current.cancel();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
      expect(mockStopNFC).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('returns to idle, clears result, and stops NFC', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(async () => 'ok', [])),
      );
      await act(async () => {
        result.current.reset();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
      expect(result.current.result).toBeNull();
      expect(mockStopNFC).toHaveBeenCalled();
    });
  });

  describe('NFC events', () => {
    it('user-cancelled resets to idle when in nfc phase', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(async () => 'ok', [])),
      );
      await act(async () => {
        result.current.start();
      });
      expect(result.current.phase).toBe('nfc');
      await act(async () => {
        capturedOnCancelled?.();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('user-cancelled does not change phase when idle', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(async () => 'ok', [])),
      );
      await act(async () => {
        capturedOnCancelled?.();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('timeout updates status message when in nfc phase', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(async () => 'ok', [])),
      );
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        capturedOnTimeout?.();
      });
      expect(result.current.status).toBe('Timed out — tap again');
    });

    it('card disconnected during nfc updates status and stays in nfc', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(async () => 'ok', [])),
      );
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        capturedOnDisconnected?.();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.cardPresence).toBe('lost');
      expect(result.current.status).toBe(
        'Connection lost — hold your Keycard against the phone again',
      );
    });

    it('card disconnected outside nfc does not update status', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(async () => 'ok', [])),
      );
      await act(async () => {
        capturedOnDisconnected?.();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
    });
  });

  describe('successful operation', () => {
    it('stores the operation result and finishes', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(async () => 'ok', [])),
      );
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('done');
      expect(result.current.result).toBe('ok');
    });
  });

  // After an error the reader is off; the sheet offers "Try again" only when given this.
  describe('retry', () => {
    it('opens the reader again after an error and runs the operation', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Invalid MAC'))
        .mockResolvedValue('ok');
      const { result } = renderHook(() =>
        useNFCOperation(useCallback(() => operation(), [])),
      );
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('error');
      mockStartNFC.mockClear();

      await act(async () => {
        result.current.retry();
      });
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledTimes(1);

      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('done');
      expect(result.current.result).toBe('ok');
    });
  });

  describe('cancellation mid-operation', () => {
    it('does not set result when cancelled while the operation is in flight', async () => {
      let resolveOp: ((v: string) => void) | null = null;
      const { result } = renderHook(() =>
        useNFCOperation(
          useCallback(
            () =>
              new Promise<string>(resolve => {
                resolveOp = resolve;
              }),
            [],
          ),
        ),
      );
      await act(async () => {
        result.current.start();
      });
      let connectPromise: Promise<void> | undefined;
      act(() => {
        connectPromise = capturedOnConnected?.();
      });
      // Let SELECT resolve, so the operation is entered before the cancel arrives.
      await act(async () => {});
      expect(resolveOp).not.toBeNull();
      await act(async () => {
        result.current.cancel();
      });
      await act(async () => {
        resolveOp?.('late');
        await connectPromise;
      });
      expect(result.current.result).toBeNull();
    });

    // Cancel on Apple's sheet or ours while a command is out: the command then fails.
    it('reopens no error sheet when the operation fails after cancel', async () => {
      let rejectOp: ((e: Error) => void) | null = null;
      const { result } = renderHook(() =>
        useNFCOperation(
          useCallback(
            () =>
              new Promise<string>((_, reject) => {
                rejectOp = reject;
              }),
            [],
          ),
        ),
      );
      await act(async () => {
        result.current.start();
      });
      let connectPromise: Promise<void> | undefined;
      act(() => {
        connectPromise = capturedOnConnected?.();
      });
      await act(async () => {});
      expect(rejectOp).not.toBeNull();
      await act(async () => {
        result.current.cancel();
      });
      await act(async () => {
        rejectOp?.(new Error('NFCError:100'));
        await connectPromise;
      });

      expect(result.current.phase).toBe('idle');
      expect(mockStopNFCWithError).not.toHaveBeenCalled();
    });

    // Before the screen has reacted to Apple's Cancel with a reset.
    it("reopens no error sheet when the operation fails after Apple's Cancel", async () => {
      let rejectOp: ((e: Error) => void) | null = null;
      const { result } = renderHook(() =>
        useNFCOperation(
          useCallback(
            () =>
              new Promise<string>((_, reject) => {
                rejectOp = reject;
              }),
            [],
          ),
        ),
      );
      await act(async () => {
        result.current.start();
      });
      let connectPromise: Promise<void> | undefined;
      act(() => {
        connectPromise = capturedOnConnected?.();
      });
      await act(async () => {});
      expect(rejectOp).not.toBeNull();
      await act(async () => {
        capturedOnCancelled?.();
      });
      await act(async () => {
        rejectOp?.(new Error('NFCError:100'));
        await connectPromise;
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.userCancels).toBe(1);
      expect(mockStopNFCWithError).not.toHaveBeenCalled();
    });
  });

  // retryOnTagLoss defaults to false.
  describe('retryOnTagLoss option', () => {
    const TAG_LOST = 'CardIO Error: Error: Tag was lost.';

    it('defaults to false when omitted: tag loss is an error', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(
          useCallback(async () => {
            throw new Error(TAG_LOST);
          }, []),
        ),
      );
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'Connection lost mid-operation. Check the card state before retrying.',
      );
    });

    it('opted in: tag loss keeps the session waiting', async () => {
      const { result } = renderHook(() =>
        useNFCOperation(
          useCallback(async () => {
            throw new Error(TAG_LOST);
          }, []),
          { retryOnTagLoss: true },
        ),
      );
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.cardPresence).toBe('lost');
    });
  });

  describe('the input', () => {
    function renderWithInput(operation: jest.Mock) {
      return renderHook(() =>
        useNFCOperation<string, string>(
          useCallback(
            (_cmdSet, _setStatus, _card, input) => operation(input),
            [],
          ),
        ),
      );
    }

    async function tap() {
      await act(async () => {
        await capturedOnConnected?.();
      });
    }

    it('reaches the operation, and the operation again on retry', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('refused'))
        .mockResolvedValue('ok');
      const { result } = renderWithInput(operation);
      await act(async () => {
        result.current.start('input');
      });
      await tap();
      await act(async () => {
        result.current.retry();
      });
      await tap();

      expect(operation.mock.calls).toEqual([['input'], ['input']]);
      expect(result.current.result).toBe('ok');
    });

    it('is gone once the operation succeeds', async () => {
      const { result } = renderWithInput(jest.fn().mockResolvedValue('ok'));
      await act(async () => {
        result.current.start('input');
      });
      await tap();
      mockStartNFC.mockClear();

      await act(async () => {
        result.current.retry();
      });

      expect(mockStartNFC).not.toHaveBeenCalled();
    });

    it.each(['cancel', 'reset'] as const)('is gone after %s', async ending => {
      const { result } = renderWithInput(
        jest.fn().mockRejectedValue(new Error('refused')),
      );
      await act(async () => {
        result.current.start('input');
      });
      await tap();
      await act(async () => {
        result.current[ending]();
      });
      mockStartNFC.mockClear();

      await act(async () => {
        result.current.retry();
      });

      expect(mockStartNFC).not.toHaveBeenCalled();
    });
  });
});
