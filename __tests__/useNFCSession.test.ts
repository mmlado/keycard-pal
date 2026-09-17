import { act, renderHook } from '@testing-library/react-native';
import { useCallback } from 'react';
import { AppState } from 'react-native';
import useNFCSession, {
  CARD_MOVED_STATUS,
} from '../src/hooks/keycard/useNFCSession';
import {
  getLastTappedGeneration,
  resetLastTappedGeneration,
} from '../src/utils/lastTappedGeneration';

const ANDROID_TAG_LOST = 'CardIO Error: Error: Tag was lost.';
const IOS_TAG_LOST = 'CardIO Error: Error: NFCError:100';

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
const mockStopNFCWithMessage = jest.fn();
const mockIsNFCEnabled = jest.fn();
const mockOpenNFCSettings = jest.fn();
const mockSetNFCMessage = jest.fn();

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
      stopNFC: () => mockStopNFC(),
      stopNFCWithError: (msg: string) => mockStopNFCWithError(msg),
      stopNFCWithMessage: (msg: string) => mockStopNFCWithMessage(msg),
      isNFCEnabled: () => mockIsNFCEnabled(),
      openNFCSettings: () => mockOpenNFCSettings(),
      setNFCMessage: (msg: string) => mockSetNFCMessage(msg),
    },
    NFCCardChannel: class {},
  },
}));

const mockSelect = jest.fn();

jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    Commandset: class {
      select = mockSelect;
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// AppState.addEventListener is a jest.fn() in the RN jest preset.
let capturedAppStateListener: ((state: string) => void) | null = null;

describe('useNFCSession', () => {
  let mockOnCardConnected: jest.Mock;
  let mockOnCardDisconnected: jest.Mock;

  beforeEach(() => {
    mockStartNFC.mockResolvedValue(undefined);
    mockStopNFC.mockResolvedValue(undefined);
    mockStopNFCWithError.mockResolvedValue(undefined);
    mockStopNFCWithMessage.mockResolvedValue(undefined);
    mockIsNFCEnabled.mockResolvedValue(true);
    mockOpenNFCSettings.mockResolvedValue(true);
    mockSetNFCMessage.mockResolvedValue(true);
    mockSelect.mockResolvedValue({ sw: 0x9000 });
    mockStartNFC.mockClear();
    mockStopNFC.mockClear();
    mockStopNFCWithError.mockClear();
    mockStopNFCWithMessage.mockClear();
    mockIsNFCEnabled.mockClear();
    mockOpenNFCSettings.mockClear();
    mockSetNFCMessage.mockClear();
    mockSelect.mockClear();
    mockOnCardConnected = jest.fn().mockResolvedValue(undefined);
    mockOnCardDisconnected = jest.fn().mockResolvedValue(undefined);
    capturedOnConnected = null;
    capturedOnDisconnected = null;
    capturedOnCancelled = null;
    capturedOnTimeout = null;
    capturedAppStateListener = null;
    (AppState.addEventListener as jest.Mock).mockImplementation(
      (_event: string, cb: (state: string) => void) => {
        capturedAppStateListener = cb;
        return { remove: jest.fn() };
      },
    );
  });

  function makeHook(options?: {
    onNFCAvailable?: () => void;
    retryOnTagLoss?: boolean;
    successMessage?: string;
  }) {
    return renderHook(() =>
      useNFCSession(
        useCallback(mockOnCardConnected, []),
        useCallback(mockOnCardDisconnected, []),
        options,
      ),
    );
  }

  describe('initial state', () => {
    it('starts idle with empty status', () => {
      const { result } = makeHook();
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
    });
  });

  describe('startNFC', () => {
    it('transitions to nfc and calls startNFC', async () => {
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.status).toBe('Tap your Keycard');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });

    it('sets error when startNFC returns isSuccess:false', async () => {
      mockStartNFC.mockResolvedValue({ isSuccess: false });
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {});
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'Failed to start NFC reader. Try again.',
      );
    });

    it('sets error when startNFC rejects', async () => {
      mockStartNFC.mockRejectedValue(new Error('NFC unavailable'));
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {});
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'Failed to start NFC: NFC unavailable',
      );
    });

    it('handles non-Error rejection from startNFC', async () => {
      mockStartNFC.mockRejectedValue('timeout');
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {});
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe('Failed to start NFC: timeout');
    });

    it('sets error and does not open NFC when isNFCEnabled returns false on Android', async () => {
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'android';
      try {
        mockIsNFCEnabled.mockResolvedValue(false);
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {});
        expect(result.current.phase).toBe('error');
        expect(result.current.status).toBe(
          'NFC is turned off. Enable it in Settings to continue.',
        );
        expect(mockStartNFC).not.toHaveBeenCalled();
        expect(result.current.openNFCSettings).toBeDefined();
      } finally {
        Platform.OS = origOS;
      }
    });

    it('openNFCSettings is undefined on iOS when NFC is disabled', async () => {
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'ios';
      try {
        mockIsNFCEnabled.mockResolvedValue(false);
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {});
        expect(result.current.phase).toBe('error');
        expect(result.current.openNFCSettings).toBeUndefined();
      } finally {
        Platform.OS = origOS;
      }
    });

    it('proceeds normally when isNFCEnabled check throws', async () => {
      mockIsNFCEnabled.mockRejectedValue(new Error('check failed'));
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {});
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });
  });

  describe('AppState NFC re-check', () => {
    it('clears nfcDisabled and restarts NFC (default) when NFC becomes available', async () => {
      mockIsNFCEnabled.mockResolvedValue(false);
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'android';
      try {
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {});
        expect(result.current.phase).toBe('error');
        expect(result.current.openNFCSettings).toBeDefined();

        mockIsNFCEnabled.mockResolvedValue(true);
        await act(async () => {
          capturedAppStateListener?.('active');
        });
        await act(async () => {});

        expect(result.current.openNFCSettings).toBeUndefined();
        expect(result.current.phase).toBe('nfc');
        expect(result.current.status).toBe('Tap your Keycard');
        // doStartNFC only fires after re-enable (not during the initial disabled check)
        expect(mockStartNFC).toHaveBeenCalledTimes(1);
      } finally {
        Platform.OS = origOS;
      }
    });

    it('calls the onNFCAvailable option instead of restarting NFC when one is set', async () => {
      mockIsNFCEnabled.mockResolvedValue(false);
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'android';
      try {
        const customHandler = jest.fn();
        const { result } = makeHook({ onNFCAvailable: customHandler });

        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {});
        expect(result.current.phase).toBe('error');

        mockIsNFCEnabled.mockResolvedValue(true);
        await act(async () => {
          capturedAppStateListener?.('active');
        });
        await act(async () => {});

        expect(customHandler).toHaveBeenCalledTimes(1);
        expect(mockStartNFC).not.toHaveBeenCalled(); // NFC was disabled, custom handler ran instead
      } finally {
        Platform.OS = origOS;
      }
    });

    it('does not change state when app foregrounds but NFC is still disabled', async () => {
      mockIsNFCEnabled.mockResolvedValue(false);
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'android';
      try {
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {});
        expect(result.current.phase).toBe('error');

        await act(async () => {
          capturedAppStateListener?.('active');
        });
        await act(async () => {});

        expect(result.current.openNFCSettings).toBeDefined();
        expect(result.current.status).toBe(
          'NFC is turned off. Enable it in Settings to continue.',
        );
      } finally {
        Platform.OS = origOS;
      }
    });

    it('ignores AppState changes to non-active states while NFC is disabled', async () => {
      mockIsNFCEnabled.mockResolvedValue(false);
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'android';
      try {
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {});
        expect(result.current.phase).toBe('error');

        mockIsNFCEnabled.mockResolvedValue(true);
        mockStartNFC.mockClear();

        await act(async () => {
          capturedAppStateListener?.('background');
        });
        await act(async () => {});

        expect(result.current.phase).toBe('error');
        expect(mockStartNFC).not.toHaveBeenCalled();
      } finally {
        Platform.OS = origOS;
      }
    });

    it('does not crash when isNFCEnabled throws in AppState change handler', async () => {
      mockIsNFCEnabled.mockResolvedValue(false);
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'android';
      try {
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {});
        expect(result.current.phase).toBe('error');

        mockIsNFCEnabled.mockRejectedValue(new Error('check failed'));

        await act(async () => {
          capturedAppStateListener?.('active');
        });
        await act(async () => {});

        expect(result.current.phase).toBe('error');
        expect(result.current.openNFCSettings).toBeDefined();
      } finally {
        Platform.OS = origOS;
      }
    });

    it('does not register AppState listener when NFC is enabled', async () => {
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {});
      expect(result.current.phase).toBe('nfc');
      expect(capturedAppStateListener).toBeNull();
    });
  });

  describe('startNFC generation guard', () => {
    it('ignores stale isNFCEnabled callback when reset fires before it resolves', async () => {
      let resolveEnabled!: (v: boolean) => void;
      mockIsNFCEnabled.mockReturnValue(
        new Promise<boolean>(res => {
          resolveEnabled = res;
        }),
      );

      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      expect(result.current.phase).toBe('nfc');

      // Reset before the isNFCEnabled promise resolves — bumps the generation
      await act(async () => {
        result.current.reset();
      });
      expect(result.current.phase).toBe('idle');

      // Stale callback resolves (NFC is enabled) — must not call doStartNFC
      mockStartNFC.mockClear();
      await act(async () => {
        resolveEnabled(true);
      });
      await act(async () => {});

      expect(result.current.phase).toBe('idle');
      expect(mockStartNFC).not.toHaveBeenCalled();
    });

    it('ignores stale isNFCEnabled callback when a second startNFC fires before first resolves', async () => {
      let resolveFirst!: (v: boolean) => void;
      mockIsNFCEnabled
        .mockReturnValueOnce(
          new Promise<boolean>(res => {
            resolveFirst = res;
          }),
        )
        .mockResolvedValue(true);

      const { result } = makeHook();

      // First startNFC — isNFCEnabled hangs
      await act(async () => {
        result.current.startNFC();
      });

      // Second startNFC — bumps generation
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {}); // flush second isNFCEnabled (resolves true)
      expect(result.current.phase).toBe('nfc');

      mockStartNFC.mockClear();

      // First stale callback now resolves (also enabled) — must not call doStartNFC again
      await act(async () => {
        resolveFirst(true);
      });
      await act(async () => {});

      expect(mockStartNFC).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('returns to idle and stops NFC', async () => {
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        result.current.reset();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
      expect(mockStopNFC).toHaveBeenCalled();
    });

    it('clears openNFCSettings on reset', async () => {
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'android';
      try {
        mockIsNFCEnabled.mockResolvedValue(false);
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {});
        expect(result.current.openNFCSettings).toBeDefined();
        await act(async () => {
          result.current.reset();
        });
        expect(result.current.openNFCSettings).toBeUndefined();
      } finally {
        Platform.OS = origOS;
      }
    });
  });

  describe('phase guard — card connected', () => {
    it('ignores card connected when phase is idle', async () => {
      const { result } = makeHook();
      expect(result.current.phase).toBe('idle');
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(mockOnCardConnected).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('idle');
    });

    // Apple's sheet outlives the app's own toast, so the operation's wording
    // goes there too rather than relying on the generic "Success".
    describe('success message on the iOS sheet', () => {
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;

      afterEach(() => {
        Platform.OS = origOS;
      });

      async function runToDone(options?: { successMessage?: string }) {
        const { result } = makeHook(options);
        mockOnCardConnected.mockResolvedValue(undefined);
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {
          await capturedOnConnected?.();
        });
        expect(result.current.phase).toBe('done');
      }

      it('words the sheet with the operation message on iOS', async () => {
        Platform.OS = 'ios';
        await runToDone({ successMessage: 'Factory reset done' });
        expect(mockStopNFCWithMessage).toHaveBeenCalledWith(
          'Factory reset done',
        );
        expect(mockStopNFC).not.toHaveBeenCalled();
      });

      it('falls back to plain stopNFC when no message is set', async () => {
        Platform.OS = 'ios';
        await runToDone();
        expect(mockStopNFC).toHaveBeenCalled();
        expect(mockStopNFCWithMessage).not.toHaveBeenCalled();
      });

      it('does not word the sheet on Android, which has none', async () => {
        Platform.OS = 'android';
        await runToDone({ successMessage: 'Factory reset done' });
        expect(mockStopNFC).toHaveBeenCalled();
        expect(mockStopNFCWithMessage).not.toHaveBeenCalled();
      });
    });

    it('ignores card connected when phase is done', async () => {
      const { result } = makeHook();
      mockOnCardConnected.mockResolvedValue(undefined);
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('done');

      mockOnCardConnected.mockClear();
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(mockOnCardConnected).not.toHaveBeenCalled();
    });

    it('retries card connected when phase is error', async () => {
      const { result } = makeHook();
      mockOnCardConnected.mockRejectedValueOnce(new Error('fail'));
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('error');

      mockOnCardConnected.mockResolvedValueOnce(undefined);
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(mockOnCardConnected).toHaveBeenCalledTimes(2);
      expect(result.current.phase).toBe('done');
    });

    it('ignores a second card connected event while an operation is in flight', async () => {
      const { result } = makeHook();
      let resolveFirst!: () => void;
      const firstOpPromise = new Promise<void>(resolve => {
        resolveFirst = resolve;
      });
      mockOnCardConnected.mockImplementationOnce(() => firstOpPromise);
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        capturedOnConnected?.();
        await capturedOnConnected?.();
      });
      expect(mockOnCardConnected).toHaveBeenCalledTimes(1);
      await act(async () => {
        resolveFirst();
      });
      expect(result.current.phase).toBe('done');
    });

    it('handles card connected when phase is nfc', async () => {
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      expect(result.current.phase).toBe('nfc');
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(mockOnCardConnected).toHaveBeenCalledTimes(1);
      expect(result.current.phase).toBe('done');
    });

    it('sets error phase when onCardConnected throws', async () => {
      const { result } = makeHook();
      mockOnCardConnected.mockRejectedValue(new Error('bad mac'));
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe('bad mac');
    });

    it('calls stopNFCWithError with the error message on real errors', async () => {
      const { result } = makeHook();
      mockOnCardConnected.mockRejectedValue(new Error('bad mac'));
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(mockStopNFCWithError).toHaveBeenCalledWith('bad mac');
    });

    it('sets error when SELECT returns non-0x9000', async () => {
      mockSelect.mockResolvedValue({ sw: 0x6a82 });
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe('SELECT failed: 0x6A82');
    });
  });

  describe('minimum applet version', () => {
    const TOO_OLD =
      'This Keycard runs applet 3.0. Keycard Pal needs applet 3.1 or newer.';

    // The real SDK assigns applicationInfo inside select(), so the mock does
    // the same rather than handing the hook a pre-built command set.
    function selectReturning(applicationInfo: object) {
      mockSelect.mockImplementation(function (this: {
        applicationInfo?: object;
      }) {
        this.applicationInfo = applicationInfo;
        return Promise.resolve({ sw: 0x9000 });
      });
    }

    async function tapCard() {
      const hook = makeHook();
      await act(async () => {
        hook.result.current.startNFC();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      return hook;
    }

    it('refuses a card below 3.1 before the operation sees it', async () => {
      selectReturning({ appVersion: 0x0300 });
      const { result } = await tapCard();
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(TOO_OLD);
      expect(mockStopNFCWithError).toHaveBeenCalledWith(TOO_OLD);
      expect(mockOnCardConnected).not.toHaveBeenCalled();
    });

    it('hands a 3.1 card to the operation', async () => {
      selectReturning({ appVersion: 0x0301 });
      const { result } = await tapCard();
      expect(mockOnCardConnected).toHaveBeenCalled();
      expect(result.current.phase).toBe('done');
    });

    it('does not refuse a card that reports no version', async () => {
      selectReturning({});
      const { result } = await tapCard();
      expect(mockOnCardConnected).toHaveBeenCalled();
      expect(result.current.phase).toBe('done');
    });

    // The dashboard reminder reads this. It is a note, not a gate: the card
    // goes on to the operation whatever the user ticked in Settings.
    describe('noting the tapped generation', () => {
      beforeEach(() => {
        resetLastTappedGeneration();
      });

      it('notes a 3.x card', async () => {
        selectReturning({ appVersion: 0x0302 });
        await tapCard();
        expect(getLastTappedGeneration()).toBe('3.1');
      });

      it('notes a 4.0 card', async () => {
        selectReturning({ appVersion: 0x0400 });
        await tapCard();
        expect(getLastTappedGeneration()).toBe('4.0');
      });

      it('notes it before the operation, so a failed one still counts', async () => {
        selectReturning({ appVersion: 0x0400 });
        mockOnCardConnected.mockRejectedValueOnce(
          new Error('operation failed'),
        );
        await tapCard();
        expect(getLastTappedGeneration()).toBe('4.0');
      });

      it('notes nothing for a card it refused', async () => {
        selectReturning({ appVersion: 0x0300 });
        await tapCard();
        expect(getLastTappedGeneration()).toBeNull();
      });

      it('notes nothing when SELECT told it nothing', async () => {
        mockSelect.mockResolvedValue({ sw: 0x9000 });
        await tapCard();
        expect(getLastTappedGeneration()).toBeNull();
      });
    });
  });

  describe('NFC events', () => {
    it('user-cancelled resets to idle when in nfc phase', async () => {
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        capturedOnCancelled?.();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('user-cancelled does not change phase when idle', async () => {
      const { result } = makeHook();
      await act(async () => {
        capturedOnCancelled?.();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('timeout updates status message when in nfc phase', async () => {
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        capturedOnTimeout?.();
      });
      expect(result.current.status).toBe('Timed out — tap again');
    });

    it('timeout does not update status when not in nfc phase', async () => {
      const { result } = makeHook();
      await act(async () => {
        capturedOnTimeout?.();
      });
      expect(result.current.status).toBe('');
    });

    it('card disconnected during nfc updates status, presence, and stays in nfc', async () => {
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        capturedOnDisconnected?.();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.cardPresence).toBe('lost');
      expect(result.current.status).toBe(CARD_MOVED_STATUS);
    });

    it('real card error followed by disconnect stays in error', async () => {
      const { result } = makeHook();
      mockOnCardConnected.mockRejectedValue(new Error('Card is locked'));
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe('Card is locked');

      // Android NFC always fires disconnect after an operation — must not override the error
      await act(async () => {
        capturedOnDisconnected?.();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe('Card is locked');
    });

    it('card disconnected outside nfc does not change status', async () => {
      const { result } = makeHook();
      await act(async () => {
        capturedOnDisconnected?.();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
    });
  });

  // T2/T3: tag loss is classified from the error itself, never from the
  // ordering of the disconnect event (which loses the race on Android).
  describe('tag-loss classification', () => {
    async function startAndFail(
      result: { current: ReturnType<typeof useNFCSession> },
      message: string,
    ) {
      mockOnCardConnected.mockRejectedValue(new Error(message));
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
    }

    it('android wire shape, no disconnect event: stays in nfc, presence lost', async () => {
      const { result } = makeHook({ retryOnTagLoss: true });
      await startAndFail(result, ANDROID_TAG_LOST);
      expect(result.current.phase).toBe('nfc');
      expect(result.current.cardPresence).toBe('lost');
      expect(result.current.status).toBe(CARD_MOVED_STATUS);
      expect(mockStopNFCWithError).not.toHaveBeenCalled();
    });

    it('ios wire shape: identical result — the hook does not care which platform', async () => {
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'ios';
      try {
        const { result } = makeHook({ retryOnTagLoss: true });
        await startAndFail(result, IOS_TAG_LOST);
        expect(result.current.phase).toBe('nfc');
        expect(result.current.cardPresence).toBe('lost');
        expect(mockStopNFCWithError).not.toHaveBeenCalled();
      } finally {
        Platform.OS = origOS;
      }
    });

    it('real error still fails: SELECT bad SW goes to error with stopNFCWithError', async () => {
      const { result } = makeHook({ retryOnTagLoss: true });
      await startAndFail(result, 'SELECT failed: 0x6A82');
      expect(result.current.phase).toBe('error');
      expect(mockStopNFCWithError).toHaveBeenCalledWith(
        'SELECT failed: 0x6A82',
      );
    });

    it('R7: a swallowed loss does not swallow the next real error', async () => {
      const { result } = makeHook({ retryOnTagLoss: true });
      await startAndFail(result, ANDROID_TAG_LOST);
      // The runloop's disconnect event lands after the classified error.
      await act(async () => {
        capturedOnDisconnected?.();
      });
      // Re-tap, now a real error.
      mockOnCardConnected.mockRejectedValue(new Error('Invalid MAC'));
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe('Invalid MAC');
    });

    it('re-tap after loss re-runs the operation and restores presence', async () => {
      const { result } = makeHook({ retryOnTagLoss: true });
      await startAndFail(result, ANDROID_TAG_LOST);
      mockOnCardConnected.mockResolvedValue(undefined);
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(mockOnCardConnected).toHaveBeenCalledTimes(2);
      expect(result.current.cardPresence).toBe('connected');
      expect(result.current.phase).toBe('done');
    });

    // A tap that lands while the previous run is still unwinding must not be
    // dropped: the tag is already on the antenna, so no new discovery fires
    // and the user would have to physically remove and re-tap.
    it('replays a connect that arrives while a run is still in flight', async () => {
      let releaseFirstRun: (() => void) | null = null;
      mockOnCardConnected
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              releaseFirstRun = () => reject(new Error(ANDROID_TAG_LOST));
            }),
        )
        .mockResolvedValue(undefined);

      const { result } = makeHook({ retryOnTagLoss: true });
      await act(async () => {
        result.current.startNFC();
      });
      let firstRun: Promise<void> | undefined;
      act(() => {
        firstRun = capturedOnConnected?.();
      });
      await act(async () => {});

      // The user taps again while the first run is still blocked.
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(mockOnCardConnected).toHaveBeenCalledTimes(1); // queued, not run

      // The blocked APDU finally fails; the queued tap is replayed.
      await act(async () => {
        releaseFirstRun?.();
        await firstRun;
      });
      expect(mockOnCardConnected).toHaveBeenCalledTimes(2);
      expect(result.current.phase).toBe('done');
    });

    it('does not replay a queued connect after a real error', async () => {
      let releaseFirstRun: (() => void) | null = null;
      mockOnCardConnected
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              releaseFirstRun = () => reject(new Error('Invalid MAC'));
            }),
        )
        .mockResolvedValue(undefined);

      const { result } = makeHook({ retryOnTagLoss: true });
      await act(async () => {
        result.current.startNFC();
      });
      let firstRun: Promise<void> | undefined;
      act(() => {
        firstRun = capturedOnConnected?.();
      });
      await act(async () => {});
      await act(async () => {
        await capturedOnConnected?.();
      });

      await act(async () => {
        releaseFirstRun?.();
        await firstRun;
      });
      // The operation must not restart itself behind the user's back.
      expect(mockOnCardConnected).toHaveBeenCalledTimes(1);
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe('Invalid MAC');
    });

    it('startNFC resets presence to waiting', async () => {
      const { result } = makeHook({ retryOnTagLoss: true });
      await startAndFail(result, ANDROID_TAG_LOST);
      expect(result.current.cardPresence).toBe('lost');
      await act(async () => {
        result.current.startNFC();
      });
      expect(result.current.cardPresence).toBe('waiting');
    });

    it('without retryOnTagLoss (default): tag loss is an error with ambiguity copy', async () => {
      const { result } = makeHook();
      await startAndFail(result, ANDROID_TAG_LOST);
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'Connection lost mid-operation. Check the card state before retrying.',
      );
      expect(mockStopNFCWithError).toHaveBeenCalled();
    });

    it('retryOnTagLoss but inside an unsafe window: error, no silent replay', async () => {
      const { result } = makeHook({ retryOnTagLoss: true });
      mockOnCardConnected.mockImplementation(async () => {
        result.current.retryUnsafeRef.current = true;
        throw new Error(ANDROID_TAG_LOST);
      });
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'Connection lost mid-operation. Check the card state before retrying.',
      );
    });
  });

  // T4: the reconnect wait is bounded by a loss counter and a watchdog.
  describe('reconnect bounds', () => {
    const STABILITY_ERROR = 'Could not keep a stable connection. Try again.';

    async function failOnce(message = ANDROID_TAG_LOST) {
      mockOnCardConnected.mockRejectedValueOnce(new Error(message));
      await act(async () => {
        await capturedOnConnected?.();
      });
    }

    it('watchdog fires after 6s of no re-tap', async () => {
      const { result } = makeHook({ retryOnTagLoss: true });
      await act(async () => {
        result.current.startNFC();
      });
      await failOnce();
      expect(result.current.phase).toBe('nfc');
      await act(async () => {
        jest.advanceTimersByTime(6000);
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(STABILITY_ERROR);
    });

    it('re-tap before the watchdog clears it', async () => {
      const { result } = makeHook({ retryOnTagLoss: true });
      await act(async () => {
        result.current.startNFC();
      });
      await failOnce();
      mockOnCardConnected.mockResolvedValue(undefined);
      await act(async () => {
        await capturedOnConnected?.();
      });
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });
      expect(result.current.phase).toBe('done');
    });

    // The counter only accumulates when there is no forward progress: a loss
    // during SELECT itself (card connects and instantly drops). A loss after a
    // successful SELECT resets the bound by design.
    async function failDuringSelect() {
      mockSelect.mockRejectedValueOnce(new Error(ANDROID_TAG_LOST));
      await act(async () => {
        await capturedOnConnected?.();
      });
    }

    it('three consecutive losses with no successful SELECT hit the counter bound', async () => {
      const { result } = makeHook({ retryOnTagLoss: true });
      await act(async () => {
        result.current.startNFC();
      });
      await failDuringSelect();
      await failDuringSelect();
      expect(result.current.phase).toBe('nfc');
      await failDuringSelect();
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(STABILITY_ERROR);
    });

    it('a successful SELECT resets the counter', async () => {
      const { result } = makeHook({ retryOnTagLoss: true });
      await act(async () => {
        result.current.startNFC();
      });
      await failDuringSelect();
      await failDuringSelect();
      // SELECT succeeds (forward progress) but the op drops the tag after it:
      // the counter restarts (0 → 1 for the post-SELECT loss). One more
      // select-level loss makes 2 — without the reset it would be 4 and the
      // bound would already have fired.
      await failOnce();
      await failDuringSelect();
      expect(result.current.phase).toBe('nfc');
    });

    it('unmount with a pending watchdog does not fire it', async () => {
      const { result, unmount } = makeHook({ retryOnTagLoss: true });
      await act(async () => {
        result.current.startNFC();
      });
      await failOnce();
      unmount();
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });
      // No state-update-after-unmount warning; nothing to assert beyond survival.
    });
  });

  // T10: iOS reopens the session after Apple's 60s cap, bounded and
  // foreground-gated. Android keeps the immediate error.
  describe('iOS timeout auto-restart', () => {
    let Platform: { OS: string };
    let origOS: string;

    beforeEach(() => {
      Platform = require('react-native').Platform;
      origOS = Platform.OS;
      Platform.OS = 'ios';
      (AppState as any).currentState = 'active';
    });

    afterEach(() => {
      Platform.OS = origOS;
    });

    it('restarts the reader 500ms after a timeout', async () => {
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      mockStartNFC.mockClear();
      await act(async () => {
        capturedOnTimeout?.();
      });
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(mockStartNFC).toHaveBeenCalledTimes(1);
      expect(result.current.phase).toBe('nfc');
    });

    it('falls back to the timeout error after the restart cap', async () => {
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      for (let i = 0; i < 2; i++) {
        await act(async () => {
          capturedOnTimeout?.();
        });
        await act(async () => {
          jest.advanceTimersByTime(500);
        });
      }
      expect(result.current.phase).toBe('nfc');
      await act(async () => {
        capturedOnTimeout?.();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe('Timed out — tap again');
    });

    it('does not restart in the background', async () => {
      (AppState as any).currentState = 'background';
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        capturedOnTimeout?.();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe('Timed out — tap again');
    });

    it('does not restart when the operation already finished', async () => {
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('done');
      mockStartNFC.mockClear();
      await act(async () => {
        capturedOnTimeout?.();
      });
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(mockStartNFC).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('done');
    });

    it('android keeps the immediate error', async () => {
      Platform.OS = 'android';
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        capturedOnTimeout?.();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe('Timed out — tap again');
    });

    it('unmount with a pending restart timer does not fire it', async () => {
      const { result, unmount } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        capturedOnTimeout?.();
      });
      mockStartNFC.mockClear();
      unmount();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockStartNFC).not.toHaveBeenCalled();
    });
  });

  // Apple's system sheet is the only NFC UI on iOS — Pal's own sheet is gated to
  // Android — so every user-facing status has to be pushed into it explicitly or
  // it is invisible there.
  describe('iOS system sheet status mirroring', () => {
    function withPlatform(os: string, body: () => Promise<void>) {
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = os;
      return body().finally(() => {
        Platform.OS = origOS;
      });
    }

    it('pushes handshake progress to the system sheet', async () => {
      await withPlatform('ios', async () => {
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {
          await capturedOnConnected?.();
        });
        expect(mockSetNFCMessage).toHaveBeenCalledWith('Selecting applet...');
      });
    });

    it("pushes the operation's own progress to the system sheet", async () => {
      await withPlatform('ios', async () => {
        mockOnCardConnected.mockImplementation(
          async (_cmdSet: unknown, setStatus: (s: string) => void) => {
            setStatus('Exporting key 2 of 3...');
          },
        );
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {
          await capturedOnConnected?.();
        });
        expect(mockSetNFCMessage).toHaveBeenCalledWith(
          'Exporting key 2 of 3...',
        );
      });
    });

    // The reason this whole mechanism exists: during a reconnect wait the
    // session stays up and Pal renders nothing on iOS, so the sheet is the only
    // place the user can be told to re-tap.
    it('pushes the reconnect nudge on a classified tag loss', async () => {
      await withPlatform('ios', async () => {
        mockOnCardConnected.mockRejectedValue(new Error(IOS_TAG_LOST));
        const { result } = makeHook({ retryOnTagLoss: true });
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {
          await capturedOnConnected?.();
        });
        expect(result.current.phase).toBe('nfc');
        expect(mockSetNFCMessage).toHaveBeenCalledWith(CARD_MOVED_STATUS);
      });
    });

    it('pushes the reconnect nudge on a disconnect event', async () => {
      await withPlatform('ios', async () => {
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        mockSetNFCMessage.mockClear();
        await act(async () => {
          capturedOnDisconnected?.();
        });
        expect(mockSetNFCMessage).toHaveBeenCalledWith(CARD_MOVED_STATUS);
      });
    });

    // stopNFCWithError already puts the message on the sheet as it tears the
    // session down; pushing it first would be a redundant second write.
    it('leaves error copy to stopNFCWithError', async () => {
      await withPlatform('ios', async () => {
        mockOnCardConnected.mockRejectedValue(
          new Error('SELECT failed: 0x6A82'),
        );
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {
          await capturedOnConnected?.();
        });
        expect(mockStopNFCWithError).toHaveBeenCalledWith(
          'SELECT failed: 0x6A82',
        );
        expect(mockSetNFCMessage).not.toHaveBeenCalledWith(
          'SELECT failed: 0x6A82',
        );
      });
    });

    it('never calls the bridge on android, where it is a no-op', async () => {
      await withPlatform('android', async () => {
        mockOnCardConnected.mockImplementation(
          async (_cmdSet: unknown, setStatus: (s: string) => void) => {
            setStatus('Exporting key 2 of 3...');
          },
        );
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {
          await capturedOnConnected?.();
        });
        await act(async () => {
          capturedOnDisconnected?.();
        });
        expect(mockSetNFCMessage).not.toHaveBeenCalled();
      });
    });

    it('a rejected setNFCMessage does not break the session', async () => {
      await withPlatform('ios', async () => {
        mockSetNFCMessage.mockRejectedValue(new Error('unavailable'));
        const { result } = makeHook();
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {
          await capturedOnConnected?.();
        });
        expect(result.current.phase).toBe('done');
      });
    });
  });
});
