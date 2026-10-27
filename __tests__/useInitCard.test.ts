import { act, renderHook } from '@testing-library/react-native';

import { PAIRING_PASSWORD } from '../src/constants/keycard';

import {
  UNVERIFIED_CARD_STATUS,
  useInitCard,
} from '../src/hooks/keycard/useInitCard';

import {
  cancelSheet,
  insertCard,
  loseCard,
  mockCommandset,
  mockStartNFC,
  mockStopNFC,
  mockStopNFCWithError,
  mockStopNFCWithMessage,
  resetFakeCard,
  tapCard,
  timeOut,
} from './fakeCard.testUtils';
import { filler, v4Select } from './selectResponse.testUtils';

// ---------------------------------------------------------------------------
// The fake card
// ---------------------------------------------------------------------------

jest.mock(
  'react-native-keycard',
  () => require('./fakeCard.testUtils').bridgeModule,
);

const mockInit = jest.fn();
const mockSelect = jest.fn();
const mockCmdSet = {
  select: mockSelect,
  applicationInfo: { initializedCard: false } as unknown,
  init: mockInit,
};

const mockLoadApprovedCardKeys = jest.fn();
const mockApproveCardKey = jest.fn();
jest.mock('../src/storage/approvedCardsStorage', () => ({
  loadApprovedCardKeys: () => mockLoadApprovedCardKeys(),
  approveCardKey: (cardKey: string) => mockApproveCardKey(cardKey),
}));

