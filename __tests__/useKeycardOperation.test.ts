/* eslint-disable no-bitwise */

import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { routeAbsence } from '../src/navigation/generationBoundRoutes';
import { loadPairing } from '../src/storage/pairingStorage';

import {
  DIFFERENT_CARD_STATUS,
  NOT_GENUINE_STATUS,
  PAIRING_PASSWORD_NEEDED_STATUS,
  PIN_BLOCKED_STATUS,
  useKeycardOp,
  useKeycardOperation,
} from '../src/hooks/keycard/useKeycardOperation';
import type { UseKeycardOperation } from '../src/hooks/keycard/useKeycardOperation';
import { NOTHING_TO_SEND_STATUS } from '../src/hooks/keycard/useNFCOperation';

import { getCardKey } from '../src/utils/cardIdentity';
import { checkGenuine } from '../src/utils/genuineCheck';

import {
  cancelSheet,
  loseCard,
  mockCommandset,
  mockIsNFCEnabled,
  mockStartNFC,
  mockStopNFC,
  mockStopNFCWithError,
  mockStopNFCWithMessage,
  resetFakeCard,
  tapCard,
  timeOut,
} from './fakeCard.testUtils';
import { filler, v3Select, v4Select } from './selectResponse.testUtils';

// ---------------------------------------------------------------------------
// The fake card
// ---------------------------------------------------------------------------

jest.mock(
  'react-native-keycard',
  () => require('./fakeCard.testUtils').bridgeModule,
);

jest.mock('keycard-sdk', () =>
  require('./fakeCard.testUtils').sdkModule({
    Certificate: { verifyIdentity: jest.fn() },
    BIP32KeyPair: {
      fromTLV: jest.fn(() => ({ publicKey: new Uint8Array([0x01]) })),
    },
  }),
);

jest.mock('../src/utils/cryptoAccount', () => ({
  pubKeyFingerprint: jest.fn(() => 0x1a2b3c4d),
}));

jest.mock('../src/utils/genuineCheck', () => ({
  checkGenuine: jest.fn(),
}));

jest.mock('../src/storage/pairingStorage', () => ({
  loadPairing: jest.fn(),
  savePairing: jest.fn(),
}));

