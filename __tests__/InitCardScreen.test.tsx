import React, { act } from 'react';
import { BackHandler } from 'react-native';
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

jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    // Run the focus effect like a focused screen would, so hardware back registers.
    useFocusEffect: (cb: () => void | (() => void)) => {
      useEffect(cb, [cb]);
    },
  };
});

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

let backSpy: jest.SpyInstance;

async function pressHardwareBack() {
  const handler = backSpy.mock.calls.at(-1)![1] as () => boolean;
  let handled = false;
  await act(async () => {
    handled = handler();
  });
  return handled;
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
    backSpy = jest.spyOn(BackHandler, 'addEventListener');
  });

  afterEach(() => {
    backSpy.mockRestore();
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

    it('starts the tap with the PIN and no duress PIN when No is pressed', async () => {
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

    it('starts the tap with the PIN and the duress PIN when the confirmation matches', async () => {
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
  // PUK after the tap
  // -------------------------------------------------------------------------

  // Only acknowledgement or back leaves the PUK, both for the Dashboard.
  describe('PUK after the tap', () => {
    const dashboard = {
      index: 0,
      routes: [{ name: 'Dashboard', params: { toast: 'Card initialized' } }],
    };

    async function reveal() {
      await act(async () => {
        fireEvent.press(screen.getByText('Reveal PUK'));
      });
    }

    it("shows the hook's PUK behind a reveal once done, under its own title", async () => {
      await renderScreen('done');
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Write down your PUK',
      });
      expect(screen.getByText('1234 5678 9012')).toBeTruthy();
      expect(screen.UNSAFE_queryAllByType('BlurView' as any)).toHaveLength(1);
      expect(screen.getByText('Reveal PUK')).toBeTruthy();
      expect(navigation.reset).not.toHaveBeenCalled();
    });

    it('goes to the Dashboard once written down', async () => {
      await renderScreen('done');
      await reveal();
      await act(async () => {
        fireEvent.press(screen.getByText("I've written it down"));
      });
      expect(navigation.reset).toHaveBeenCalledWith(dashboard);
    });

    it('goes to the Dashboard on back, not to the previous screen', async () => {
      await renderScreen('done');
      const event = { preventDefault: jest.fn() };
      await act(async () => {
        lastBeforeRemoveHandler()?.(event);
      });
      expect(event.preventDefault).toHaveBeenCalled();
      expect(navigation.reset).toHaveBeenCalledWith(dashboard);
      expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('is not shown before the tap or while the card is being read', async () => {
      await renderScreen('idle');
      expect(screen.queryByText('Reveal PUK')).toBeNull();
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

    // The PUK takes the success sheet's place.
    it('does not ask for the success sheet when phase is done', async () => {
      await renderScreen('done');
      expect(lastProps().nfc.phase).toBe('done');
      expect(lastProps().showOnDone).toBeFalsy();
    });
  });

  // -------------------------------------------------------------------------
  // Navigation after done
  // -------------------------------------------------------------------------

  describe('navigation', () => {
    it('stays for the PUK when phase is done', async () => {
      await renderScreen('done');
      expect(navigation.reset).not.toHaveBeenCalled();
    });

    it('cancels NFC when leaving during NFC phase', async () => {
      await renderScreen('nfc');
      const handler = lastBeforeRemoveHandler();
      handler?.({ preventDefault: jest.fn() });
      expect(mockCancel).toHaveBeenCalled();
    });

    it('returns from PIN confirmation to PIN entry before leaving', async () => {
      await renderScreen();
      await enterPin(0);
      navigation.setOptions.mockClear();
      const event = { preventDefault: jest.fn() };

      await act(async () => {
        lastBeforeRemoveHandler()?.(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Create a PIN',
      });
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

    it('returns from duress confirmation to duress entry before leaving', async () => {
      await renderScreen();
      await enterPin(0);
      await enterPin(0);
      await act(async () => {
        fireEvent.press(screen.getByText('Yes, add duress PIN'));
      });
      await enterPin(1);
      navigation.setOptions.mockClear();
      const event = { preventDefault: jest.fn() };

      await act(async () => {
        lastBeforeRemoveHandler()?.(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Create a duress PIN',
      });
    });
  });

  // -------------------------------------------------------------------------
  // Hardware back
  // -------------------------------------------------------------------------

  describe('hardware back', () => {
    it('leaves the screen from PIN entry', async () => {
      await renderScreen();
      expect(await pressHardwareBack()).toBe(true);
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('steps PIN confirmation back to entry', async () => {
      await renderScreen();
      await enterPin(0);
      navigation.setOptions.mockClear();
      expect(await pressHardwareBack()).toBe(true);
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Create a PIN',
      });
      expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('returns from the duress question to PIN confirmation', async () => {
      await renderScreen();
      await enterPin(0);
      await enterPin(0);
      navigation.setOptions.mockClear();
      await pressHardwareBack();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Confirm your PIN',
      });
    });

    it('returns from duress entry to the duress question', async () => {
      await renderScreen();
      await enterPin(0);
      await enterPin(0);
      await act(async () => {
        fireEvent.press(screen.getByText('Yes, add duress PIN'));
      });
      await pressHardwareBack();
      expect(screen.getByText('Add a duress PIN?')).toBeTruthy();
    });

    it('steps duress confirmation back to duress entry', async () => {
      await renderScreen();
      await enterPin(0);
      await enterPin(0);
      await act(async () => {
        fireEvent.press(screen.getByText('Yes, add duress PIN'));
      });
      await enterPin(1);
      navigation.setOptions.mockClear();
      await pressHardwareBack();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Create a duress PIN',
      });
    });

    it('goes to the Dashboard from the PUK', async () => {
      await renderScreen('done');
      expect(await pressHardwareBack()).toBe(true);
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Dashboard', params: { toast: 'Card initialized' } }],
      });
      expect(navigation.goBack).not.toHaveBeenCalled();
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
