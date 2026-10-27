import { act, renderHook } from '@testing-library/react-native';

import { useFactoryReset } from '../src/hooks/keycard/useFactoryReset';

import {
  cancelSheet,
  insertCard,
  loseCard,
  mockStartNFC,
  mockStopNFC,
  resetFakeCard,
  tapCard,
  timeOut,
} from './fakeCard.testUtils';

// ---------------------------------------------------------------------------
// The fake card
// ---------------------------------------------------------------------------

jest.mock(
  'react-native-keycard',
  () => require('./fakeCard.testUtils').bridgeModule,
);

const mockFactoryReset = jest.fn();
const mockSelect = jest.fn();
const mockCmdSet = {
  select: mockSelect,
  applicationInfo: { initializedCard: true } as {
    initializedCard: boolean;
  } | null,
  factoryReset: mockFactoryReset,
};

jest.mock('keycard-sdk', () => require('./fakeCard.testUtils').sdkModule());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFactoryReset', () => {
  beforeEach(() => {
    resetFakeCard();
    insertCard(mockCmdSet);
    mockSelect.mockResolvedValue({ sw: 0x9000 });
    mockFactoryReset.mockResolvedValue(undefined);
    mockSelect.mockClear();
    mockFactoryReset.mockClear();
    mockCmdSet.applicationInfo = { initializedCard: true };
  });

  describe('initial state', () => {
    it('starts idle with empty status and null result', () => {
      const { result } = renderHook(() => useFactoryReset());
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
      expect(result.current.result).toBeNull();
    });
  });

  describe('start', () => {
    it('transitions to nfc and calls startNFC', async () => {
      const { result } = renderHook(() => useFactoryReset());
      await act(async () => {
        result.current.start();
      });
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });

    it('sets status to "Tap your Keycard"', async () => {
      const { result } = renderHook(() => useFactoryReset());
      await act(async () => {
        result.current.start();
      });
      expect(result.current.status).toBe('Tap your Keycard');
    });
  });

  // The sheet's "Try again" needs the hook to carry a retry.
  describe('retry', () => {
    it('opens the reader again after an error', async () => {
      mockSelect.mockResolvedValueOnce({ sw: 0x6a82 });
      const { result } = renderHook(() => useFactoryReset());
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        await tapCard();
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
      const { result } = renderHook(() => useFactoryReset());
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
      const { result } = renderHook(() => useFactoryReset());
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
      const { result } = renderHook(() => useFactoryReset());
      await act(async () => {
        result.current.start();
      });
      expect(result.current.phase).toBe('nfc');
      await act(async () => {
        cancelSheet();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('user-cancelled does not change phase when idle', async () => {
      const { result } = renderHook(() => useFactoryReset());
      await act(async () => {
        cancelSheet();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('timeout updates status message when in nfc phase', async () => {
      const { result } = renderHook(() => useFactoryReset());
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        timeOut();
      });
      expect(result.current.status).toBe('Timed out — tap again');
    });

    it('card disconnected during nfc updates status and stays in nfc', async () => {
      const { result } = renderHook(() => useFactoryReset());
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        loseCard();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.status).toBe(
        'Connection lost — hold your Keycard against the phone again',
      );
    });

    it('card disconnected outside nfc does not update status', async () => {
      const { result } = renderHook(() => useFactoryReset());
      await act(async () => {
        loseCard();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
    });
  });

  describe('NFC operation body', () => {
    it('throws when card is not initialized', async () => {
      mockCmdSet.applicationInfo = { initializedCard: false };
      const { result } = renderHook(() => useFactoryReset());
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        await tapCard();
      });

      expect(mockFactoryReset).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toMatch(/already empty/);
    });

    it('calls factoryReset when card is initialized', async () => {
      const { result } = renderHook(() => useFactoryReset());
      await act(async () => {
        result.current.start();
      });
      await act(async () => {
        await tapCard();
      });

      expect(mockFactoryReset).toHaveBeenCalled();
      expect(result.current.phase).toBe('done');
    });
  });
});
