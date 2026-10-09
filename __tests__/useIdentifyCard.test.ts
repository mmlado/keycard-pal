import { act, renderHook } from '@testing-library/react-native';

import {
  UNREADABLE_CARD_STATUS,
  useIdentifyCard,
} from '../src/hooks/keycard/useIdentifyCard';

import { blankV3Select, v3Select, v4Select } from './selectResponse.testUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let capturedOnConnected: ((...args: any[]) => Promise<void>) | null = null;

const mockStartNFC = jest.fn();
const mockStopNFC = jest.fn();
const mockStopNFCWithError = jest.fn();
const mockStopNFCWithMessage = jest.fn();

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
        isError
          ? mockStopNFCWithError(message)
          : message
          ? mockStopNFCWithMessage(message)
          : mockStopNFC(),
      isNFCEnabled: () => Promise.resolve(true),
      openNFCSettings: () => Promise.resolve(true),
      setNFCMessage: () => Promise.resolve(true),
    },
    NFCCardChannel: class {},
  },
}));

// Everything an operation sends after SELECT; the identify tap must reach none of it.
const mockSelect = jest.fn();
const mockAfterSelect = {
  getData: jest.fn(),
  autoPair: jest.fn(),
  autoOpenSecureChannel: jest.fn(),
  verifyPIN: jest.fn(),
  identifyCard: jest.fn(),
};
const mockCmdSet: { select: jest.Mock; applicationInfo: unknown } & Record<
  string,
  unknown
> = {
  select: mockSelect,
  applicationInfo: null,
  ...mockAfterSelect,
};

jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    Commandset: jest.fn().mockImplementation(() => mockCmdSet),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function tap(appInfo: unknown) {
  mockCmdSet.applicationInfo = appInfo;
  const hook = renderHook(() => useIdentifyCard());
  await act(async () => {
    hook.result.current.start();
  });
  await act(async () => {
    await capturedOnConnected?.();
  });
  return hook;
}

beforeEach(() => {
  mockStartNFC.mockReset().mockResolvedValue(undefined);
  mockStopNFC.mockReset().mockResolvedValue(undefined);
  mockStopNFCWithError.mockReset().mockResolvedValue(undefined);
  mockStopNFCWithMessage.mockReset().mockResolvedValue(undefined);
  mockSelect.mockReset().mockResolvedValue({ sw: 0x9000 });
  Object.values(mockAfterSelect).forEach(fn => fn.mockReset());
  mockCmdSet.applicationInfo = null;
  capturedOnConnected = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useIdentifyCard', () => {
  it('starts idle and knows nothing about the card', () => {
    const { result } = renderHook(() => useIdentifyCard());
    expect(result.current.phase).toBe('idle');
    expect(result.current.generation).toBeNull();
    expect(result.current.cardPresence).toBe('waiting');
  });

  it('opens the reader on start', async () => {
    const { result } = renderHook(() => useIdentifyCard());
    await act(async () => {
      result.current.start();
    });
    expect(result.current.phase).toBe('nfc');
    expect(mockStartNFC).toHaveBeenCalledTimes(1);
  });

  describe('what a tap finds', () => {
    it('reads a 3.x card', async () => {
      const { result } = await tap(v3Select(0x0301));
      expect(result.current.phase).toBe('done');
      expect(result.current.generation).toBe('3.1');
    });

    it('reads a 4.0 card', async () => {
      const { result } = await tap(v4Select(0x0400));
      expect(result.current.phase).toBe('done');
      expect(result.current.generation).toBe('4.0');
    });

    // A blank 3.x card reports no version and is still a 3.x card.
    it('reads an uninitialized 3.x card as 3.x', async () => {
      const { result } = await tap(blankV3Select());
      expect(result.current.generation).toBe('3.1');
    });

    it('refuses a card below the floor with the session message', async () => {
      const { result } = await tap(v3Select(0x0300));
      expect(result.current.phase).toBe('error');
      expect(result.current.generation).toBeNull();
      expect(result.current.status).toBe(
        'This Keycard runs applet 3.0. Keycard Pal needs applet 3.1 or newer.',
      );
    });

    it('fails in plain words when the card told it nothing', async () => {
      const { result } = await tap(null);
      expect(result.current.phase).toBe('error');
      expect(result.current.generation).toBeNull();
      expect(result.current.status).toBe(UNREADABLE_CARD_STATUS);
    });
  });

  // SELECT and nothing else.
  it.each([
    ['a 3.x', () => v3Select(0x0302)],
    ['a 4.0', () => v4Select(0x0400)],
  ])('sends %s card nothing beyond SELECT', async (_name, build) => {
    await tap(build());
    expect(mockSelect).toHaveBeenCalledTimes(1);
    for (const command of Object.values(mockAfterSelect)) {
      expect(command).not.toHaveBeenCalled();
    }
  });

  // A read changes nothing, so a lost card is simply tapped again.
  it('waits for a re-tap when the card leaves the field', async () => {
    mockSelect.mockRejectedValueOnce(
      new Error('CardIO Error: Error: Tag was lost.'),
    );
    const { result } = await tap(v3Select(0x0302));
    expect(result.current.phase).toBe('nfc');
    expect(result.current.cardPresence).toBe('lost');
    expect(mockStopNFCWithError).not.toHaveBeenCalled();

    await act(async () => {
      await capturedOnConnected?.();
    });
    expect(result.current.phase).toBe('done');
    expect(result.current.generation).toBe('3.1');
  });

  // Apple's sheet lingers, so the wording must not read as the whole change done.
  it('words the iOS sheet as a read, and promises no next step', async () => {
    await tap(v3Select(0x0302));
    expect(mockStopNFCWithMessage).toHaveBeenCalledWith('Keycard read.');
  });

  // After an error the reader is off, so Try again must reopen it.
  it('restarts the reader through retry after an error', async () => {
    const { result } = await tap(null);
    expect(result.current.phase).toBe('error');
    expect(result.current.retry).toBe(result.current.start);

    mockCmdSet.applicationInfo = v3Select(0x0302);
    await act(async () => {
      result.current.retry();
    });
    expect(mockStartNFC).toHaveBeenCalledTimes(2);
    await act(async () => {
      await capturedOnConnected?.();
    });
    expect(result.current.generation).toBe('3.1');
  });

  it('cancel closes the reader and returns to idle', async () => {
    const { result } = renderHook(() => useIdentifyCard());
    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      result.current.cancel();
    });
    expect(result.current.phase).toBe('idle');
    expect(mockStopNFC).toHaveBeenCalled();
  });
});
