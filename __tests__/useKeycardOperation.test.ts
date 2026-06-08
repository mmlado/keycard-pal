/* eslint-disable no-bitwise */

import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import {
  useKeycardOp,
  useKeycardOperation,
} from '../src/hooks/keycard/useKeycardOperation';
import type { UseKeycardOperation } from '../src/hooks/keycard/useKeycardOperation';
import { checkGenuine } from '../src/utils/genuineCheck';
import { loadPairing } from '../src/storage/pairingStorage';

// ---------------------------------------------------------------------------
// RNKeycard mock — captures event callbacks so tests can trigger them
// ---------------------------------------------------------------------------

let capturedOnConnected: (() => Promise<void>) | null = null;
let capturedOnDisconnected: (() => void) | null = null;
let capturedOnCancelled: (() => void) | null = null;
let capturedOnTimeout: (() => void) | null = null;
let capturedAppStateListener: ((state: string) => void) | null = null;

const mockStartNFC = jest.fn();
const mockStopNFC = jest.fn();
const mockStopNFCWithError = jest.fn();
const mockIsNFCEnabled = jest.fn();

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
      openNFCSettings: () => Promise.resolve(true),
    },
    NFCCardChannel: class {},
  },
}));

jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    Commandset: jest.fn(),
    Certificate: { verifyIdentity: jest.fn() },
  },
}));

jest.mock('../src/utils/genuineCheck', () => ({
  checkGenuine: jest.fn(),
}));

jest.mock('../src/storage/pairingStorage', () => ({
  loadPairing: jest.fn(),
  savePairing: jest.fn(),
}));

const mockCheckGenuine = checkGenuine as jest.MockedFunction<
  typeof checkGenuine
>;
const mockLoadPairing = loadPairing as jest.MockedFunction<typeof loadPairing>;

// ---------------------------------------------------------------------------
// Shared mock Commandset factory
// ---------------------------------------------------------------------------