jest.mock('keycard-sdk', () => require('./fakeCard.testUtils').sdkModule());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useInitCard', () => {
  beforeEach(() => {
    resetFakeCard();
    insertCard(mockCmdSet);
    mockSelect.mockResolvedValue({ sw: 0x9000 });
    mockInit.mockResolvedValue({ sw: 0x9000, checkOK: jest.fn() });
    mockSelect.mockClear();
    mockInit.mockClear();
    mockLoadApprovedCardKeys.mockReset().mockResolvedValue([]);
    mockApproveCardKey.mockReset().mockResolvedValue(undefined);
    mockCmdSet.applicationInfo = { initializedCard: false };
  });

  describe('initial state', () => {
    it('starts idle with empty status and no result', () => {
      const { result } = renderHook(() => useInitCard());
      expect(result.current.phase).toBe('idle');
      expect(result.current.status).toBe('');
      expect(result.current.result).toBeNull();
    });

    // One PUK per screen: sent on every tap, shown once one succeeds.
    it('holds a 12-digit PUK from the start', () => {
      const { result } = renderHook(() => useInitCard());
      expect(result.current.puk).toMatch(/^\d{12}$/);
    });

    it('keeps the same PUK across renders', () => {
      const { result, rerender } = renderHook(() => useInitCard());
      const puk = result.current.puk;
      rerender(undefined);
      expect(result.current.puk).toBe(puk);
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

  // The sheet's "Try again" needs the hook to carry a retry.
  describe('retry', () => {
    it('opens the reader again after an error', async () => {
      mockSelect.mockResolvedValueOnce({ sw: 0x6a82 });
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
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

      await act(async () => {
        await tapCard();
      });
      expect(mockInit).toHaveBeenCalledWith(
        '123456',
        result.current.puk,
        PAIRING_PASSWORD,
        undefined,
      );
    });

    it('has nothing to send after cancel', async () => {
      mockSelect.mockResolvedValueOnce({ sw: 0x6a82 });
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      await act(async () => {
        await tapCard();
      });
      await act(async () => {
        result.current.cancel();
      });
      mockStartNFC.mockClear();

      await act(async () => {
        result.current.retry();
      });
      expect(mockStartNFC).not.toHaveBeenCalled();
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
        cancelSheet();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('user-cancelled does not change phase when idle', async () => {
      const { result } = renderHook(() => useInitCard());
      expect(result.current.phase).toBe('idle');
      await act(async () => {
        cancelSheet();
      });
      expect(result.current.phase).toBe('idle');
    });

    it('timeout updates status message when in nfc phase', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      await act(async () => {
        timeOut();
      });
      expect(result.current.status).toBe('Timed out — tap again');
    });

    it('card disconnected during nfc updates status and stays in nfc', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
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
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        loseCard();
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
        await tapCard();
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
        await tapCard();
      });

      expect(mockInit).toHaveBeenCalledWith(
        '123456',
        result.current.puk,
        expect.anything(),
        undefined,
      );
      expect(result.current.phase).toBe('done');
    });

    // The digits already on paper are the digits the card gets.
    it('sends the same PUK on a tap after a failed one', async () => {
      mockSelect.mockResolvedValueOnce({ sw: 0x6a82 });
      const { result } = renderHook(() => useInitCard());
      const puk = result.current.puk;
      await act(async () => {
        result.current.start('123456');
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
      expect(result.current.phase).toBe('done');
      expect(result.current.puk).toBe(puk);
      expect(mockInit.mock.calls[0][1]).toBe(puk);
    });

    it('passes duress pin when provided', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456', '000000');
      });
      await act(async () => {
        await tapCard();
      });

      expect(mockInit).toHaveBeenCalledWith(
        '123456',
        expect.stringMatching(/^\d{12}$/),
        expect.anything(),
        '000000',
      );
    });
  });
  // A card with a certificate: INIT inside the channel, no pairing secret, judged first.
  describe('cards with a certificate', () => {
    const UNKNOWN_CA =
      'Card certificate verification failed: unknown CA public key and card not whitelisted';
    const IDENTITY_KEY = filler(33, 0x02);
    const CARD_KEY = '02'.repeat(33);
    const CERTIFICATE = [...IDENTITY_KEY, ...filler(65, 0x09)];

    function blankCard() {
      return v4Select(0x0400, { status: 0x00, certificate: CERTIFICATE });
    }

    function lastWhitelist(): Uint8Array[] {
      const calls = mockCommandset.mock.calls;
      return calls[calls.length - 1][2];
    }

    async function startAndTap(duressPin?: string) {
      const hook = renderHook(() => useInitCard());
      await act(async () => {
        hook.result.current.start('123456', duressPin);
      });
      await act(async () => {
        await tapCard();
      });
      return hook;
    }

    async function tapAgain() {
      await act(async () => {
        await tapCard();
      });
    }

    beforeEach(() => {
      mockCmdSet.applicationInfo = blankCard();
    });

    describe('signed by the Keycard CA', () => {
      // PIN and PUK only: such a card has no pairing.
      it('initializes through the SDK, with no pairing secret', async () => {
        const { result } = await startAndTap();
        expect(mockInit).toHaveBeenCalledWith(
          '123456',
          expect.stringMatching(/^[0-9]{12}$/),
          undefined,
          undefined,
        );
        expect(result.current.phase).toBe('done');
      });

      it('sends the PUK it shows', async () => {
        const { result } = await startAndTap();
        expect(mockInit.mock.calls[0][1]).toBe(result.current.puk);
      });

      it('passes the duress PIN when one was chosen', async () => {
        await startAndTap('654321');
        expect(mockInit.mock.calls[0][2]).toBeUndefined();
        expect(mockInit.mock.calls[0][3]).toBe('654321');
      });

      // init() returns the card's answer, so a refusal must not read as success.
      it('fails when the card refuses INIT', async () => {
        mockInit.mockResolvedValue({
          sw: 0x6985,
          checkOK: () => {
            throw new Error('Initializing the Keycard failed');
          },
        });
        const { result } = await startAndTap();
        expect(result.current.phase).toBe('error');
        expect(result.current.status).toBe('Initializing the Keycard failed');
        expect(result.current.result).toBeNull();
      });

      it('remembers no approval, because none was needed', async () => {
        await startAndTap();
        expect(mockApproveCardKey).not.toHaveBeenCalled();
      });
    });

    it('keeps no approval for a card that reports no card key', async () => {
      mockCmdSet.applicationInfo = v4Select(0x0400, {
        status: 0x00,
        certificate: null,
      });
      const { result } = await startAndTap();
      expect(result.current.phase).toBe('done');
      expect(mockApproveCardKey).not.toHaveBeenCalled();
    });

    it('approving with no card waiting only opens the reader again', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      mockStartNFC.mockClear();
      await act(async () => {
        result.current.proceedWithNonGenuine();
      });
      expect(mockStartNFC).toHaveBeenCalledTimes(1);
      await tapAgain();
      expect(lastWhitelist()).toEqual([]);
    });

    describe('signed by an unknown CA', () => {
      beforeEach(() => {
        mockSelect.mockRejectedValue(new Error(UNKNOWN_CA));
      });

      // Nothing is written to a card the user has not accepted.
      it('asks before anything is written', async () => {
        const { result } = await startAndTap();
        expect(result.current.phase).toBe('genuine_warning');
        expect(mockInit).not.toHaveBeenCalled();
      });

      // A tap that returned would close Apple's sheet with "Card initialized".
      it('closes the tap as unverified, not as initialized', async () => {
        await startAndTap();
        expect(mockStopNFCWithError).toHaveBeenCalledWith(
          UNVERIFIED_CARD_STATUS,
        );
        expect(mockStopNFCWithMessage).not.toHaveBeenCalled();
        expect(UNVERIFIED_CARD_STATUS).toContain('Nothing was written');
      });

      it('sets the card up on the tap after approval, PIN not typed again', async () => {
        const { result } = await startAndTap();
        mockSelect.mockResolvedValue({ sw: 0x9000 });
        await act(async () => {
          result.current.proceedWithNonGenuine();
        });
        expect(result.current.phase).toBe('nfc');
        await tapAgain();

        expect(lastWhitelist()).toEqual([new Uint8Array(IDENTITY_KEY)]);
        expect(mockInit.mock.calls[0][0]).toBe('123456');
        expect(mockInit.mock.calls[0][1]).toBe(result.current.puk);
        expect(result.current.phase).toBe('done');
      });

      // An accepted INIT proves the handshake succeeded.
      it('remembers the approval only once the card has accepted INIT', async () => {
        const { result } = await startAndTap();
        mockSelect.mockResolvedValue({ sw: 0x9000 });
        await act(async () => {
          result.current.proceedWithNonGenuine();
        });
        expect(mockApproveCardKey).not.toHaveBeenCalled();
        await tapAgain();
        expect(mockApproveCardKey).toHaveBeenCalledWith(CARD_KEY);
      });

      it('remembers nothing when the handshake fails', async () => {
        const { result } = await startAndTap();
        mockSelect.mockResolvedValue({ sw: 0x9000 });
        mockInit.mockRejectedValue(
          new Error('Card authentication failed: invalid signature'),
        );
        await act(async () => {
          result.current.proceedWithNonGenuine();
        });
        await tapAgain();
        expect(result.current.phase).toBe('error');
        expect(mockApproveCardKey).not.toHaveBeenCalled();
      });

      it('remembers nothing when the card refuses INIT', async () => {
        const { result } = await startAndTap();
        mockSelect.mockResolvedValue({ sw: 0x9000 });
        mockInit.mockResolvedValue({
          sw: 0x6985,
          checkOK: () => {
            throw new Error('Initializing the Keycard failed');
          },
        });
        await act(async () => {
          result.current.proceedWithNonGenuine();
        });
        await tapAgain();
        expect(result.current.phase).toBe('error');
        expect(mockApproveCardKey).not.toHaveBeenCalled();
      });

      it.each(['cancel', 'reset'] as const)(
        'drops the question on %s',
        async action => {
          const { result } = await startAndTap();
          await act(async () => {
            result.current[action]();
          });
          expect(result.current.phase).toBe('idle');
        },
      );
    });
  });

  // INIT is the tap's last command, and a write never replays (ADR-0007): a loss
  // inside it leaves the card's state unknown, and the PUK it may hold is offered.
  describe('the window after INIT', () => {
    const TAG_LOST = 'Tag was lost.';

    async function startAndTap(hook = renderHook(() => useInitCard())) {
      await act(async () => {
        hook.result.current.start('123456');
      });
      await act(async () => {
        await tapCard();
      });
      return hook;
    }

    it('is closed before the tap', () => {
      const { result } = renderHook(() => useInitCard());
      expect(result.current.initSent).toBe(false);
    });

    it('is open while the card has INIT and has not answered', async () => {
      let answer: (resp: unknown) => void = () => {};
      mockInit.mockReturnValue(new Promise(resolve => (answer = resolve)));
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      await act(async () => {
        tapCard();
      });
      expect(result.current.initSent).toBe(true);
      expect(result.current.phase).toBe('nfc');

      await act(async () => {
        answer({ sw: 0x9000, checkOK: jest.fn() });
      });
      expect(result.current.initSent).toBe(false);
      expect(result.current.phase).toBe('done');
    });

    it('stays open when the card leaves the field before answering', async () => {
      mockInit.mockRejectedValue(new Error(TAG_LOST));
      const { result } = await startAndTap();
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toMatch(/lost mid-operation/);
      expect(result.current.initSent).toBe(true);
    });

    it('stays open through a retry that finds the card set up', async () => {
      mockInit.mockRejectedValue(new Error(TAG_LOST));
      const { result } = await startAndTap();
      mockCmdSet.applicationInfo = { initializedCard: true };
      await act(async () => {
        result.current.retry();
      });
      await act(async () => {
        await tapCard();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.status).toMatch(/already set up/);
      expect(result.current.initSent).toBe(true);
      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    it('closes when a retry sets the card up after all', async () => {
      mockInit.mockRejectedValueOnce(new Error(TAG_LOST));
      const { result } = await startAndTap();
      await act(async () => {
        result.current.retry();
      });
      await act(async () => {
        await tapCard();
      });
      expect(result.current.phase).toBe('done');
      expect(result.current.initSent).toBe(false);
    });

    // Dismissing the error is how the screen reaches the PUK.
    it('survives cancel and ends with reset', async () => {
      mockInit.mockRejectedValue(new Error(TAG_LOST));
      const { result } = await startAndTap();
      await act(async () => {
        result.current.cancel();
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.initSent).toBe(true);

      await act(async () => {
        result.current.reset();
      });
      expect(result.current.initSent).toBe(false);
    });

    it('closes when the card refuses INIT: nothing was written', async () => {
      mockCmdSet.applicationInfo = v4Select(0x0400, {
        status: 0x00,
        certificate: [...filler(33, 0x02), ...filler(65, 0x09)],
      });
      mockInit.mockResolvedValue({
        sw: 0x6985,
        checkOK: () => {
          throw new Error('Initializing the Keycard failed');
        },
      });
      const { result } = await startAndTap();
      expect(result.current.phase).toBe('error');
      expect(result.current.initSent).toBe(false);
    });

    it.each([
      ['SELECT fails', () => mockSelect.mockResolvedValueOnce({ sw: 0x6a82 })],
      [
        'the card is already set up',
        () => {
          mockCmdSet.applicationInfo = { initializedCard: true };
        },
      ],
      [
        'the certificate is from an unknown CA',
        () => {
          mockCmdSet.applicationInfo = v4Select(0x0400, {
            status: 0x00,
            certificate: [...filler(33, 0x02), ...filler(65, 0x09)],
          });
          mockSelect.mockRejectedValue(
            new Error(
              'Card certificate verification failed: unknown CA public key and card not whitelisted',
            ),
          );
        },
      ],
    ])('never opens when %s', async (_name, arrange) => {
      arrange();
      const { result } = await startAndTap();
      expect(mockInit).not.toHaveBeenCalled();
      expect(result.current.initSent).toBe(false);
    });
  });

  // Every card in the field: INIT with the pairing secret, exactly as before.
  describe('cards without a certificate', () => {
    it('still goes through the SDK init() with the pairing secret', async () => {
      const { result } = renderHook(() => useInitCard());
      await act(async () => {
        result.current.start('123456');
      });
      await act(async () => {
        await tapCard();
      });
      expect(mockInit).toHaveBeenCalledWith(
        '123456',
        expect.stringMatching(/^[0-9]{12}$/),
        PAIRING_PASSWORD,
        undefined,
      );
    });
  });
});
