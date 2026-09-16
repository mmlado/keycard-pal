import { act, renderHook } from '@testing-library/react-native';

import { usePairingSlots } from '../src/hooks/keycard/usePairingSlots';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let capturedOnConnected: ((...args: any[]) => Promise<void>) | null = null;

const mockStartNFC = jest.fn();
const mockStopNFC = jest.fn();
const mockStopNFCWithError = jest.fn();

jest.mock('react-native-keycard', () => ({
  __esModule: true,
  default: {
    Core: {
      onKeycardConnected: (cb: (...args: any[]) => Promise<void>) => {
        capturedOnConnected = cb;
        return { remove: jest.fn() };
      },
      onKeycardDisconnected: () => ({ remove: jest.fn() }),
      onNFCUserCancelled: () => ({ remove: jest.fn() }),
      onNFCTimeout: () => ({ remove: jest.fn() }),
      startNFC: (msg: string) => mockStartNFC(msg),
      stopNFC: () => mockStopNFC(),
      stopNFCWithError: (msg: string) => mockStopNFCWithError(msg),
      isNFCEnabled: () => Promise.resolve(true),
      openNFCSettings: () => Promise.resolve(true),
      setNFCMessage: () => Promise.resolve(true),
    },
    NFCCardChannel: class {},
  },
}));

const mockSelect = jest.fn();
const mockApplicationInfo = {
  instanceUID: new Uint8Array([0xab, 0xcd]),
  freePairingSlots: 7,
};
const mockCmdSet = {
  select: mockSelect,
  applicationInfo: mockApplicationInfo,
};

jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    Commandset: jest.fn().mockImplementation(() => mockCmdSet),
  },
}));

const mockLoadPairing = jest.fn();

