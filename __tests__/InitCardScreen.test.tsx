import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import InitCardScreen, { dashboardEntry } from '../src/screens/InitCardScreen';
import NFCBottomSheet from '../src/components/NFCBottomSheet';

import { testPreferences as mockTestPreferences } from './preferences.testUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));
const MockNFCBottomSheet = NFCBottomSheet as jest.MockedFunction<
  typeof NFCBottomSheet
>;

jest.mock('@react-native-community/blur', () => ({
  BlurView: 'BlurView',
}));

// The PUK review's write-it-down timer, already done unless a test says otherwise.
let mockTimer = { timeLeft: 0, done: true, start: jest.fn() };
jest.mock('../src/hooks/useSeedReviewTimer', () => ({
  useSeedReviewTimer: () => mockTimer,
}));

// useFocusEffect only registers the hardware-back handler; a no-op here.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// PinPad reads the scramble preference from context.
jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: mockTestPreferences({ pinPadScramble: false }),
    setPreference: jest.fn(),
  }),
}));

const mockStart = jest.fn();
const mockCancel = jest.fn();
const mockReset = jest.fn();
const mockUseInitCard = jest.fn();

jest.mock('../src/hooks/keycard/useInitCard', () => ({
  useInitCard: () => mockUseInitCard(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = {
  goBack: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
} as any;

const route = { key: 'InitCard', name: 'InitCard' } as any;

const PUK = '123456789012';

function hookMock(phase: string) {
  return {
    phase,
    status: '',
    result: null,
    puk: PUK,
    start: mockStart,
    cancel: mockCancel,
    reset: mockReset,
  };
}

async function renderScreen(phase = 'idle') {
  mockUseInitCard.mockReturnValue(hookMock(phase));
  const result = render(
    <InitCardScreen navigation={navigation} route={route} />,
  );
  await act(async () => {});
  return result;
}

function lastBeforeRemoveHandler() {
  const call = navigation.addListener.mock.calls
    .slice()
    .reverse()
    .find(([event]: [string]) => event === 'beforeRemove');
  return call?.[1];
}

/** Press a digit key six times to complete a full PIN entry. keyIndex 0 = '1', 1 = '2'. */
async function enterPin(keyIndex = 0) {
  const digit = String(keyIndex + 1);
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      fireEvent.press(screen.getByText(digit));
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InitCardScreen', () => {
  beforeEach(() => {
    mockStart.mockClear();
    mockCancel.mockClear();
    mockReset.mockClear();
    MockNFCBottomSheet.mockClear();
    navigation.goBack.mockClear();
    navigation.reset.mockClear();
    navigation.setOptions.mockClear();
    mockTimer = { timeLeft: 0, done: true, start: jest.fn() };
  });

  // -------------------------------------------------------------------------
  // Static
  // -------------------------------------------------------------------------

  describe('initial render', () => {
    it('sets header title to "Create a PIN" on first render', async () => {
      await renderScreen();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Create a PIN',
      });
    });

    it('shows the PIN pad on first render', async () => {
      await renderScreen();
      expect(screen.getByText('6 digits')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Step transitions
  // -------------------------------------------------------------------------

  describe('step transitions', () => {
    it('moves to pin_confirm after 6 digits are entered', async () => {
      await renderScreen();
      navigation.setOptions.mockClear();
      await enterPin(0);
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Confirm your PIN',
      });
    });

    it('moves to duress_question after the PIN is confirmed correctly', async () => {
      await renderScreen();
      await enterPin(0);
      await enterPin(0);
      expect(screen.getByText('Add a duress PIN?')).toBeTruthy();
    });

    it('shows an error when the confirmed PIN does not match', async () => {
      await renderScreen();
      await enterPin(0);
      await enterPin(1);
      expect(screen.getByText("PINs don't match")).toBeTruthy();
    });

    it('stays on pin_confirm after a mismatch (does not advance)', async () => {
      await renderScreen();
      navigation.setOptions.mockClear();
      await enterPin(0);
      await enterPin(1);
      // Title remains 'Confirm your PIN' (no advancement to duress_question)
      expect(navigation.setOptions).not.toHaveBeenCalledWith({
        title: 'Initialize Card',
      });
      expect(screen.queryByText('Add a duress PIN?')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // ConfirmPrompt callbacks
  // -------------------------------------------------------------------------

  describe('duress question', () => {
    async function reachConfirmPrompt() {
      const view = await renderScreen();
      await enterPin(0);
      await enterPin(0);
      return view;
    }

    it('moves to the PUK review when No is pressed, without tapping yet', async () => {
      await reachConfirmPrompt();
      await act(async () => {
        fireEvent.press(screen.getByText('No, skip'));
      });
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Write down your PUK',
      });
      expect(screen.getByText('1234 5678 9012')).toBeTruthy();
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('moves to duress_entry when Yes is pressed', async () => {
      await reachConfirmPrompt();
      navigation.setOptions.mockClear();
      await act(async () => {
        fireEvent.press(screen.getByText('Yes, add duress PIN'));
      });
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Create a duress PIN',
      });
    });
  });

  // -------------------------------------------------------------------------
  // Duress PIN entry
  // -------------------------------------------------------------------------

  describe('duress PIN entry', () => {
    async function reachDuressEntry() {
      const view = await renderScreen();
      await enterPin(0);
      await enterPin(0);
      await act(async () => {
        fireEvent.press(screen.getByText('Yes, add duress PIN'));
      });
      return view;
    }

    it('moves to duress_confirm after 6 duress digits', async () => {
      await reachDuressEntry();
      navigation.setOptions.mockClear();
      await enterPin(1);
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Confirm duress PIN',
      });
    });

    it('moves to the PUK review when duress confirm matches, without tapping yet', async () => {
      await reachDuressEntry();
      await enterPin(1);
      await enterPin(1);
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Write down your PUK',
      });
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('shows an error when duress confirm does not match', async () => {
      await reachDuressEntry();
      await enterPin(1);
      await enterPin(0);
      expect(screen.getByText("PINs don't match")).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // PUK review
  // -------------------------------------------------------------------------

  // The last step before the tap: the card is written only once the PUK is on paper.
  describe('PUK review', () => {
    async function reachPukReview(withDuress = false) {
      const view = await renderScreen();
      await enterPin(0);
      await enterPin(0);
      if (withDuress) {
        await act(async () => {
          fireEvent.press(screen.getByText('Yes, add duress PIN'));
        });
        await enterPin(1);
        await enterPin(1);
      } else {
        await act(async () => {
          fireEvent.press(screen.getByText('No, skip'));
        });
      }
      return view;
    }

    async function reveal() {
      await act(async () => {
        fireEvent.press(screen.getByText('Reveal PUK'));
      });
    }

    it("shows the hook's PUK behind a reveal", async () => {
      await reachPukReview();
      expect(screen.getByText('1234 5678 9012')).toBeTruthy();
      expect(screen.UNSAFE_queryAllByType('BlurView' as any)).toHaveLength(1);
      expect(screen.getByText('Reveal PUK')).toBeTruthy();
    });

    it('starts the tap with the PIN and no duress PIN once written down', async () => {
      await reachPukReview();
      await reveal();
      await act(async () => {
        fireEvent.press(screen.getByText("I've written it down"));
      });
      expect(mockStart).toHaveBeenCalledTimes(1);
      expect(mockStart).toHaveBeenCalledWith('111111', null);
    });

    it('starts the tap with the PIN and the duress PIN once written down', async () => {
      await reachPukReview(true);
      await reveal();
      await act(async () => {
        fireEvent.press(screen.getByText("I've written it down"));
      });
      expect(mockStart).toHaveBeenCalledWith('111111', '222222');
    });

    it('waits for the review timer before the tap can start', async () => {
      mockTimer = { timeLeft: 8, done: false, start: jest.fn() };
      await reachPukReview();
      await reveal();
      expect(mockTimer.start).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Write down your PUK (8s)')).toBeTruthy();
      const button = screen.getByTestId('primary-button');
      expect(button.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(button);
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('goes back to the duress question before leaving', async () => {
      await reachPukReview();
      const event = { preventDefault: jest.fn() };
      await act(async () => {
        lastBeforeRemoveHandler()?.(event);
      });
      expect(event.preventDefault).toHaveBeenCalled();
      expect(screen.getByText('Add a duress PIN?')).toBeTruthy();
    });

    it('goes back to the duress confirmation when a duress PIN was set', async () => {
      await reachPukReview(true);
      navigation.setOptions.mockClear();
      const event = { preventDefault: jest.fn() };
      await act(async () => {
        lastBeforeRemoveHandler()?.(event);
      });
      expect(event.preventDefault).toHaveBeenCalled();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Confirm duress PIN',
      });
    });

    it('is hidden while the card is being read', async () => {
      await renderScreen('nfc');
      expect(screen.queryByText('Reveal PUK')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // NFCBottomSheet visibility
  // -------------------------------------------------------------------------

  describe('NFCBottomSheet visibility', () => {
    function lastProps() {
      const calls = MockNFCBottomSheet.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('nfc.phase is idle when phase is idle', async () => {
      await renderScreen('idle');
      expect(lastProps().nfc.phase).toBe('idle');
    });

    it('nfc.phase is nfc when phase is nfc', async () => {
      await renderScreen('nfc');
      expect(lastProps().nfc.phase).toBe('nfc');
    });

    it('nfc.phase is error when phase is error', async () => {
      await renderScreen('error');
      expect(lastProps().nfc.phase).toBe('error');
    });

    it('nfc.phase is done and showOnDone is true when phase is done', async () => {
      await renderScreen('done');
      expect(lastProps().nfc.phase).toBe('done');
      expect(lastProps().showOnDone).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Navigation after done
  // -------------------------------------------------------------------------

  describe('navigation', () => {
    // The PUK was shown before the tap, so done has nothing left to show.
    it('navigates to Dashboard when phase is done', async () => {
      await renderScreen('done');
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Dashboard', params: { toast: 'Card initialized' } }],
      });
    });

    it('cancels NFC when leaving during NFC phase', async () => {
      await renderScreen('nfc');
      const handler = lastBeforeRemoveHandler();
      handler?.({ preventDefault: jest.fn() });
      expect(mockCancel).toHaveBeenCalled();
    });

    it('returns from duress question to PIN confirmation before leaving', async () => {
      await renderScreen();
      await enterPin(0);
      await enterPin(0);
      const event = { preventDefault: jest.fn() };

      await act(async () => {
        lastBeforeRemoveHandler()?.(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Confirm your PIN',
      });
    });

    it('returns from duress setup to the duress question before leaving', async () => {
      await renderScreen();
      await enterPin(0);
      await enterPin(0);
      await act(async () => {
        fireEvent.press(screen.getByText('Yes, add duress PIN'));
      });
      const event = { preventDefault: jest.fn() };

      await act(async () => {
        lastBeforeRemoveHandler()?.(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(screen.getByText('Add a duress PIN?')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // dashboardEntry export
  // -------------------------------------------------------------------------

  describe('dashboardEntry', () => {
    it('has the correct label', () => {
      expect(dashboardEntry.label).toBe('Initialize');
    });

    it('navigates to InitCard when invoked', () => {
      const nav = { navigate: jest.fn() } as any;
      dashboardEntry.navigate(nav);
      expect(nav.navigate).toHaveBeenCalledWith('InitCard');
    });
  });
});
