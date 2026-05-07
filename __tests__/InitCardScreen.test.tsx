import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import InitCardScreen, { dashboardEntry } from '../src/screens/InitCardScreen';
import NFCBottomSheet from '../src/components/NFCBottomSheet';

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

// useFocusEffect is used only to register the hardware-back handler.
// In tests there's no focus management so we make it a no-op.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('../src/storage/preferencesStorage', () => ({
  loadBooleanPreference: jest.fn().mockResolvedValue(false),
  preferenceKeys: { pinPadScramble: 'preference_pinpad_scramble' },
  saveBooleanPreference: jest.fn().mockResolvedValue(undefined),
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

function hookMock(phase: string) {
  return {
    phase,
    status: '',
    result: null,
    start: mockStart,
    cancel: mockCancel,
    reset: mockReset,
  };
}

function renderScreen(phase = 'idle') {
  mockUseInitCard.mockReturnValue(hookMock(phase));
  return render(<InitCardScreen navigation={navigation} route={route} />);
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
  });

  // -------------------------------------------------------------------------
  // Static
  // -------------------------------------------------------------------------

  describe('initial render', () => {
    it('sets header title to "Create a PIN" on first render', async () => {
      renderScreen();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Create a PIN',
      });
    });

    it('shows the PIN pad on first render', async () => {
      renderScreen();
      expect(screen.getByText('6 digits')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Step transitions
  // -------------------------------------------------------------------------

  describe('step transitions', () => {
    it('moves to pin_confirm after 6 digits are entered', async () => {
      renderScreen();
      navigation.setOptions.mockClear();
      await enterPin(0);
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Confirm your PIN',
      });
    });

    it('moves to duress_question after the PIN is confirmed correctly', async () => {
      renderScreen();
      await enterPin(0);
      await enterPin(0);
      expect(screen.getByText('Add a duress PIN?')).toBeTruthy();
    });

    it('shows an error when the confirmed PIN does not match', async () => {
      renderScreen();
      await enterPin(0);
      await enterPin(1);
      expect(screen.getByText("PINs don't match")).toBeTruthy();
    });

    it('stays on pin_confirm after a mismatch (does not advance)', async () => {
      renderScreen();
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
      const view = renderScreen();
      await enterPin(0);
      await enterPin(0);
      return view;
    }

    it('calls start with the PIN and null duress when No is pressed', async () => {
      await reachConfirmPrompt();
      await act(async () => {
        fireEvent.press(screen.getByText('No, skip'));
      });
      expect(mockStart).toHaveBeenCalledTimes(1);
      expect(mockStart).toHaveBeenCalledWith('111111', null);
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
      const view = renderScreen();
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

    it('calls start with PIN and duress when duress confirm matches', async () => {
      await reachDuressEntry();
      await enterPin(1);
      await enterPin(1);
      expect(mockStart).toHaveBeenCalledTimes(1);
      expect(mockStart).toHaveBeenCalledWith('111111', '222222');
    });

    it('shows an error when duress confirm does not match', async () => {
      await reachDuressEntry();
      await enterPin(1);
      await enterPin(0);
      expect(screen.getByText("PINs don't match")).toBeTruthy();
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
      renderScreen('idle');
      expect(lastProps().nfc.phase).toBe('idle');
    });

    it('nfc.phase is nfc when phase is nfc', async () => {
      renderScreen('nfc');
      expect(lastProps().nfc.phase).toBe('nfc');
    });

    it('nfc.phase is error when phase is error', async () => {
      renderScreen('error');
      expect(lastProps().nfc.phase).toBe('error');
    });

    it('nfc.phase is done and showOnDone is true when phase is done', async () => {
      renderScreen('done');
      expect(lastProps().nfc.phase).toBe('done');
      expect(lastProps().showOnDone).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Navigation after done
  // -------------------------------------------------------------------------

  describe('navigation', () => {
    it('navigates to Dashboard when phase is done and result is set', async () => {
      mockUseInitCard.mockReturnValue({
        ...hookMock('done'),
        result: '123456789012',
      });
      render(<InitCardScreen navigation={navigation} route={route} />);
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Dashboard', params: { toast: 'Card initialized' } }],
      });
    });

    it('does not navigate when phase is done but result is null', async () => {
      renderScreen('done'); // result is null in hookMock
      expect(navigation.reset).not.toHaveBeenCalled();
    });

    it('cancels NFC when leaving during NFC phase', async () => {
      renderScreen('nfc');
      const handler = lastBeforeRemoveHandler();
      handler?.({ preventDefault: jest.fn() });
      expect(mockCancel).toHaveBeenCalled();
    });

    it('returns from duress question to PIN confirmation before leaving', async () => {
      renderScreen();
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
      renderScreen();
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
