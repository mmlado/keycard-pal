import { act, renderHook } from '@testing-library/react-native';

import { usePairingSlots } from '../src/hooks/keycard/usePairingSlots';

import { filler, v4Select } from './selectResponse.testUtils';

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
      stopNFC: (message?: string, isError?: boolean) =>
        isError ? mockStopNFCWithError(message) : mockStopNFC(),
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
const mockDeletePairing = jest.fn();

jest.mock('../src/storage/pairingStorage', () => ({
  loadPairing: (...args: any[]) => mockLoadPairing(...args),
  deletePairing: (...args: any[]) => mockDeletePairing(...args),
}));

// The unpair runner, whose PIN and secure channel useKeycardOperation.test.ts covers.
let mockUnpairPhase = 'idle';
const mockExecute = jest.fn();
const mockResetUnpair = jest.fn();
const mockUnpairCancel = jest.fn();

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOperation: () => ({
    phase: mockUnpairPhase,
    status: '',
    cardPresence: 'waiting',
    userCancels: 0,
    result: null,
    execute: mockExecute,
    reset: mockResetUnpair,
    cancel: mockUnpairCancel,
    retry: jest.fn(),
    submitPin: jest.fn(),
    openNFCSettings: undefined,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readSlots(pairingIndex: number | null = 3) {
  mockLoadPairing.mockResolvedValue(
    pairingIndex === null ? null : { pairingIndex },
  );
  const hook = renderHook(() => usePairingSlots());
  await act(async () => {
    hook.result.current.checkSlots();
  });
  await act(async () => {
    await capturedOnConnected?.();
  });
  return hook;
}

/** The card the unpair tap lands on, paired in `ownSlot` by the time the operation runs. */
function unpairCard({ ownSlot = 3, freeSlotsAfter = 8 } = {}) {
  return {
    applicationInfo: {
      instanceUID: new Uint8Array([0xab, 0xcd]),
      freePairingSlots: freeSlotsAfter,
    },
    getPairing: () => ({ pairingIndex: ownSlot }),
    unpair: jest.fn().mockResolvedValue(undefined),
    select: jest.fn().mockResolvedValue({ sw: 0x9000 }),
  };
}

function startUnpair(
  result: ReturnType<
    typeof renderHook<ReturnType<typeof usePairingSlots>, unknown>
  >['result'],
  slotIndex: number,
) {
  act(() => result.current.unpair(slotIndex));
  const [operation, options] = mockExecute.mock.calls.at(-1)!;
  return { operation, options };
}

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
    mockDeletePairing.mockReset();
    mockDeletePairing.mockResolvedValue(undefined);
    mockExecute.mockClear();
    mockResetUnpair.mockClear();
    mockUnpairCancel.mockClear();
    mockUnpairPhase = 'idle';
    mockCmdSet.applicationInfo = {
      instanceUID: new Uint8Array([0xab, 0xcd]),
      freePairingSlots: 7,
    };
    capturedOnConnected = null;
  });

  describe('initial state', () => {
    it('starts with the read idle, empty status and no slots', () => {
      const { result } = renderHook(() => usePairingSlots());
      expect(result.current.noPairingSlots).toBe(false);
      expect(result.current.unpairing).toBe(false);
      expect(result.current.tap.phase).toBe('idle');
      expect(result.current.tap.status).toBe('');
      expect(result.current.slotInfo).toBeNull();
    });

    // The host takes the tap as it is, so the session's fields come with it.
    it("hands over the session's cancel count and NFC settings action", () => {
      const { result } = renderHook(() => usePairingSlots());
      expect(result.current.tap.userCancels).toBe(0);
      expect('openNFCSettings' in result.current.tap).toBe(true);
    });
  });

  describe("the read's retry", () => {
    it('reads the slots again', async () => {
      const { result } = renderHook(() => usePairingSlots());
      await act(async () => {
        result.current.tap.retry();
      });
      expect(result.current.tap.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });
  });

  describe('checkSlots', () => {
    it('transitions to nfc and calls startNFC', async () => {
      const { result } = renderHook(() => usePairingSlots());
      await act(async () => {
        result.current.checkSlots();
      });
      expect(result.current.tap.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });

    it('reads slot info from SELECT response and loadPairing', async () => {
      const { result } = await readSlots(3);

      expect(result.current.tap.phase).toBe('done');
      expect(result.current.slotInfo).toEqual({
        totalSlots: 10,
        freeSlots: 7,
        ourSlotIndex: 3,
        cardKey: 'abcd',
      });
      expect(mockLoadPairing).toHaveBeenCalledWith('abcd');
    });

    it('sets ourSlotIndex to null when no local pairing exists', async () => {
      const { result } = await readSlots(null);
      expect(result.current.slotInfo?.ourSlotIndex).toBeNull();
    });

    it('transitions to error when SELECT fails', async () => {
      mockSelect.mockResolvedValue({ sw: 0x6a82 });
      const { result } = await readSlots();
      expect(result.current.tap.phase).toBe('error');
    });

    it('transitions to error when SELECT response has no application info', async () => {
      (mockCmdSet as any).applicationInfo = null;
      const { result } = await readSlots();
      expect(result.current.tap.phase).toBe('error');
      expect(result.current.tap.status).toBe(
        'Could not read this Keycard. Try again.',
      );
    });

    it('transitions to error when the card is not initialized', async () => {
      (mockCmdSet as any).applicationInfo = { initializedCard: false };
      const { result } = await readSlots();
      expect(result.current.tap.phase).toBe('error');
      expect(result.current.tap.status).toBe(
        'This Keycard is not initialized. Initialize it first.',
      );
    });
  });

  // A 4.0 card has no pairing: an answer, not a failure.
  describe('a card without pairing slots', () => {
    const CERTIFICATE = [...filler(33, 0x02), ...filler(65, 0x09)];

    async function tapCardWithoutSlots() {
      (mockCmdSet as any).applicationInfo = v4Select(0x0400, {
        certificate: CERTIFICATE,
      });
      return readSlots();
    }

    it('ends the read as done, with no slot list', async () => {
      const { result } = await tapCardWithoutSlots();
      expect(result.current.tap.phase).toBe('done');
      expect(result.current.noPairingSlots).toBe(true);
      expect(result.current.slotInfo).toBeNull();
    });

    it('looks up no local pairing for it', async () => {
      await tapCardWithoutSlots();
      expect(mockLoadPairing).not.toHaveBeenCalled();
    });

    // Without a card key it still must not read as uninitialized.
    it('says so even when the card carries no certificate', async () => {
      (mockCmdSet as any).applicationInfo = v4Select(0x0400, {
        certificate: null,
      });
      const { result } = await readSlots();
      expect(result.current.tap.phase).toBe('done');
      expect(result.current.noPairingSlots).toBe(true);
    });

    it('forgets it when another card is about to be read', async () => {
      const { result } = await tapCardWithoutSlots();
      await act(async () => {
        result.current.checkSlots();
      });
      expect(result.current.noPairingSlots).toBe(false);
    });
  });

  describe("the read's cancel", () => {
    it('returns to idle and stops NFC', async () => {
      const { result } = renderHook(() => usePairingSlots());
      await act(async () => {
        result.current.checkSlots();
      });
      await act(async () => {
        result.current.tap.cancel();
      });
      expect(result.current.tap.phase).toBe('idle');
      expect(mockStopNFC).toHaveBeenCalled();
    });
  });

  // The slot read opts into tag-loss retry.
  describe('cardPresence', () => {
    it('starts as waiting', () => {
      const { result } = renderHook(() => usePairingSlots());
      expect(result.current.tap.cardPresence).toBe('waiting');
    });

    it('tag loss during the read keeps phase nfc and reports lost', async () => {
      mockSelect.mockRejectedValueOnce(
        new Error('CardIO Error: Error: Tag was lost.'),
      );
      const { result } = await readSlots();
      expect(result.current.tap.phase).toBe('nfc');
      expect(result.current.tap.cardPresence).toBe('lost');
      expect(mockStopNFCWithError).not.toHaveBeenCalled();
    });
  });

  describe('unpair', () => {
    it('does nothing before the slots have been read', () => {
      const { result } = renderHook(() => usePairingSlots());
      act(() => result.current.unpair(2));
      expect(mockExecute).not.toHaveBeenCalled();
      expect(result.current.unpairing).toBe(false);
    });

    // The slots were read from one card; the unpair tap can land on another.
    it('asks for the PIN and binds the tap to the card that was read', async () => {
      const { result } = await readSlots();
      const { options } = startUnpair(result, 2);
      expect(options).toEqual({
        requiresPin: true,
        requiresMasterKey: false,
        requiresRoute: 'PairingSlots',
        requiresCardKey: 'abcd',
        successMessage: 'Slot 3 was unpaired',
      });
    });

    it('unpairs the slot and re-reads the slots in the same connection', async () => {
      const { result } = await readSlots();
      const { operation } = startUnpair(result, 2);
      const card = unpairCard({ freeSlotsAfter: 8 });

      await act(async () => {
        await operation(card);
      });

      expect(card.unpair).toHaveBeenCalledWith(2);
      expect(card.select).toHaveBeenCalledTimes(1);
      expect(result.current.slotInfo?.freeSlots).toBe(8);
      expect(result.current.unpaired).toBe('Slot 3 was unpaired');
    });

    it('drops its notice when dismissed', async () => {
      const { result } = await readSlots();
      const { operation } = startUnpair(result, 2);
      await act(async () => {
        await operation(unpairCard());
      });

      act(() => result.current.dismissUnpaired());

      expect(result.current.unpaired).toBeNull();
    });

    it("deletes this phone's pairing when the slot is the one the tap used", async () => {
      const { result } = await readSlots(3);
      const { operation } = startUnpair(result, 3);
      await act(async () => {
        await operation(unpairCard({ ownSlot: 3 }));
      });
      expect(mockDeletePairing).toHaveBeenCalledWith('abcd');
    });

    // A card read without a stored pairing gets one from the unpair tap itself.
    it('knows its own slot from the tap, not from the read', async () => {
      const { result } = await readSlots(null);
      const { operation } = startUnpair(result, 4);
      await act(async () => {
        await operation(unpairCard({ ownSlot: 4 }));
      });
      expect(mockDeletePairing).toHaveBeenCalledWith('abcd');
    });

    it("keeps this phone's pairing when another slot is unpaired", async () => {
      const { result } = await readSlots(3);
      const { operation } = startUnpair(result, 1);
      await act(async () => {
        await operation(unpairCard({ ownSlot: 3 }));
      });
      expect(mockDeletePairing).not.toHaveBeenCalled();
    });

    it('still succeeds when the local pairing cannot be deleted', async () => {
      mockDeletePairing.mockRejectedValueOnce(new Error('storage failed'));
      const { result } = await readSlots(3);
      const { operation } = startUnpair(result, 3);
      await act(async () => {
        await operation(unpairCard({ ownSlot: 3 }));
      });
      expect(result.current.unpaired).toBe('Slot 4 was unpaired');
    });

    it('fails when the re-read SELECT fails', async () => {
      const { result } = await readSlots();
      const { operation } = startUnpair(result, 2);
      const card = unpairCard();
      card.select.mockResolvedValue({ sw: 0x6a82 });

      await expect(operation(card)).rejects.toThrow('SELECT failed: 0x6A82');
    });

    // The runner classifies it, as for any operation.
    it('hands a tag loss in the re-read to the runner', async () => {
      const { result } = await readSlots();
      const { operation } = startUnpair(result, 2);
      const card = unpairCard();
      card.select.mockRejectedValue(
        new Error('CardIO Error: Error: Tag was lost.'),
      );

      await expect(operation(card)).rejects.toThrow('Tag was lost');
    });
  });

  describe('the tap under way', () => {
    it('is the unpair from its start until its tap ends, then the read again', async () => {
      const { result, rerender } = await readSlots();
      expect(result.current.tap.cancel).not.toBe(mockUnpairCancel);

      act(() => result.current.unpair(2));
      // Still 'idle' while the runner checks NFC before the PIN pad.
      expect(result.current.unpairing).toBe(true);
      expect(result.current.tap.cancel).toBe(mockUnpairCancel);

      mockUnpairPhase = 'pin_entry';
      rerender({});
      expect(result.current.unpairing).toBe(true);

      mockUnpairPhase = 'idle';
      rerender({});
      expect(result.current.unpairing).toBe(false);
      expect(result.current.tap.cancel).not.toBe(mockUnpairCancel);
      expect(result.current.tap.phase).toBe('done');
    });

    it('resets both taps once the unpair is done, keeping the re-read slots', async () => {
      const { result, rerender } = await readSlots();
      act(() => result.current.unpair(2));
      mockStopNFC.mockClear();

      mockUnpairPhase = 'done';
      rerender({});

      expect(mockResetUnpair).toHaveBeenCalled();
      expect(mockStopNFC).toHaveBeenCalled();
      expect(result.current.slotInfo).not.toBeNull();
    });
  });
});