const mockLoadApprovedCardKeys = jest.fn();
const mockApproveCardKey = jest.fn();
jest.mock('../src/storage/approvedCardsStorage', () => ({
  loadApprovedCardKeys: () => mockLoadApprovedCardKeys(),
  approveCardKey: (cardKey: string) => mockApproveCardKey(cardKey),
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

// AppState.addEventListener is a jest.fn() in the RN jest preset.
let capturedAppStateListener: ((state: string) => void) | null = null;

describe('useKeycardOperation', () => {
  beforeEach(() => {
    resetFakeCard();
    capturedAppStateListener = null;
    (AppState.addEventListener as jest.Mock).mockImplementation(
      (_event: string, cb: (state: string) => void) => {
        capturedAppStateListener = cb;
        return { remove: jest.fn() };
      },
    );
    mockCheckGenuine.mockClear();
    mockLoadPairing.mockClear();
    mockLoadApprovedCardKeys.mockReset().mockResolvedValue([]);
    mockApproveCardKey.mockReset().mockResolvedValue(undefined);
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
        cancelSheet();
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
        cancelSheet();
      });
      expect(result.current.phase).toBe('pin_entry');
    });

    it('timeout updates status message when in nfc phase', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await act(async () => {
        timeOut();
      });
      expect(result.current.status).toBe('Timed out — tap again');
    });

    it('card disconnected during nfc updates status and stays in nfc', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await act(async () => {
        loseCard();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.cardPresence).toBe('lost');
      expect(result.current.status).toBe(
        'Connection lost — hold your Keycard against the phone again',
      );
    });

    it('card disconnected outside nfc does not update status', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      // phase is idle — disconnect should be a no-op for status
      await act(async () => {
        loseCard();
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

      // A fresh card for each tap.
      mockCommandset.mockImplementation(() => makeMockCmdSet());
    });

    async function triggerCardConnect(_hook: UseKeycardOperation<string>) {
      await act(async () => {
        await tapCard();
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
      mockCommandset.mockImplementation(() => ({
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

    // A tap that returns closes Apple's NFC sheet with the success wording.
    it('never closes the reader with the success wording', async () => {
      mockCheckGenuine.mockResolvedValue(false);
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), {
          requiresPin: false,
          successMessage: 'PIN changed',
        });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('genuine_warning');
      expect(mockStopNFCWithMessage).not.toHaveBeenCalled();
      expect(mockStopNFC).not.toHaveBeenCalled();
      expect(mockStopNFCWithError).toHaveBeenCalledWith(NOT_GENUINE_STATUS);
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

    it('approving with no card waiting only opens the reader again', async () => {
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      mockStartNFC.mockClear();
      await act(async () => {
        result.current.proceedWithNonGenuine();
      });
      expect(mockStartNFC).toHaveBeenCalledTimes(1);
      expect(result.current.phase).toBe('nfc');
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
      mockCommandset.mockImplementation(() => ({
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
      mockCommandset.mockImplementation(() => ({
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
      mockCommandset.mockImplementation(() => ({
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

    // A blank 3.x card has no card key to look a pairing up by.
    it('enters error phase when the card is not initialized', async () => {
      mockCommandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        applicationInfo: { initializedCard: false },
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: false });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'This Keycard is not initialized. Initialize it first.',
      );
    });
  });

  // The second tap can land on another card, so the check comes before anything is spent or sent.
  describe('requiresRoute', () => {
    const CERTIFICATE = [...filler(33, 0x02), ...filler(65, 0x09)];

    function useCard(applicationInfo: unknown) {
      const cmdSet = { ...makeMockCmdSet(), applicationInfo };
      mockCommandset.mockImplementation(() => cmdSet);
      return cmdSet;
    }

    async function tapWithPin(
      options: Parameters<UseKeycardOperation<string>['execute']>[1],
    ) {
      const op = jest.fn().mockResolvedValue('result');
      const hook = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        hook.result.current.execute(op, options);
      });
      await act(async () => {
        hook.result.current.submitPin('123456');
      });
      await act(async () => {
        await tapCard();
      });
      return { ...hook, op };
    }

    it('refuses a card that lacks the operation, in plain words', async () => {
      useCard(v4Select(0x0400, { certificate: CERTIFICATE }));
      const { result } = await tapWithPin({
        requiresRoute: 'ChangePairingSecret',
        requiresMasterKey: false,
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        routeAbsence('ChangePairingSecret').sheetError,
      );
    });

    it('sends that card nothing beyond SELECT', async () => {
      const cmdSet = useCard(v4Select(0x0400, { certificate: CERTIFICATE }));
      const { op } = await tapWithPin({
        requiresRoute: 'ChangePairingSecret',
        requiresMasterKey: false,
      });
      expect(cmdSet.getData).not.toHaveBeenCalled();
      expect(mockCheckGenuine).not.toHaveBeenCalled();
      expect(cmdSet.autoPair).not.toHaveBeenCalled();
      expect(cmdSet.autoOpenSecureChannel).not.toHaveBeenCalled();
      expect(cmdSet.verifyPIN).not.toHaveBeenCalled();
      expect(op).not.toHaveBeenCalled();
    });

    // The right card is one tap away, so the typed PIN is kept.
    it('lets the user tap the right card without typing the PIN again', async () => {
      useCard(v4Select(0x0400, { certificate: CERTIFICATE }));
      const { result, op } = await tapWithPin({
        requiresRoute: 'ChangePairingSecret',
        requiresMasterKey: false,
      });
      mockStartNFC.mockClear();

      useCard(v3Select(0x0302));
      await act(async () => {
        result.current.retry();
      });
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledTimes(1);

      await act(async () => {
        await tapCard();
      });
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('runs on a card that has the operation', async () => {
      const cmdSet = useCard(v3Select(0x0302));
      const { result, op } = await tapWithPin({
        requiresRoute: 'ChangePairingSecret',
        requiresMasterKey: false,
      });
      expect(cmdSet.verifyPIN).toHaveBeenCalledWith('123456');
      expect(op).toHaveBeenCalledTimes(1);
      expect(result.current.phase).toBe('done');
    });

    // BIP85 came with 4.0, so here the older card is the one refused.
    it('refuses an older card an operation newer cards added', async () => {
      const cmdSet = useCard(v3Select(0x0302));
      const { result, op } = await tapWithPin({ requiresRoute: 'Bip85' });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(routeAbsence('Bip85').sheetError);
      expect(cmdSet.getData).not.toHaveBeenCalled();
      expect(mockCheckGenuine).not.toHaveBeenCalled();
      expect(cmdSet.autoPair).not.toHaveBeenCalled();
      expect(cmdSet.autoOpenSecureChannel).not.toHaveBeenCalled();
      expect(cmdSet.verifyPIN).not.toHaveBeenCalled();
      expect(op).not.toHaveBeenCalled();
    });

    // The copy sends the user to a newer card, which the typed PIN may not belong to.
    it('asks for the PIN again before the newer card', async () => {
      useCard(v3Select(0x0302));
      const { result, op } = await tapWithPin({ requiresRoute: 'Bip85' });
      mockStartNFC.mockClear();

      await act(async () => {
        result.current.retry();
      });
      expect(result.current.phase).toBe('pin_entry');
      expect(mockStartNFC).not.toHaveBeenCalled();

      const cmdSet = useCard(
        v4Select(0x0400, {
          certificate: CERTIFICATE,
          keyUID: filler(32, 0x07),
        }),
      );
      await act(async () => {
        result.current.submitPin('654321');
      });
      await act(async () => {
        await tapCard();
      });
      expect(cmdSet.verifyPIN).toHaveBeenCalledWith('654321');
      expect(cmdSet.verifyPIN).not.toHaveBeenCalledWith('123456');
      expect(op).toHaveBeenCalledTimes(1);
    });

    // An operation every card has must not be held to this check.
    it('is not applied to an operation that names no route', async () => {
      useCard(v4Select(0x0400, { certificate: CERTIFICATE }));
      const { result } = await tapWithPin({ requiresMasterKey: false });
      expect(result.current.status).not.toBe(
        routeAbsence('ChangePairingSecret').sheetError,
      );
    });

    // The option is per execute; it must not leak into the next run.
    it('does not carry over to the next operation', async () => {
      useCard(v4Select(0x0400, { certificate: CERTIFICATE }));
      const { result } = await tapWithPin({
        requiresRoute: 'PairingSlots',
        requiresMasterKey: false,
      });
      expect(result.current.status).toBe(
        routeAbsence('PairingSlots').sheetError,
      );

      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('next'), {
          requiresPin: false,
          requiresMasterKey: false,
        });
      });
      await act(async () => {
        await tapCard();
      });
      expect(result.current.status).not.toBe(
        routeAbsence('PairingSlots').sheetError,
      );
    });
  });

  // A screen that read one card can get its second tap from another.
  describe('requiresCardKey', () => {
    const EXPECTED = v3Select(0x0302);
    const OTHER = v3Select(0x0302, { instanceUID: filler(16, 0x02) });
    const expectedKey = getCardKey(EXPECTED)!;

    function useCard(applicationInfo: unknown) {
      const cmdSet = { ...makeMockCmdSet(), applicationInfo };
      mockCommandset.mockImplementation(() => cmdSet);
      return cmdSet;
    }

    async function tapWithPin() {
      const op = jest.fn().mockResolvedValue('result');
      const hook = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        hook.result.current.execute(op, {
          requiresMasterKey: false,
          requiresCardKey: expectedKey,
        });
      });
      await act(async () => {
        hook.result.current.submitPin('123456');
      });
      await act(async () => {
        await tapCard();
      });
      return { ...hook, op };
    }

    it('refuses another card and sends it nothing beyond SELECT', async () => {
      const cmdSet = useCard(OTHER);
      const { result, op } = await tapWithPin();
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(DIFFERENT_CARD_STATUS);
      expect(cmdSet.getData).not.toHaveBeenCalled();
      expect(mockCheckGenuine).not.toHaveBeenCalled();
      expect(cmdSet.autoPair).not.toHaveBeenCalled();
      expect(cmdSet.autoOpenSecureChannel).not.toHaveBeenCalled();
      expect(cmdSet.verifyPIN).not.toHaveBeenCalled();
      expect(op).not.toHaveBeenCalled();
    });

    // The typed PIN is the expected card's.
    it('runs on the expected card at the next tap, without asking for the PIN again', async () => {
      useCard(OTHER);
      const { result, op } = await tapWithPin();

      const cmdSet = useCard(EXPECTED);
      await act(async () => {
        result.current.retry();
      });
      expect(result.current.phase).toBe('nfc');
      await act(async () => {
        await tapCard();
      });
      expect(cmdSet.verifyPIN).toHaveBeenCalledWith('123456');
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('runs on the expected card', async () => {
      useCard(EXPECTED);
      const { result, op } = await tapWithPin();
      expect(op).toHaveBeenCalledTimes(1);
      expect(result.current.phase).toBe('done');
    });

    it('does not carry over to the next operation', async () => {
      useCard(OTHER);
      const { result } = await tapWithPin();
      expect(result.current.status).toBe(DIFFERENT_CARD_STATUS);

      const next = jest.fn().mockResolvedValue('next');
      await act(async () => {
        result.current.execute(next, {
          requiresPin: false,
          requiresMasterKey: false,
        });
      });
      await act(async () => {
        await tapCard();
      });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // Cards with a certificate (ADR-0013).
  describe('certificate cards', () => {
    const UNKNOWN_CA =
      'Card certificate verification failed: unknown CA public key and card not whitelisted';
    const IDENTITY_KEY = filler(33, 0x02);
    const CARD_KEY = '02'.repeat(33);
    const CERTIFICATE = [...IDENTITY_KEY, ...filler(65, 0x09)];
    const KEY_UID = filler(32, 0x5e);

    function card(options: { status?: number } = {}) {
      return v4Select(0x0400, {
        certificate: CERTIFICATE,
        keyUID: KEY_UID,
        ...options,
      });
    }

    function useCard(overrides: Record<string, unknown> = {}) {
      const cmdSet = {
        ...makeMockCmdSet(),
        applicationInfo: card(),
        ...overrides,
      };
      mockCommandset.mockImplementation(() => cmdSet);
      return cmdSet;
    }

    /** The whitelist the session built the most recent Commandset with. */
    function lastWhitelist(): Uint8Array[] {
      const calls = mockCommandset.mock.calls;
      return calls[calls.length - 1][2];
    }

    async function start(op = jest.fn().mockResolvedValue('result')) {
      const hook = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        hook.result.current.execute(op, {});
      });
      await act(async () => {
        hook.result.current.submitPin('123456');
      });
      return { ...hook, op };
    }

    async function tap() {
      await act(async () => {
        await tapCard();
      });
    }

    beforeEach(() => {
      mockCommandset.mockClear();
    });

    describe('signed by the Keycard CA', () => {
      it('runs the operation without pairing or IDENTIFY CARD', async () => {
        const cmdSet = useCard();
        const { result, op } = await start();
        await tap();
        expect(result.current.phase).toBe('done');
        expect(op).toHaveBeenCalledTimes(1);
        expect(mockLoadPairing).not.toHaveBeenCalled();
        expect(cmdSet.autoPair).not.toHaveBeenCalled();
        expect(mockCheckGenuine).not.toHaveBeenCalled();
        expect(cmdSet.identifyCard).not.toHaveBeenCalled();
      });

      // Outside the channel a name read would come back 0x6985.
      it('opens the channel before it reads the name or verifies the PIN', async () => {
        const cmdSet = useCard();
        await start();
        await tap();
        const order = (fn: jest.Mock) => fn.mock.invocationCallOrder[0];
        expect(order(cmdSet.autoOpenSecureChannel)).toBeLessThan(
          order(cmdSet.getData),
        );
        expect(order(cmdSet.getData)).toBeLessThan(order(cmdSet.verifyPIN));
      });

      it('shows the name it read inside the channel', async () => {
        useCard();
        const { result } = await start();
        await tap();
        expect(result.current.cardName).toBe('Main card');
      });

      it('remembers no approval, because none was needed', async () => {
        useCard();
        await start();
        await tap();
        expect(mockApproveCardKey).not.toHaveBeenCalled();
      });
    });

    describe('signed by an unknown CA', () => {
      function useUntrustedCard() {
        return useCard({
          select: jest.fn().mockRejectedValue(new Error(UNKNOWN_CA)),
        });
      }

      it('asks the user before anything more is sent', async () => {
        const cmdSet = useUntrustedCard();
        const { result, op } = await start();
        await tap();
        expect(result.current.phase).toBe('genuine_warning');
        expect(cmdSet.autoOpenSecureChannel).not.toHaveBeenCalled();
        expect(cmdSet.getData).not.toHaveBeenCalled();
        expect(cmdSet.verifyPIN).not.toHaveBeenCalled();
        expect(op).not.toHaveBeenCalled();
      });

      it('ends that tap with the warning, never as a success', async () => {
        useUntrustedCard();
        await start();
        await tap();
        expect(mockStopNFC).not.toHaveBeenCalled();
        expect(mockStopNFCWithMessage).not.toHaveBeenCalled();
        expect(mockStopNFCWithError).toHaveBeenCalledWith(NOT_GENUINE_STATUS);
      });

      it('does not whitelist the card before the user approves', async () => {
        useUntrustedCard();
        await start();
        await tap();
        expect(lastWhitelist()).toEqual([]);
      });

      it('whitelists the card for the tap after approval', async () => {
        useUntrustedCard();
        const { result } = await start();
        await tap();

        useCard();
        await act(async () => {
          result.current.proceedWithNonGenuine();
        });
        await tap();
        expect(lastWhitelist()).toEqual([new Uint8Array(IDENTITY_KEY)]);
      });

      // Only the handshake proves the card holds its key, so the approval is kept then.
      it('remembers the approval only once the handshake has succeeded', async () => {
        useUntrustedCard();
        const { result, op } = await start();
        await tap();
        await act(async () => {
          result.current.proceedWithNonGenuine();
        });
        expect(mockApproveCardKey).not.toHaveBeenCalled();

        useCard();
        await tap();
        expect(mockApproveCardKey).toHaveBeenCalledWith(CARD_KEY);
        expect(op).toHaveBeenCalledTimes(1);
        expect(result.current.phase).toBe('done');
      });

      it('remembers nothing when the handshake fails', async () => {
        useUntrustedCard();
        const { result, op } = await start();
        await tap();
        await act(async () => {
          result.current.proceedWithNonGenuine();
        });

        useCard({
          autoOpenSecureChannel: jest
            .fn()
            .mockRejectedValue(
              new Error('Card authentication failed: invalid signature'),
            ),
        });
        await tap();
        expect(result.current.phase).toBe('error');
        expect(mockApproveCardKey).not.toHaveBeenCalled();
        expect(op).not.toHaveBeenCalled();
      });

      // The write may fail; the approval still holds from memory.
      it('runs the operation even when the approval cannot be saved', async () => {
        mockApproveCardKey.mockRejectedValue(new Error('storage full'));
        useUntrustedCard();
        const { result, op } = await start();
        await tap();
        await act(async () => {
          result.current.proceedWithNonGenuine();
        });
        useCard();
        await tap();
        expect(op).toHaveBeenCalledTimes(1);
        expect(result.current.phase).toBe('done');
      });

      it('forgets the pending question when the user cancels', async () => {
        useUntrustedCard();
        const { result } = await start();
        await tap();
        await act(async () => {
          result.current.cancel();
        });
        expect(result.current.phase).toBe('idle');

        // A later approval of a card without a certificate must not be filed as one with.
        useCard();
        const next = await start();
        await tap();
        expect(next.result.current.phase).toBe('done');
        expect(mockApproveCardKey).not.toHaveBeenCalled();
      });
    });

    it('whitelists the cards approved on an earlier run of the app', async () => {
      mockLoadApprovedCardKeys.mockResolvedValue([CARD_KEY]);
      useCard();
      await start();
      await tap();
      expect(lastWhitelist()).toEqual([new Uint8Array(IDENTITY_KEY)]);
    });

    // A blank card with a certificate has a card key; its status gives it away.
    it('says so when the card is not initialized', async () => {
      const cmdSet = useCard({ applicationInfo: card({ status: 0x00 }) });
      const { result } = await start();
      await tap();
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'This Keycard is not initialized. Initialize it first.',
      );
      expect(cmdSet.autoOpenSecureChannel).not.toHaveBeenCalled();
    });
  });

  // The 3.x wire order must not change.
  describe('cards without a certificate', () => {
    it('still reads the name before it pairs and opens the channel', async () => {
      const cmdSet = makeMockCmdSet();
      mockCommandset.mockImplementation(() => cmdSet);
      mockLoadPairing.mockResolvedValue(null);
      mockCheckGenuine.mockResolvedValue(true);

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {});
      });
      await act(async () => {
        result.current.submitPin('123456');
      });
      await act(async () => {
        await tapCard();
      });

      const order = (fn: jest.Mock) => fn.mock.invocationCallOrder[0];
      expect(order(cmdSet.getData)).toBeLessThan(order(cmdSet.autoPair));
      expect(order(cmdSet.autoPair)).toBeLessThan(
        order(cmdSet.autoOpenSecureChannel),
      );
      expect(order(cmdSet.autoOpenSecureChannel)).toBeLessThan(
        order(cmdSet.verifyPIN),
      );
      expect(mockApproveCardKey).not.toHaveBeenCalled();
    });
  });

  describe('empty PIN guard', () => {
    beforeEach(() => {
      mockCommandset.mockImplementation(() => makeMockCmdSet());
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
        await tapCard();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'Enter your PIN first — tap Retry to continue.',
      );
    });
  });

  describe('master fingerprint fallback', () => {
    beforeEach(() => {
      mockLoadPairing.mockResolvedValue(null);
      mockCheckGenuine.mockResolvedValue(true);
    });

    const makeUnnamedCmdSet = (overrides = {}) => ({
      ...makeMockCmdSet(),
      getData: jest.fn().mockResolvedValue({
        sw: 0x9000,
        data: new Uint8Array([0x20 | 0]), // length-0 name = unnamed card
      }),
      exportKey: jest.fn().mockResolvedValue({
        data: new Uint8Array([0x02]),
        checkOK: jest.fn(),
      }),
      ...overrides,
    });

    async function triggerCardConnect() {
      await act(async () => {
        await tapCard();
      });
    }

    it('derives and exposes the fingerprint for an unnamed card', async () => {
      const cmdSet = makeUnnamedCmdSet();
      mockCommandset.mockImplementation(() => cmdSet);

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
        });
      });
      await triggerCardConnect();

      expect(cmdSet.exportKey).toHaveBeenCalledWith(0, true, 'm', false);
      expect(result.current.cardName).toBe('');
      expect(result.current.cardFingerprint).toBe(0x1a2b3c4d);
    });

    it('continues without a fingerprint when the export fails for a card reason', async () => {
      const cmdSet = makeUnnamedCmdSet({
        exportKey: jest.fn().mockRejectedValue(new Error('SW 0x6985')),
      });
      mockCommandset.mockImplementation(() => cmdSet);

      const { result } = renderHook(() => useKeycardOperation<string>());
      const operation = jest.fn().mockResolvedValue('result');
      await act(async () => {
        result.current.execute(operation, { requiresPin: false });
      });
      await triggerCardConnect();

      // Non-fatal by design: the op still ran, card shown as unnamed.
      expect(operation).toHaveBeenCalled();
      expect(result.current.phase).toBe('done');
      expect(result.current.cardFingerprint).toBeNull();
    });

    it('does NOT swallow a tag loss during the fingerprint export', async () => {
      // Seen on a device: swallowing this sent the operation onto a dead channel.
      const cmdSet = makeUnnamedCmdSet({
        exportKey: jest
          .fn()
          .mockRejectedValue(
            new Error(
              'CardIO Error: android.nfc.TagLostException: Tag was lost.',
            ),
          ),
      });
      mockCommandset.mockImplementation(() => cmdSet);

      const { result } = renderHook(() => useKeycardOperation<string>());
      const operation = jest.fn().mockResolvedValue('result');
      await act(async () => {
        result.current.execute(operation, {
          requiresPin: false,
          retryOnTagLoss: true,
        });
      });
      await triggerCardConnect();

      // The op never ran; the session waits for a re-tap.
      expect(operation).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('nfc');
      expect(result.current.cardPresence).toBe('lost');
    });

    it('skips the fingerprint export for a named card', async () => {
      const cmdSet = {
        ...makeMockCmdSet(),
        exportKey: jest.fn(),
      };
      mockCommandset.mockImplementation(() => cmdSet);

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
        });
      });
      await triggerCardConnect();

      expect(cmdSet.exportKey).not.toHaveBeenCalled();
      expect(result.current.cardFingerprint).toBeNull();
    });

    it('skips the fingerprint export when the card has no master key', async () => {
      const cmdSet = makeUnnamedCmdSet({
        applicationInfo: {
          instanceUID: new Uint8Array([0xaa, 0xbb]),
          initializedCard: true,
          freePairingSlots: 5,
          hasMasterKey: () => false,
        },
      });
      mockCommandset.mockImplementation(() => cmdSet);

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
          requiresMasterKey: false,
        });
      });
      await triggerCardConnect();

      expect(cmdSet.exportKey).not.toHaveBeenCalled();
      expect(result.current.cardFingerprint).toBeNull();
    });

    it('continues the operation when the fingerprint export fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const cmdSet = makeUnnamedCmdSet({
        exportKey: jest.fn().mockRejectedValue(new Error('export boom')),
      });
      mockCommandset.mockImplementation(() => cmdSet);

      const mockOp = jest.fn().mockResolvedValue('done');
      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(mockOp, { requiresPin: false });
      });
      await triggerCardConnect();

      expect(mockOp).toHaveBeenCalledTimes(1);
      expect(result.current.result).toBe('done');
      expect(result.current.cardFingerprint).toBeNull();
      warnSpy.mockRestore();
    });
  });

  describe('pairing password', () => {
    beforeEach(() => {
      mockLoadPairing.mockResolvedValue(null);
      mockCheckGenuine.mockResolvedValue(true);
      mockCommandset.mockImplementation(() => makeMockCmdSet());
    });

    async function triggerCardConnect(_hook: UseKeycardOperation<string>) {
      await act(async () => {
        await tapCard();
      });
    }

    it('enters pairing_password phase when autoPair throws cryptogram error', async () => {
      const { APDUException } = require('keycard-sdk/dist/apdu-exception');
      mockCommandset.mockImplementation(() => ({
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

    it('never closes the reader with the success wording', async () => {
      const { APDUException } = require('keycard-sdk/dist/apdu-exception');
      mockCommandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        autoPair: jest
          .fn()
          .mockRejectedValue(new APDUException('Invalid card cryptogram')),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
          successMessage: 'PIN changed',
        });
      });
      await triggerCardConnect(result.current);
      expect(result.current.phase).toBe('pairing_password');
      expect(mockStopNFCWithMessage).not.toHaveBeenCalled();
      expect(mockStopNFC).not.toHaveBeenCalled();
      expect(mockStopNFCWithError).toHaveBeenCalledWith(
        PAIRING_PASSWORD_NEEDED_STATUS,
      );
    });

    it('transitions to nfc and calls startNFC after submitPairingPassword', async () => {
      const { APDUException } = require('keycard-sdk/dist/apdu-exception');
      mockCommandset.mockImplementation(() => ({
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
      mockCommandset.mockImplementation(() => ({
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
      mockCommandset.mockImplementation(() => ({
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
      mockCommandset.mockImplementation(() => ({
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
      mockCommandset.mockImplementation(() => ({
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
      let callCount = 0;
      mockCommandset.mockImplementation(() => ({
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

  describe('PIN verification', () => {
    beforeEach(() => {
      mockLoadPairing.mockResolvedValue({ pairingIndex: 0 } as any);
      mockCheckGenuine.mockResolvedValue(true);
      mockCommandset.mockImplementation(() => makeMockCmdSet());
    });

    it('sets pinError and returns to pin_entry on wrong PIN', async () => {
      const { WrongPINException } = require('keycard-sdk/dist/apdu-exception');
      const err = new WrongPINException(2);
      mockCommandset.mockImplementation(() => ({
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
        await tapCard();
      });

      expect(result.current.pinError).toBe(
        'PIN is not valid. 2 attempts left.',
      );
      expect(result.current.phase).toBe('pin_entry');
    });

    it('enters error phase with locked message when no attempts remain', async () => {
      const { WrongPINException } = require('keycard-sdk/dist/apdu-exception');
      const err = new WrongPINException(0);
      mockCommandset.mockImplementation(() => ({
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
        await tapCard();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(PIN_BLOCKED_STATUS);
      expect(result.current.pinError).toBeNull();
      // The sheet reads this to offer the unblock flow over a retry.
      expect(result.current.pinBlocked).toBe(true);
    });

    it('names no screen the app does not have', () => {
      expect(PIN_BLOCKED_STATUS).not.toMatch(/option|Unblock Card/);
      expect(PIN_BLOCKED_STATUS).toMatch(/PUK/);
    });

    it('drops the blocked flag when a new operation starts', async () => {
      const { WrongPINException } = require('keycard-sdk/dist/apdu-exception');
      const err = new WrongPINException(0);
      mockCommandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        verifyPIN: jest.fn().mockResolvedValue({
          sw: 0x63c0,
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
        await tapCard();
      });
      expect(result.current.pinBlocked).toBe(true);

      await act(async () => {
        result.current.execute(jest.fn(), { requiresPin: true });
      });
      expect(result.current.pinBlocked).toBe(false);
    });

    it('counts a single remaining attempt in the singular', async () => {
      const { WrongPINException } = require('keycard-sdk/dist/apdu-exception');
      const err = new WrongPINException(1);
      mockCommandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        verifyPIN: jest.fn().mockResolvedValue({
          sw: 0x63c1,
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
        await tapCard();
      });
      expect(result.current.pinError).toBe('PIN is not valid. 1 attempt left.');
      expect(result.current.pinBlocked).toBe(false);
    });
  });

  // PAIR commits a slot before the response is read, so a loss there is never replayed.
  describe('tag loss', () => {
    const TAG_LOST = 'CardIO Error: Error: Tag was lost.';

    it('inside autoPair: error with ambiguity copy, no silent replay', async () => {
      mockLoadPairing.mockResolvedValue(null);
      mockCheckGenuine.mockResolvedValue(true);
      const autoPair = jest.fn().mockRejectedValue(new Error(TAG_LOST));
      mockCommandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        autoPair,
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: false,
          retryOnTagLoss: true,
        });
      });
      await act(async () => {
        await tapCard();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'Connection lost mid-operation. Check the card state before retrying.',
      );
      expect(autoPair).toHaveBeenCalledTimes(1);
      expect(mockStopNFCWithError).toHaveBeenCalled();
    });

    it('outside autoPair with retry opted in: session stays up waiting for a re-tap', async () => {
      mockLoadPairing.mockResolvedValue({ pairingIndex: 1 } as any);
      const operation = jest.fn().mockRejectedValue(new Error(TAG_LOST));
      mockCommandset.mockImplementation(() => makeMockCmdSet());

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(operation, {
          requiresPin: false,
          retryOnTagLoss: true,
        });
      });
      await act(async () => {
        await tapCard();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.cardPresence).toBe('lost');
      expect(mockStopNFCWithError).not.toHaveBeenCalled();
    });

    // An unconfirmed PIN is never resubmitted: the loss is an error and retry re-prompts.
    it('during verifyPIN: error, cached PIN forgotten, retry re-prompts', async () => {
      mockLoadPairing.mockResolvedValue({ pairingIndex: 1 } as any);
      mockCommandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        verifyPIN: jest.fn().mockRejectedValue(new Error(TAG_LOST)),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: true,
          retryOnTagLoss: true,
        });
      });
      expect(result.current.phase).toBe('pin_entry');
      await act(async () => {
        result.current.submitPin('123456');
      });
      await act(async () => {
        await tapCard();
      });
      // Unsafe window suppressed the reconnect wait; no wrong-PIN state.
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'Connection lost mid-operation. Check the card state before retrying.',
      );
      expect(result.current.pinError).toBeNull();

      mockStartNFC.mockClear();
      await act(async () => {
        result.current.retry();
      });
      // The PIN was discarded, so retry shows the PIN pad.
      expect(result.current.phase).toBe('pin_entry');
      expect(mockStartNFC).not.toHaveBeenCalled();
    });

    // From a device report: is this the verifyPIN window, or a retryUnsafeRef left raised?
    it('after an autoPair failure and retry: a verifyPIN loss still fails hard', async () => {
      mockLoadPairing.mockResolvedValue(null);
      mockCheckGenuine.mockResolvedValue(true);
      const autoPair = jest
        .fn()
        .mockRejectedValueOnce(new Error(TAG_LOST))
        .mockResolvedValue(undefined);
      mockCommandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        autoPair,
        verifyPIN: jest.fn().mockRejectedValue(new Error(TAG_LOST)),
      }));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(jest.fn().mockResolvedValue('result'), {
          requiresPin: true,
          retryOnTagLoss: true,
        });
      });
      await act(async () => {
        result.current.submitPin('123456');
      });
      await act(async () => {
        await tapCard();
      });
      expect(result.current.phase).toBe('error');

      await act(async () => {
        result.current.retry();
      });
      await act(async () => {
        await tapCard();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toBe(
        'Connection lost mid-operation. Check the card state before retrying.',
      );
    });

    // A flag left raised by the earlier failure would wrongly fail this safe loss.
    it('an earlier autoPair failure does not poison a later retryable loss', async () => {
      mockLoadPairing.mockResolvedValue(null);
      mockCheckGenuine.mockResolvedValue(true);
      const autoPair = jest
        .fn()
        .mockRejectedValueOnce(new Error(TAG_LOST))
        .mockResolvedValue(undefined);
      mockCommandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        autoPair,
      }));
      const operation = jest.fn().mockRejectedValue(new Error(TAG_LOST));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(operation, {
          requiresPin: true,
          retryOnTagLoss: true,
        });
      });
      await act(async () => {
        result.current.submitPin('123456');
      });
      await act(async () => {
        await tapCard();
      });
      expect(result.current.phase).toBe('error');

      mockStopNFCWithError.mockClear();
      await act(async () => {
        result.current.retry();
      });
      await act(async () => {
        await tapCard();
      });
      // The loss landed in the operation, which opted into retry.
      expect(result.current.phase).toBe('nfc');
      expect(result.current.cardPresence).toBe('lost');
      expect(mockStopNFCWithError).not.toHaveBeenCalled();
    });

    it('after a verified PIN: a loss during a RE-verify keeps the reconnect wait', async () => {
      // A PIN that already verified is safe to replay: a correct verify resets the counter.
      mockLoadPairing.mockResolvedValue({ pairingIndex: 1 } as any);
      const verifyPIN = jest
        .fn()
        .mockResolvedValueOnce({ sw: 0x9000, checkAuthOK: jest.fn() })
        .mockRejectedValue(new Error(TAG_LOST));
      mockCommandset.mockImplementation(() => ({
        ...makeMockCmdSet(),
        verifyPIN,
      }));
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error(TAG_LOST))
        .mockResolvedValue('result');

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(operation, {
          requiresPin: true,
          retryOnTagLoss: true,
        });
      });
      await act(async () => {
        result.current.submitPin('123456');
      });
      // First tap: PIN verifies, then the operation loses the card.
      await act(async () => {
        await tapCard();
      });
      expect(result.current.phase).toBe('nfc');

      // Re-tap: the re-verify itself loses the card. Still recoverable.
      await act(async () => {
        await tapCard();
      });
      expect(result.current.phase).toBe('nfc');
      expect(result.current.cardPresence).toBe('lost');
      expect(mockStopNFCWithError).not.toHaveBeenCalled();
    });

    it('after a verified PIN: tag loss in the operation keeps the reconnect wait and the PIN', async () => {
      mockLoadPairing.mockResolvedValue({ pairingIndex: 1 } as any);
      mockCommandset.mockImplementation(() => makeMockCmdSet());
      const operation = jest.fn().mockRejectedValue(new Error(TAG_LOST));

      const { result } = renderHook(() => useKeycardOperation<string>());
      await act(async () => {
        result.current.execute(operation, {
          requiresPin: true,
          retryOnTagLoss: true,
        });
      });
      await act(async () => {
        result.current.submitPin('123456');
      });
      await act(async () => {
        await tapCard();
      });
      // The PIN is proven this session, so the reconnect wait stays.
      expect(result.current.phase).toBe('nfc');
      expect(result.current.cardPresence).toBe('lost');

      mockStartNFC.mockClear();
      await act(async () => {
        result.current.retry();
      });
      // Retry keeps the verified PIN: reader restarts, no re-prompt.
      expect(result.current.phase).toBe('nfc');
      expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
    });
  });
});

describe('NFC re-enabled resume', () => {
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

  it('hands back its success message, for the screen to show after the tap', () => {
    const { result } = renderHook(() =>
      useKeycardOp<string>(jest.fn(), { successMessage: 'Card named' }),
    );
    expect(result.current.successMessage).toBe('Card named');
  });

  it('start() transitions to nfc when requiresPin is false', async () => {
    const { result } = renderHook(() =>
      useKeycardOp<string>(jest.fn(), { requiresPin: false }),
    );
    await act(async () => {
      result.current.start();
    });
    expect(result.current.phase).toBe('nfc');
    expect(mockStartNFC).toHaveBeenCalledWith('Tap your Keycard');
  });

  it('start() transitions to pin_entry when requiresPin is true (default)', async () => {
    const { result } = renderHook(() => useKeycardOp<string>(jest.fn()));
    await act(async () => {
      result.current.start();
    });
    expect(result.current.phase).toBe('pin_entry');
    expect(mockStartNFC).not.toHaveBeenCalled();
  });
});

// The input start() is given rides with the queued operation.
describe('the operation input', () => {
  type Op = jest.Mock<Promise<string>, [unknown, string, any]>;
  type Hook = { current: ReturnType<typeof useKeycardOp<string, string>> };

  beforeEach(() => {
    mockStartNFC.mockResolvedValue(undefined);
    mockStopNFC.mockResolvedValue(undefined);
    mockStopNFCWithError.mockResolvedValue(undefined);
    mockStopNFCWithMessage.mockResolvedValue(undefined);
    mockIsNFCEnabled.mockResolvedValue(true);
    mockStartNFC.mockClear();
    capturedAppStateListener = null;
    (AppState.addEventListener as jest.Mock).mockImplementation(
      (_event: string, cb: (state: string) => void) => {
        capturedAppStateListener = cb;
        return { remove: jest.fn() };
      },
    );
    mockCheckGenuine.mockReset().mockResolvedValue(true);
    mockLoadPairing.mockReset().mockResolvedValue({ pairingIndex: 0 } as any);
    mockLoadApprovedCardKeys.mockReset().mockResolvedValue([]);
    mockCommandset.mockImplementation(() => makeMockCmdSet());
  });

  async function tap() {
    await act(async () => {
      await tapCard();
    });
  }

  async function startAndTap(result: Hook, { pin = true } = {}) {
    await act(async () => {
      result.current.start('input');
    });
    if (pin) {
      await act(async () => {
        result.current.submitPin('123456');
      });
    }
    await tap();
  }

  function discarding(): Op {
    return jest.fn(async (_cmdSet, _input, { discardInput }) => {
      discardInput();
      throw new Error('refused');
    });
  }

  it('hands the operation the input start() was given', async () => {
    const op: Op = jest.fn().mockResolvedValue('done');
    const { result } = renderHook(() => useKeycardOp(op));
    await startAndTap(result);

    expect(op).toHaveBeenCalledWith(
      expect.anything(),
      'input',
      expect.objectContaining({
        setStatus: expect.any(Function),
        discardInput: expect.any(Function),
      }),
    );
    expect(result.current.phase).toBe('done');
  });

  it.each([
    ['a refusal', new Error('refused')],
    ['a lost tap', new Error('Tag was lost.')],
  ])('sends the same input on Try again after %s', async (_, failure) => {
    const op: Op = jest
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce('done');
    const { result } = renderHook(() => useKeycardOp(op));
    await startAndTap(result);
    expect(result.current.phase).toBe('error');

    await act(async () => {
      result.current.retry();
    });
    await tap();

    expect(op.mock.calls.map(call => call[1])).toEqual(['input', 'input']);
    expect(result.current.phase).toBe('done');
  });

  it('sends the same input after a wrong PIN', async () => {
    const { WrongPINException } = require('keycard-sdk/dist/apdu-exception');
    const verifyPIN = jest
      .fn()
      .mockResolvedValueOnce({
        sw: 0x63c2,
        checkAuthOK: () => {
          throw new WrongPINException(2);
        },
      })
      .mockResolvedValue({ sw: 0x9000, checkAuthOK: jest.fn() });
    mockCommandset.mockImplementation(() => ({
      ...makeMockCmdSet(),
      verifyPIN,
    }));
    const op: Op = jest.fn().mockResolvedValue('done');
    const { result } = renderHook(() => useKeycardOp(op));
    await startAndTap(result);
    expect(result.current.phase).toBe('pin_entry');

    await act(async () => {
      result.current.submitPin('654321');
    });
    await tap();

    expect(op).toHaveBeenCalledTimes(1);
    expect(op.mock.calls[0][1]).toBe('input');
  });

  it('sends the same input on the tap after the genuine warning', async () => {
    mockLoadPairing.mockResolvedValue(null);
    mockCheckGenuine.mockResolvedValueOnce(false);
    const op: Op = jest.fn().mockResolvedValue('done');
    const { result } = renderHook(() => useKeycardOp(op));
    await startAndTap(result);
    expect(result.current.phase).toBe('genuine_warning');

    await act(async () => {
      result.current.proceedWithNonGenuine();
    });
    await tap();

    expect(op).toHaveBeenCalledTimes(1);
    expect(op.mock.calls[0][1]).toBe('input');
  });

  it('sends the same input on the re-tap after a lost read', async () => {
    const op: Op = jest
      .fn()
      .mockRejectedValueOnce(new Error('Tag was lost.'))
      .mockResolvedValueOnce('done');
    const { result } = renderHook(() =>
      useKeycardOp(op, { retryOnTagLoss: true }),
    );
    await startAndTap(result);
    expect(result.current.phase).toBe('nfc');

    await tap();

    expect(op.mock.calls.map(call => call[1])).toEqual(['input', 'input']);
    expect(result.current.phase).toBe('done');
  });

  it('sends the same input when NFC comes back on', async () => {
    mockIsNFCEnabled.mockResolvedValue(false);
    const op: Op = jest.fn().mockResolvedValue('done');
    const { result } = renderHook(() =>
      useKeycardOp(op, { requiresPin: false }),
    );
    await act(async () => {
      result.current.start('input');
    });
    await act(async () => {});
    expect(result.current.phase).toBe('error');

    mockIsNFCEnabled.mockResolvedValue(true);
    await act(async () => {
      capturedAppStateListener?.('active');
    });
    await act(async () => {});
    await tap();

    expect(op).toHaveBeenCalledTimes(1);
    expect(op.mock.calls[0][1]).toBe('input');
  });

  // Without a PIN, so the PIN check in retry() cannot hide a kept operation.
  it('keeps nothing to send once the operation succeeds', async () => {
    const op: Op = jest.fn().mockResolvedValue('done');
    const { result } = renderHook(() =>
      useKeycardOp(op, { requiresPin: false }),
    );
    await startAndTap(result, { pin: false });
    mockStartNFC.mockClear();

    await act(async () => {
      result.current.retry();
    });

    expect(mockStartNFC).not.toHaveBeenCalled();
    expect(op).toHaveBeenCalledTimes(1);
  });

  // The next operation asks for the PIN instead of reusing the last one.
  it('forgets the PIN once the operation succeeds', async () => {
    const op: Op = jest.fn().mockResolvedValue('done');
    const { result } = renderHook(() => useKeycardOp(op));
    await startAndTap(result);
    await act(async () => {
      result.current.start('next');
    });
    mockStartNFC.mockClear();

    await act(async () => {
      result.current.retry();
    });

    expect(mockStartNFC).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'reset'] as const)(
    'keeps nothing to send after %s',
    async ending => {
      const op: Op = jest.fn().mockRejectedValue(new Error('refused'));
      const { result } = renderHook(() =>
        useKeycardOp(op, { requiresPin: false }),
      );
      await startAndTap(result, { pin: false });
      await act(async () => {
        result.current[ending]();
      });
      mockStartNFC.mockClear();

      await act(async () => {
        result.current.retry();
      });

      expect(mockStartNFC).not.toHaveBeenCalled();
    },
  );

  it('never sends a discarded input again', async () => {
    const op = discarding();
    const { result } = renderHook(() => useKeycardOp(op));
    await startAndTap(result);
    expect(result.current.phase).toBe('error');
    mockStartNFC.mockClear();

    await act(async () => {
      result.current.retry();
    });

    expect(mockStartNFC).not.toHaveBeenCalled();
    expect(op).toHaveBeenCalledTimes(1);
  });

  // Defensive: a phone's bridge forwards no tap after an error, but one that reaches the runner sends nothing past SELECT.
  it('sends nothing on a tap after the input was discarded', async () => {
    let cmdSet = makeMockCmdSet();
    mockCommandset.mockImplementation(() => (cmdSet = makeMockCmdSet()));
    const op = discarding();
    const { result } = renderHook(() => useKeycardOp(op));
    await startAndTap(result);

    await tap();

    expect(result.current.status).toBe(NOTHING_TO_SEND_STATUS);
    expect(cmdSet.getData).not.toHaveBeenCalled();
    expect(cmdSet.autoOpenSecureChannel).not.toHaveBeenCalled();
    expect(cmdSet.verifyPIN).not.toHaveBeenCalled();
    expect(op).toHaveBeenCalledTimes(1);
  });
});
