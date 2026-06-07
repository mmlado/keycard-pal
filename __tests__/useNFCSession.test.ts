import { act, renderHook } from '@testing-library/react-native';
import { useCallback } from 'react';
import { AppState } from 'react-native';
import useNFCSession from '../src/hooks/keycard/useNFCSession';

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
const mockIsNFCEnabled = jest.fn();
const mockOpenNFCSettings = jest.fn();

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
      isNFCEnabled: () => mockIsNFCEnabled(),
      openNFCSettings: () => mockOpenNFCSettings(),
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
    mockIsNFCEnabled.mockResolvedValue(true);
    mockOpenNFCSettings.mockResolvedValue(true);
    mockSelect.mockResolvedValue({ sw: 0x9000 });
    mockStartNFC.mockClear();
    mockStopNFC.mockClear();
    mockStopNFCWithError.mockClear();
    mockIsNFCEnabled.mockClear();
    mockOpenNFCSettings.mockClear();
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

  function makeHook() {
    return renderHook(() =>
      useNFCSession(
        useCallback(mockOnCardConnected, []),
        useCallback(mockOnCardDisconnected, []),
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

    it('calls onNFCAvailableRef handler instead of restarting NFC when one is set', async () => {
      mockIsNFCEnabled.mockResolvedValue(false);
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'android';
      try {
        const { result } = makeHook();
        const customHandler = jest.fn();
        result.current.onNFCAvailableRef.current = customHandler;

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

    it('card disconnected during nfc updates status and stays in nfc', async () => {
      const { result } = makeHook();
      await act(async () => {
        result.current.startNFC();
      });
      await act(async () => {
        capturedOnDisconnected?.();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.status).toBe(
        'Connection lost - adjust Keycard position',
      );
    });

    it('mid-operation disconnect on android stays in nfc and does not show error', async () => {
      const { result } = makeHook();
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'android';
      try {
        mockOnCardConnected.mockImplementation(async () => {
          capturedOnDisconnected?.();
          throw new Error('CardIO Error: Error sending command');
        });
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {
          await capturedOnConnected?.();
        });
        expect(result.current.phase).toBe('nfc');
        expect(result.current.status).toBe(
          'Connection lost - adjust Keycard position',
        );
      } finally {
        Platform.OS = origOS;
      }
    });

    it('mid-operation disconnect on ios shows error and tap-again hint', async () => {
      const { result } = makeHook();
      const Platform = require('react-native').Platform;
      const origOS = Platform.OS;
      Platform.OS = 'ios';
      try {
        mockOnCardConnected.mockImplementation(async () => {
          capturedOnDisconnected?.();
          throw new Error('CardIO Error: Error sending command');
        });
        await act(async () => {
          result.current.startNFC();
        });
        await act(async () => {
          await capturedOnConnected?.();
        });
        expect(result.current.phase).toBe('error');
        expect(result.current.status).toBe('Connection lost — tap again');
      } finally {
        Platform.OS = origOS;
      }
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
});