const makeMockCmdSet = () => ({
  applicationInfo: {
    instanceUID: new Uint8Array([0xaa, 0xbb]),
    initializedCard: true,
    freePairingSlots: 5,
    hasMasterKey: () => true,
  },
  select: jest.fn().mockResolvedValue({ sw: 0x9000 }),
  identifyCard: jest.fn(),
  autoPair: jest.fn().mockResolvedValue(undefined),
  getPairing: jest.fn().mockReturnValue({ pairingIndex: 0 }),
  setPairing: jest.fn(),
  autoOpenSecureChannel: jest.fn().mockResolvedValue(undefined),
  getData: jest.fn().mockResolvedValue({
    sw: 0x9000,
    data: new Uint8Array([0x20 | 9, ...Buffer.from('Main card')]),
  }),
  verifyPIN: jest.fn().mockResolvedValue({
    sw: 0x9000,
    checkAuthOK: jest.fn(),
  }),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useKeycardOperation', () => {
  beforeEach(() => {
    mockStartNFC.mockResolvedValue(undefined);
    mockStopNFC.mockResolvedValue(undefined);
    mockStopNFCWithError.mockResolvedValue(undefined);
    mockIsNFCEnabled.mockResolvedValue(true);
    mockStartNFC.mockClear();
    mockStopNFC.mockClear();
    mockStopNFCWithError.mockClear();
    mockIsNFCEnabled.mockClear();
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
    mockCheckGenuine.mockClear();
    mockLoadPairing.mockClear();
  });

  describe('initial state', () => {
    it('starts idle with empty status and no result', () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
      expect(result.current.cardName).toBeNull();
      expect(result.current.result).toBeNull();
    });
  });

  describe('execute', () => {
    it('transitions to pin_entry when requiresPin is true', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: true });
      });
      expect(result.current.phase).toBe('pin_entry');
    });

    it('transitions to nfc and calls startNFC when requiresPin is false', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });

    it('defaults requiresPin to true when options are omitted', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn());
      });
      expect(result.current.phase).toBe('pin_entry');
      expect(mockStartNFC).not.toHaveBeenCalled();
    });

    it('falls back to pin_entry when isNFCEnabled check throws', async () => {
      mockIsNFCEnabled.mockRejectedValue(new Error('check failed'));
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: true });
      });
      await act(async () => {});
      expect(result.current.phase).toBe('pin_entry');
      expect(mockStartNFC).not.toHaveBeenCalled();
    });

    it('shows NFC error instead of PIN pad when NFC is disabled', async () => {
      mockIsNFCEnabled.mockResolvedValue(false);
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: true });
      });
      await act(async () => {});
      expect(result.current.phase).toBe('error');
      expect(mockStartNFC).not.toHaveBeenCalled(); // NFC reader not started (disabled)
    });
  });

  describe('retry', () => {
    it('does not start NFC when no operation is queued', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.retry();
      });
      expect(mockStartNFC).not.toHaveBeenCalled();
    });

    it('restarts NFC when an operation is queued', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      mockStartNFC.mockClear();
      await act(async () => {
        result.current.retry();
      });
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });

    it('shows PIN pad instead of starting NFC when PIN required but not yet entered', async () => {
      mockIsNFCEnabled.mockResolvedValue(false);
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: true });
      });
      await act(async () => {});
      // NFC was disabled — error shown, PIN never entered
      expect(result.current.phase).toBe('error');
      mockStartNFC.mockClear();

      // Simulate NFC becoming available; retry should route to PIN pad
      await act(async () => {
        result.current.retry();
      });
      expect(result.current.phase).toBe('pin_entry');
      expect(mockStartNFC).not.toHaveBeenCalled();
    });
  });

  describe('submitPin', () => {
    it('transitions to nfc and calls startNFC', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.submitPin('123456');
      });
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });
  });

  describe('cancel', () => {
    it('returns to idle, clears status, and stops NFC', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: true });
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
      const { result } = renderHook(() => useKeycardOperation<string>());
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
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      expect(result.current.phase).toBe('nfc');

      await act(async () => {
        capturedOnCancelled?.();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('user-cancelled does not change phase when not in nfc', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: true });
      });
      expect(result.current.phase).toBe('pin_entry');

      await act(async () => {
        capturedOnCancelled?.();
      });
      expect(result.current.phase).toBe('pin_entry');
    });

    it('timeout updates status message when in nfc phase', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await act(async () => {
        capturedOnTimeout?.();
      });
      expect(result.current.status).toBe('Timed out — tap again');
    });

    it('card disconnected during nfc updates status and stays in nfc', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await act(async () => {
        capturedOnDisconnected?.();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.status).toBe(
        'Connection lost - adjust Keycard position',
      );
    });

    it('card disconnected outside nfc does not update status', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      // phase is idle — disconnect should be a no-op for status
      await act(async () => {
        capturedOnDisconnected?.();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Genuine check
  // -------------------------------------------------------------------------

  describe('genuine check', () => {
    beforeEach(() => {
      // Default: no existing pairing, genuine check passes
      mockLoadPairing.mockResolvedValue(null);
      mockCheckGenuine.mockResolvedValue(true);

      // Make Keycard.Commandset return a fresh mock for each test
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => makeMockCmdSet());
    });

    async function triggerCardConnect(_hook: UseKeycardOperation<string>) {
      await act(async () => {
        await capturedOnConnected?.();
      });
    }

    it('genuine check runs when no existing pairing', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
        });
      });
      await triggerCardConnect(result.current);
      expect(mockCheckGenuine).toHaveBeenCalledTimes(1);
    });

    it('reads the card name after select for the active NFC session', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
        });
      });
      await triggerCardConnect(result.current);
      expect(result.current.cardName).toBe('Main card');
    });

    it('enters error phase when reading the card name fails', async () => {
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        getData: jest.fn().mockResolvedValue({ sw: 0x6f00 }),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
        });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe('GET DATA failed: 0x6F00');
    });

    it('phase becomes genuine_warning when check fails', async () => {
      mockCheckGenuine.mockResolvedValue(false);
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('genuine_warning');
    });

    it('genuine check is skipped when pairing already exists', async () => {
      mockLoadPairing.mockResolvedValue({ pairingIndex: 0 } as any);
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
        });
      });
      await triggerCardConnect(result.current);
      expect(mockCheckGenuine).not.toHaveBeenCalled();
    });

    it('proceedWithNonGenuine transitions back to nfc', async () => {
      mockCheckGenuine.mockResolvedValue(false);
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('genuine_warning');

      await act(async () => {
        result.current.proceedWithNonGenuine();
      });
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledTimes(2); // initial + after proceed
    });

    it('reconnect after proceedWithNonGenuine skips genuine check', async () => {
      mockCheckGenuine.mockResolvedValue(false);
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('r'), {
          requiresPin: false,
        });
      });
      await triggerCardConnect(result.current); // first connect: check fails, warning shown
      await act(async () => {
        result.current.proceedWithNonGenuine();
      });
      // Simulate second card connect after user proceeds
      mockCheckGenuine.mockClear();
      await triggerCardConnect(result.current);
      expect(mockCheckGenuine).not.toHaveBeenCalled();
    });

    it('cancel in genuine_warning returns to idle', async () => {
      mockCheckGenuine.mockResolvedValue(false);
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('genuine_warning');

      await act(async () => {
        result.current.cancel();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('reset in genuine_warning returns to idle and clears result', async () => {
      mockCheckGenuine.mockResolvedValue(false);
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('genuine_warning');

      await act(async () => {
        result.current.reset();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.result).toBeNull();
    });

    it('enters error phase with friendly message when card has no master key', async () => {
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        applicationInfo: {
          instanceUID: new Uint8Array([0xaa, 0xbb]),
          initializedCard: true,
          freePairingSlots: 5,
          hasMasterKey: () => false,
        },
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
        });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'This card has no master key. Generate or import a key first.',
      );
    });

    it('skips master key check when requiresMasterKey is false', async () => {
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        applicationInfo: {
          instanceUID: new Uint8Array([0xaa, 0xbb]),
          initializedCard: true,
          freePairingSlots: 5,
          hasMasterKey: () => false,
        },
      }));

      const mockOp = jest.fn().mockResolvedValue('ok');
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(mockOp, {
          requiresPin: false,
          requiresMasterKey: false,
        });
      });
      await triggerCardConnect(result.current);
      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('enters error phase when applicationInfo is missing from SELECT response', async () => {
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        applicationInfo: null,
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'No application info in SELECT response',
      );
    });
  });

  describe('empty PIN guard', () => {
    beforeEach(() => {
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => makeMockCmdSet());
    });

    it('enters error phase when card connects before PIN is entered', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: true });
      });
      expect(result.current.phase).toBe('pin_entry');

      await act(async () => {
        result.current.submitPin('');
      });
      expect(result.current.phase).toBe('nfc');

      await act(async () => {
        await capturedOnConnected?.();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'Enter your PIN first — tap Retry to continue.',
      );
    });
  });

  describe('pairing password', () => {
    beforeEach(() => {
      mockLoadPairing.mockResolvedValue(null);
      mockCheckGenuine.mockResolvedValue(true);
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => makeMockCmdSet());
    });

    async function triggerCardConnect(_hook: UseKeycardOperation<string>) {
      await act(async () => {
        await capturedOnConnected?.();
      });
    }

    it('enters pairing_password phase when autoPair throws cryptogram error', async () => {
      const { APDUException } = require('keycard-sdk/dist/apdu-exception');
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        autoPair: jest
          .fn()
          .mockRejectedValue(new APDUException('Invalid card cryptogram')),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
        });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('pairing_password');
      expect(result.current.pairingPasswordError).toBeNull();
    });

    it('transitions to nfc and calls startNFC after submitPairingPassword', async () => {
      const { APDUException } = require('keycard-sdk/dist/apdu-exception');
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        autoPair: jest
          .fn()
          .mockRejectedValue(new APDUException('Invalid card cryptogram')),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
        });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('pairing_password');

      mockStartNFC.mockClear();
      await act(async () => {
        result.current.submitPairingPassword('custom123');
      });
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });

    it('sets pairingPasswordError on second tap with wrong custom password', async () => {
      const { APDUException } = require('keycard-sdk/dist/apdu-exception');
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        autoPair: jest
          .fn()
          .mockRejectedValue(new APDUException('Invalid card cryptogram')),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
        });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('pairing_password');

      await act(async () => {
        result.current.submitPairingPassword('custom123');
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('pairing_password');
      expect(result.current.pairingPasswordError).toBe(
        'Wrong pairing password. Try again.',
      );
    });

    it('returns to idle on cancel from pairing_password', async () => {
      const { APDUException } = require('keycard-sdk/dist/apdu-exception');
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        autoPair: jest
          .fn()
          .mockRejectedValue(new APDUException('Invalid card cryptogram')),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('pairing_password');

      await act(async () => {
        result.current.cancel();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.pairingPasswordError).toBeNull();
    });

    it('enters error phase with friendly slots-full message on step-2 error', async () => {
      const { APDUException } = require('keycard-sdk/dist/apdu-exception');
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        autoPair: jest
          .fn()
          .mockRejectedValue(new APDUException('Pairing failed on step 2')),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'This Keycard has no free pairing slots. Use another device to unpair a slot first.',
      );
    });

    it('enters error phase with friendly slots-full message on step-1 error', async () => {
      const { APDUException } = require('keycard-sdk/dist/apdu-exception');
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        autoPair: jest
          .fn()
          .mockRejectedValue(new APDUException('Pairing failed on step 1')),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'This Keycard has no free pairing slots. Use another device to unpair a slot first.',
      );
    });

    it('completes operation when custom password succeeds on retry', async () => {
      const { APDUException } = require('keycard-sdk/dist/apdu-exception');
      const Keycard = require('keycard-sdk').default;
      let callCount = 0;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        autoPair: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new APDUException('Invalid card cryptogram'));
          }
          return Promise.resolve(undefined);
        }),
      }));

      const mockOp = jest.fn().mockResolvedValue('done');
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(mockOp, { requiresPin: false });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('pairing_password');

      await act(async () => {
        result.current.submitPairingPassword('custom123');
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('done');
      expect(result.current.result).toBe('done');
      expect(mockOp).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearPinError', () => {
    it('is exposed and callable without side effects when no error exists', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.clearPinError();
      });
      expect(result.current.pinError).toBeNull();
    });
  });

  describe('PIN verification', () => {
    beforeEach(() => {
      mockLoadPairing.mockResolvedValue({ pairingIndex: 0 } as any);
      mockCheckGenuine.mockResolvedValue(true);
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => makeMockCmdSet());
    });

    it('sets pinError and returns to pin_entry on wrong PIN', async () => {
      const { WrongPINException } = require('keycard-sdk/dist/apdu-exception');
      const err = new WrongPINException(2);
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        verifyPIN: jest.fn().mockResolvedValue({
          sw: 0x63c2,
          checkAuthOK: () => {
            throw err;
          },
        }),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: true });
      });
      await act(async () => {
        result.current.submitPin('wrong');
      });
      await act(async () => {
        await capturedOnConnected?.();
      });

      expect(result.current.pinError).toBe(
        'PIN is not valid. 2 attempts left.',
      );
      expect(result.current.phase).toBe('pin_entry');
    });

    it('enters error phase with locked message when no attempts remain', async () => {
      const { WrongPINException } = require('keycard-sdk/dist/apdu-exception');
      const err = new WrongPINException(0);
      const Keycard = require('keycard-sdk').default;
      Keycard.Commandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        verifyPIN: jest.fn().mockResolvedValue({
          sw: 0x6300,
          checkAuthOK: () => {
            throw err;
          },
        }),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: true });
      });
      await act(async () => {
        result.current.submitPin('wrong');
      });
      await act(async () => {
        await capturedOnConnected?.();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'Card is locked. Use Unblock Card option.',
      );
      expect(result.current.pinError).toBeNull();
    });
  });
});