jest.mock('../src/storage/pairingStorage', () => ({
  loadPairing: (...args: any[]) => mockLoadPairing(...args),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePairingSlots', () => {
  beforeEach(() => {
    mockStartNFC.mockResolvedValue(undefined);
    mockStopNFC.mockResolvedValue(undefined);
    mockStopNFCWithError.mockResolvedValue(undefined);
    mockStartNFC.mockClear();
    mockStopNFC.mockClear();
    mockStopNFCWithError.mockClear();
    mockSelect.mockClear();
    mockSelect.mockResolvedValue({ sw: 0x9000 });
    mockLoadPairing.mockClear();
    mockLoadPairing.mockResolvedValue(null);
    mockCmdSet.applicationInfo = {
      instanceUID: new Uint8Array([0xab, 0xcd]),
      freePairingSlots: 7,
    };
    capturedOnConnected = null;
  });

  describe('initial state', () => {
    it('starts idle with empty status and null slotInfo', () => {
      const { result } = renderHook(() => usePairingSlots());
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
      expect(result.current.slotInfo).toBeNull();
    });
  });

  describe('checkSlots', () => {
    it('transitions to nfc and calls startNFC', async () => {
      const { result } = renderHook(() => usePairingSlots());
      await act(async () => {
        result.current.checkSlots();
      });
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });

    it('reads slot info from SELECT response and loadPairing', async () => {
      mockLoadPairing.mockResolvedValue({ pairingIndex: 3 });
      const { result } = renderHook(() => usePairingSlots());

      await act(async () => {
        result.current.checkSlots();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });

      expect(result.current.phase).toBe('done');
      expect(result.current.slotInfo).toEqual({
        totalSlots: 10,
        freeSlots: 7,
        ourSlotIndex: 3,
        cardKey: 'abcd',
      });
      expect(mockLoadPairing).toHaveBeenCalledWith('abcd');
    });

    it('sets ourSlotIndex to null when no local pairing exists', async () => {
      mockLoadPairing.mockResolvedValue(null);
      const { result } = renderHook(() => usePairingSlots());

      await act(async () => {
        result.current.checkSlots();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });

      expect(result.current.slotInfo?.ourSlotIndex).toBeNull();
    });

    it('transitions to error when SELECT fails', async () => {
      mockSelect.mockResolvedValue({ sw: 0x6a82 });
      const { result } = renderHook(() => usePairingSlots());

      await act(async () => {
        result.current.checkSlots();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });

      expect(result.current.phase).toBe('error');
    });

    it('transitions to error when SELECT response has no application info', async () => {
      (mockCmdSet as any).applicationInfo = null;
      const { result } = renderHook(() => usePairingSlots());

      await act(async () => {
        result.current.checkSlots();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'No application info in SELECT response',
      );
    });

    it('transitions to error when the card is not initialized', async () => {
      (mockCmdSet as any).applicationInfo = { initializedCard: false };
      const { result } = renderHook(() => usePairingSlots());

      await act(async () => {
        result.current.checkSlots();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'This Keycard is not initialized. Initialize it first.',
      );
    });
  });

  describe('cancel', () => {
    it('returns to idle and stops NFC', async () => {
      const { result } = renderHook(() => usePairingSlots());
      await act(async () => {
        result.current.checkSlots();
      });
      await act(async () => {
        result.current.cancel();
      });
      expect(result.current.phase).toBe('idle');
      expect(mockStopNFC).toHaveBeenCalled();
    });
  });

  describe('resetNFCOnly', () => {
    it('stops NFC but keeps slotInfo', async () => {
      mockLoadPairing.mockResolvedValue({ pairingIndex: 1 });
      const { result } = renderHook(() => usePairingSlots());

      await act(async () => {
        result.current.checkSlots();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.slotInfo).not.toBeNull();

      await act(async () => {
        result.current.resetNFCOnly();
      });
      expect(result.current.slotInfo).not.toBeNull();
      expect(mockStopNFC).toHaveBeenCalled();
    });
  });

  describe('readSlotInfoFromCmdSet', () => {
    it('throws when SELECT fails', async () => {
      const { result } = renderHook(() => usePairingSlots());
      const failingCmdSet = {
        select: jest.fn().mockResolvedValue({ sw: 0x6a82 }),
      };
      await expect(
        result.current.readSlotInfoFromCmdSet(failingCmdSet as any),
      ).rejects.toThrow('SELECT failed: 0x6A82');
    });

    it('updates slotInfo when SELECT succeeds', async () => {
      mockLoadPairing.mockResolvedValue({ pairingIndex: 2 });
      const { result } = renderHook(() => usePairingSlots());
      const cmdSet = {
        select: jest.fn().mockResolvedValue({ sw: 0x9000 }),
        applicationInfo: {
          instanceUID: new Uint8Array([0xab, 0xcd]),
          freePairingSlots: 5,
        },
      };
      await act(async () => {
        await result.current.readSlotInfoFromCmdSet(cmdSet as any);
      });
      expect(result.current.slotInfo).toEqual({
        totalSlots: 10,
        freeSlots: 5,
        ourSlotIndex: 2,
        cardKey: 'abcd',
      });
    });
  });

  describe('reset', () => {
    it('clears slotInfo and stops NFC', async () => {
      mockLoadPairing.mockResolvedValue({ pairingIndex: 2 });
      const { result } = renderHook(() => usePairingSlots());

      await act(async () => {
        result.current.checkSlots();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.slotInfo).not.toBeNull();

      await act(async () => {
        result.current.reset();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.slotInfo).toBeNull();
      expect(mockStopNFC).toHaveBeenCalled();
    });
  });

  // T11: the slot read is a read-only SELECT-response read, so it opts into
  // tag-loss retry — a loss keeps the session up and reports presence.
  describe('cardPresence', () => {
    it('starts as waiting', () => {
      const { result } = renderHook(() => usePairingSlots());
      expect(result.current.cardPresence).toBe('waiting');
    });

    it('tag loss during the read keeps phase nfc and reports lost', async () => {
      mockSelect.mockRejectedValueOnce(
        new Error('CardIO Error: Error: Tag was lost.'),
      );
      const { result } = renderHook(() => usePairingSlots());
      await act(async () => {
        result.current.checkSlots();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.cardPresence).toBe('lost');
      expect(mockStopNFCWithError).not.toHaveBeenCalled();
    });

    it('tag loss during a post-unpair re-read follows the same classification', async () => {
      mockLoadPairing.mockResolvedValue({ pairingIndex: 2 });
      const { result } = renderHook(() => usePairingSlots());
      await act(async () => {
        result.current.checkSlots();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('done');

      // readSlotInfoFromCmdSet runs outside the session (live cmdSet after an
      // unpair): a tag loss there rejects to the caller, not the session.
      mockSelect.mockRejectedValueOnce(
        new Error('CardIO Error: Error: Tag was lost.'),
      );
      await expect(
        result.current.readSlotInfoFromCmdSet(mockCmdSet as any),
      ).rejects.toThrow('Tag was lost');
    });
  });
});
