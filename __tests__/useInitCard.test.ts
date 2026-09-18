import { act, renderHook } from '@testing-library/react-native';
import { useInitCard } from '../src/hooks/keycard/useInitCard';

// ---------------------------------------------------------------------------
// RNKeycard mock — captures event callbacks so tests can trigger them
// ---------------------------------------------------------------------------

let capturedOnConnected: ((...args: any[]) => Promise<void>) | null = null;
let capturedOnDisconnected: (() => void) | null = null;
let capturedOnCancelled: (() => void) | null = null;
let capturedOnTimeout: (() => void) | null = null;

const mockStartNFC = jest.fn();
const mockStopNFC = jest.fn();
const mockStopNFCWithMessage = jest.fn();
const mockStopNFCWithError = jest.fn();

jest.mock('react-native-keycard', () => ({
  __esModule: true,
  default: {
    Core: {
      onKeycardConnected: (cb: (...args: any[]) => Promise<void>) => {
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
      stopNFC: () => mockStopNFC(),
      stopNFCWithError: (msg: string) => mockStopNFCWithError(msg),
      stopNFCWithMessage: (msg: string) => mockStopNFCWithMessage(msg),
      isNFCEnabled: () => Promise.resolve(true),
      openNFCSettings: () => Promise.resolve(true),
      setNFCMessage: () => Promise.resolve(true),
    },
    NFCCardChannel: class {},
  },
}));

const mockInit = jest.fn();
const mockSelect = jest.fn();
const mockCmdSet = {
  select: mockSelect,
  applicationInfo: { initializedCard: false } as {
    initializedCard: boolean;
  } | null,
  init: mockInit,
};

jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    Commandset: jest.fn().mockImplementation(() => mockCmdSet),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useInitCard', () => {
  beforeEach(() => {
    mockStartNFC.mockResolvedValue(undefined);
    mockStopNFC.mockResolvedValue(undefined);
    mockStopNFCWithMessage.mockResolvedValue(undefined);
    mockStopNFCWithError.mockResolvedValue(undefined);
    mockSelect.mockResolvedValue({ sw: 0x9000 });
    mockInit.mockResolvedValue(undefined);
    mockStartNFC.mockClear();
    mockStopNFC.mockClear();
    mockStopNFCWithMessage.mockClear();
    mockStopNFCWithError.mockClear();
    mockSelect.mockClear();
    mockInit.mockClear();
    mockCmdSet.applicationInfo = { initializedCard: false };
    capturedOnConnected = null;
    capturedOnDisconnected = null;
    capturedOnCancelled = null;
    capturedOnTimeout = null;
  });

  describe('initial state', () => {
    it('starts idle with empty status and no result', () => {
      const { result } = renderHook(() => useInitCard());
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
      expect(result.current.result).toBeNull();
    });
  });

  describe('start', () => {
    it('transitions to nfc and calls startNFC', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });

    it('sets status to "Tap your Keycard"', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      expect(result.current.status).toBe('Tap your Keycard');
    });
  });

  // The screen hands this hook to the NFC sheet as it is, so the sheet's
  // "Try again" exists only if the hook carries a retry.
  describe('retry', () => {
    it('opens the reader again after an error', async () => {
      mockSelect.mockResolvedValueOnce({ sw: 0x6a82 });
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
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
    });
  });

  describe('cancel', () => {
    it('returns to idle, clears status, and stops NFC', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
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
      const { result } = renderHook(() => useInitCard());
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
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      expect(result.current.phase).toBe('nfc');

      await act(async () => {
        capturedOnCancelled?.();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('user-cancelled does not change phase when idle', async () => {
      const { result } = renderHook(() => useInitCard());
      expect(result.current.phase).toBe('idle');
      await act(async () => {
        capturedOnCancelled?.();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('timeout updates status message when in nfc phase', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      await act(async () => {
        capturedOnTimeout?.();
      });
      expect(result.current.status).toBe('Timed out — tap again');
    });

    it('card disconnected during nfc updates status and stays in nfc', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      await act(async () => {
        capturedOnDisconnected?.();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.status).toBe(
        'Connection lost — hold your Keycard against the phone again',
      );
    });

    it('card disconnected outside nfc does not update status', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        capturedOnDisconnected?.();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
    });
  });

  describe('NFC operation body', () => {
    it('throws when card is already initialized', async () => {
      mockCmdSet.applicationInfo = { initializedCard: true };
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      await act(async () => {
        await capturedOnConnected?.();
      });

      expect(mockInit).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toMatch(/already set up/);
    });

    it('calls init with pin and pairing password when card is blank', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      await act(async () => {
        await capturedOnConnected?.();
      });

      expect(mockInit).toHaveBeenCalledWith(
        '123456',
        expect.stringMatching(/^\d{12}$/),
        expect.anything(),
        undefined,
      );
      expect(result.current.phase).toBe('done');
      expect(result.current.result).toMatch(/^\d{12}$/);
    });

    it('passes duress pin when provided', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456', '000000');
      });
      await act(async () => {
        await capturedOnConnected?.();
      });

      expect(mockInit).toHaveBeenCalledWith(
        '123456',
        expect.stringMatching(/^\d{12}$/),
        expect.anything(),
        '000000',
      );
    });
  });
});