describe('onNFCAvailableRef', () => {
  beforeEach(() => {
    mockStartNFC.mockResolvedValue(undefined);
    mockIsNFCEnabled.mockResolvedValue(true);
    mockStartNFC.mockClear();
    mockIsNFCEnabled.mockClear();
    capturedAppStateListener = null;
    (AppState.addEventListener as jest.Mock).mockImplementation(
      (_event: string, cb: (state: string) => void) => {
        capturedAppStateListener = cb;
        return { remove: jest.fn() };
      },
    );
  });

  it('starts NFC directly when NFC re-enables and PIN is not required', async () => {
    mockIsNFCEnabled.mockResolvedValue(false);
    const { result } = renderHook(() => useKeycardOperation<string>());

    await act(async () => {
      result.current.execute(jest.fn(), { requiresPin: false });
    });
    await act(async () => {});
    expect(result.current.phase).toBe('error');

    mockIsNFCEnabled.mockResolvedValue(true);
    mockStartNFC.mockClear();

    await act(async () => {
      capturedAppStateListener?.('active');
    });
    await act(async () => {});

    expect(result.current.phase).toBe('nfc');
    expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
  });
});

describe('useKeycardOp', () => {
  beforeEach(() => {
    mockStartNFC.mockResolvedValue(undefined);
    mockIsNFCEnabled.mockResolvedValue(true);
    mockStartNFC.mockClear();
    mockIsNFCEnabled.mockClear();
  });

  it('start() transitions to nfc when requiresPin is false', async () => {
    const { result } = renderHook(() =>
      useKeycardOp(jest.fn(), { requiresPin: false }),
    );
    await act(async () => {
      result.current.start();
    });
    expect(result.current.phase).toBe('nfc');
    expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
  });

  it('start() transitions to pin_entry when requiresPin is true (default)', async () => {
    const { result } = renderHook(() => useKeycardOp(jest.fn()));
    await act(async () => {
      result.current.start();
    });
    expect(result.current.phase).toBe('pin_entry');
    expect(mockStartNFC).not.toHaveBeenCalled();
  });
});
