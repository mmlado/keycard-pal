import { act, renderHook } from '@testing-library/react-native';

import {
  UNREADABLE_CARD_STATUS,
  useIdentifyCard,
} from '../src/hooks/keycard/useIdentifyCard';

import {
  insertCard,
  mockStartNFC,
  mockStopNFC,
  mockStopNFCWithError,
  mockStopNFCWithMessage,
  resetFakeCard,
  tapCard,
} from './fakeCard.testUtils';
import { blankV3Select, v3Select, v4Select } from './selectResponse.testUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock(
  'react-native-keycard',
  () => require('./fakeCard.testUtils').bridgeModule,
);
jest.mock('keycard-sdk', () => require('./fakeCard.testUtils').sdkModule());

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
    await tapCard();
  });
  return hook;
}

beforeEach(() => {
  resetFakeCard();
  mockSelect.mockReset().mockResolvedValue({ sw: 0x9000 });
  Object.values(mockAfterSelect).forEach(fn => fn.mockReset());
  mockCmdSet.applicationInfo = null;
  insertCard(mockCmdSet);
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
      await tapCard();
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
      await tapCard();
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
