import React, { act } from 'react';
import { TextInput } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { routeAbsence } from '../src/navigation/generationBoundRoutes';
import ChangeSecretScreen, {
  IDENTIFY_EXPLAINER,
} from '../src/screens/secrets/ChangeSecretScreen';
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

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));
const MockNFCBottomSheet = NFCBottomSheet as jest.MockedFunction<
  typeof NFCBottomSheet
>;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// PinPad reads the scramble preference from context, and the screen reads
// which cards the user ticked to decide whether the identify tap is needed.
let mockGenerationsInUse: ('3.1' | '4.0')[] = ['3.1', '4.0'];

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: mockTestPreferences({
      pinPadScramble: false,
      generationsInUse: mockGenerationsInUse,
    }),
    setPreference: jest.fn(),
  }),
}));

const mockStart = jest.fn();
const mockCancel = jest.fn();
const mockReset = jest.fn();
const mockUseChangeSecret = jest.fn();

jest.mock('../src/hooks/keycard/useChangeSecret', () => ({
  useChangeSecret: () => mockUseChangeSecret(),
}));

// The identify tap is a hook of its own with its own session; the screen only
// reads what it found, so the test drives that directly.
const mockIdentifyStart = jest.fn();
const mockIdentifyCancel = jest.fn();
let mockIdentify: {
  phase: 'idle' | 'nfc' | 'done' | 'error';
  generation: '3.1' | '4.0' | null;
};

jest.mock('../src/hooks/keycard/useIdentifyCard', () => ({
  useIdentifyCard: () => ({
    phase: mockIdentify.phase,
    status: '',
    cardPresence: 'waiting',
    generation: mockIdentify.generation,
    start: mockIdentifyStart,
    retry: mockIdentifyStart,
    cancel: mockIdentifyCancel,
    openNFCSettings: undefined,
  }),
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

function routeFor(secretType: 'pin' | 'puk' | 'pairing') {
  return {
    key: 'ChangeSecret',
    name: 'ChangeSecret',
    params: { secretType },
  } as any;
}

function hookMock(phase: string) {
  return {
    phase,
    status: '',
    result: null,
    pinError: null,
    start: mockStart,
    submitPin: jest.fn(),
    clearPinError: jest.fn(),
    cancel: mockCancel,
    reset: mockReset,
    proceedWithNonGenuine: jest.fn(),
  };
}

async function renderScreen(
  secretType: 'pin' | 'puk' | 'pairing' = 'pin',
  phase = 'idle',
) {
  mockUseChangeSecret.mockReturnValue(hookMock(phase));
  return render(
    <ChangeSecretScreen navigation={navigation} route={routeFor(secretType)} />,
  );
}

function lastBeforeRemoveHandler() {
  const call = navigation.addListener.mock.calls
    .slice()
    .reverse()
    .find(([event]: [string]) => event === 'beforeRemove');
  return call?.[1];
}

async function enterDigits(count: number, keyIndex = 0) {
  const digit = String(keyIndex + 1);
  for (let i = 0; i < count; i++) {
    await act(async () => {
      fireEvent.press(screen.getByText(digit));
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChangeSecretScreen', () => {
  beforeEach(() => {
    mockStart.mockClear();
    mockCancel.mockClear();
    mockReset.mockClear();
    MockNFCBottomSheet.mockClear();
    navigation.goBack.mockClear();
    navigation.reset.mockClear();
    navigation.setOptions.mockClear();
    navigation.addListener.mockClear();
    mockIdentifyStart.mockClear();
    mockIdentifyCancel.mockClear();
    mockUseChangeSecret.mockClear();
    mockGenerationsInUse = ['3.1', '4.0'];
    // A card that has a pairing secret, already identified: the state every
    // test below starts from unless it is about the identify tap itself.
    mockIdentify = { phase: 'done', generation: '3.1' };
  });

  // -------------------------------------------------------------------------
  // PIN (6 digits)
  // -------------------------------------------------------------------------

  describe('pin type', () => {
    it('sets header title to "Enter new PIN" on first render', async () => {
      await renderScreen('pin');
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Enter new PIN',
      });
    });

    it('sets header title to "Enter current PIN" during pin_entry phase', async () => {
      await renderScreen('pin', 'pin_entry');
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Enter current PIN',
      });
    });

    it('shows "6 digits" label', async () => {
      await renderScreen('pin');
      expect(screen.getByText('6 digits')).toBeTruthy();
    });

    it('moves to confirm step and updates title after 6 digits', async () => {
      await renderScreen('pin');
      navigation.setOptions.mockClear();
      await enterDigits(6, 0);
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Confirm new PIN',
      });
    });

    it('calls start when confirmed PIN matches', async () => {
      await renderScreen('pin');
      await enterDigits(6, 0); // new PIN: 111111
      await enterDigits(6, 0); // confirm: 111111
      expect(mockStart).toHaveBeenCalledWith('111111');
    });

    it('shows error on mismatch', async () => {
      await renderScreen('pin');
      await enterDigits(6, 0); // 111111
      await enterDigits(6, 1); // 222222
      expect(screen.getByText("PINs don't match")).toBeTruthy();
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('resets to Dashboard with "PIN changed" toast when done', async () => {
      mockUseChangeSecret.mockReturnValue({
        ...hookMock('done'),
        result: undefined,
      });
      render(
        <ChangeSecretScreen navigation={navigation} route={routeFor('pin')} />,
      );
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Dashboard', params: { toast: 'PIN changed' } }],
      });
    });
  });

  // -------------------------------------------------------------------------
  // PUK (12 digits)
  // -------------------------------------------------------------------------

  describe('puk type', () => {
    it('sets header title to "Enter new PUK"', async () => {
      await renderScreen('puk');
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Enter new PUK',
      });
    });

    it('shows "12 digits" label', async () => {
      await renderScreen('puk');
      expect(screen.getByText('12 digits')).toBeTruthy();
    });

    it('calls start when confirmed PUK matches after 12 digits', async () => {
      await renderScreen('puk');
      await enterDigits(12, 0);
      await enterDigits(12, 0);
      expect(mockStart).toHaveBeenCalledWith('111111111111');
    });

    it('resets to Dashboard with "PUK changed" toast when done', async () => {
      mockUseChangeSecret.mockReturnValue({
        ...hookMock('done'),
        result: undefined,
      });
      render(
        <ChangeSecretScreen navigation={navigation} route={routeFor('puk')} />,
      );
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Dashboard', params: { toast: 'PUK changed' } }],
      });
    });
  });

  // -------------------------------------------------------------------------
  // Pairing (text)
  // -------------------------------------------------------------------------

  describe('pairing type', () => {
    it('sets header title to "Enter new pairing secret"', async () => {
      await renderScreen('pairing');
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Enter new pairing secret',
      });
    });

    it('does not show a PIN pad', async () => {
      await renderScreen('pairing');
      expect(screen.queryByText(/digits/)).toBeNull();
    });

    it('calls start when pairing secret confirmation matches', async () => {
      await renderScreen('pairing');
      fireEvent.changeText(
        screen.UNSAFE_getByType(TextInput),
        'pairing-secret',
      );
      fireEvent.press(screen.getByText('Continue'));
      fireEvent.changeText(
        screen.UNSAFE_getByType(TextInput),
        'pairing-secret',
      );
      fireEvent.press(screen.getByText('Continue'));
      expect(mockStart).toHaveBeenCalledWith('pairing-secret');
    });

    it('shows an error when pairing secret confirmation does not match', async () => {
      await renderScreen('pairing');
      fireEvent.changeText(
        screen.UNSAFE_getByType(TextInput),
        'pairing-secret',
      );
      fireEvent.press(screen.getByText('Continue'));
      fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'other-secret');
      fireEvent.press(screen.getByText('Continue'));
      expect(screen.getByText("PINs don't match")).toBeTruthy();
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('resets to Dashboard with "Pairing secret changed" toast when done', async () => {
      mockUseChangeSecret.mockReturnValue({
        ...hookMock('done'),
        result: undefined,
      });
      render(
        <ChangeSecretScreen
          navigation={navigation}
          route={routeFor('pairing')}
        />,
      );
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [
          { name: 'Dashboard', params: { toast: 'Pairing secret changed' } },
        ],
      });
    });
  });

  // -------------------------------------------------------------------------
  // Identify tap (pairing secret only)
  // -------------------------------------------------------------------------

  // Newer cards have no pairing secret and the menu cannot know the card, so
  // this one secret reads the card first and only then asks for anything.
  describe('identify tap', () => {
    function lastSheetProps() {
      const calls = MockNFCBottomSheet.mock.calls;
      return calls[calls.length - 1][0];
    }

    describe('PIN and PUK are untouched', () => {
      it.each(['pin', 'puk'] as const)(
        'never starts an identify tap for %s',
        async secretType => {
          mockIdentify = { phase: 'idle', generation: null };
          await renderScreen(secretType);
          expect(mockIdentifyStart).not.toHaveBeenCalled();
          expect(screen.getByText(/digits/)).toBeTruthy();
          expect(screen.queryByText(IDENTIFY_EXPLAINER)).toBeNull();
          expect(lastSheetProps().showOnDone).toBe(true);
          // The sheet is driven by the change itself, never by the idle
          // identify hook that PIN and PUK also mount.
          expect(lastSheetProps().nfc).toBe(
            mockUseChangeSecret.mock.results[0].value,
          );
        },
      );
    });

    describe('while the card is unknown', () => {
      beforeEach(() => {
        mockIdentify = { phase: 'idle', generation: null };
      });

      it('starts the tap once when the screen opens', async () => {
        const view = await renderScreen('pairing');
        expect(mockIdentifyStart).toHaveBeenCalledTimes(1);

        // Dismissing Apple's sheet returns the session to idle. Starting
        // again on that would put the sheet straight back up.
        view.rerender(
          <ChangeSecretScreen
            navigation={navigation}
            route={routeFor('pairing')}
          />,
        );
        expect(mockIdentifyStart).toHaveBeenCalledTimes(1);
      });

      it('asks for nothing yet', async () => {
        await renderScreen('pairing');
        expect(screen.getByText(IDENTIFY_EXPLAINER)).toBeTruthy();
        expect(screen.UNSAFE_queryByType(TextInput)).toBeNull();
        expect(screen.queryByText(/digits/)).toBeNull();
      });

      it('titles the screen without naming a step', async () => {
        await renderScreen('pairing');
        expect(navigation.setOptions).toHaveBeenCalledWith({
          title: 'Change pairing secret',
        });
      });

      it('gives the sheet the identify tap, and hides it once read', async () => {
        mockIdentify = { phase: 'nfc', generation: null };
        await renderScreen('pairing');
        expect(lastSheetProps().nfc.phase).toBe('nfc');
        expect(lastSheetProps().nfc.retry).toBe(mockIdentifyStart);
        expect(lastSheetProps().showOnDone).toBe(false);
      });

      it('offers the tap again after the system sheet was dismissed', async () => {
        await renderScreen('pairing');
        mockIdentifyStart.mockClear();
        fireEvent.press(screen.getByText('Read Keycard'));
        expect(mockIdentifyStart).toHaveBeenCalledTimes(1);
      });

      it('disables that button while a tap is under way', async () => {
        mockIdentify = { phase: 'nfc', generation: null };
        await renderScreen('pairing');
        mockIdentifyStart.mockClear();
        fireEvent.press(screen.getByTestId('identify-card-button'));
        expect(mockIdentifyStart).not.toHaveBeenCalled();
      });

      it('cancels the identify tap, not the change, from the sheet', async () => {
        mockIdentify = { phase: 'nfc', generation: null };
        await renderScreen('pairing');
        lastSheetProps().onCancel();
        expect(mockIdentifyCancel).toHaveBeenCalledTimes(1);
        expect(mockCancel).not.toHaveBeenCalled();
        expect(navigation.goBack).toHaveBeenCalledTimes(1);
      });

      it('cancels the identify tap when leaving mid-tap', async () => {
        mockIdentify = { phase: 'nfc', generation: null };
        await renderScreen('pairing');
        lastBeforeRemoveHandler()?.({ preventDefault: jest.fn() });
        expect(mockIdentifyCancel).toHaveBeenCalledTimes(1);
        expect(mockCancel).not.toHaveBeenCalled();
      });
    });

    // A user who ticked only cards that have a pairing secret has told the app
    // what the first tap would find out. The operation still checks the card.
    describe('when every card in use has a pairing secret', () => {
      beforeEach(() => {
        mockGenerationsInUse = ['3.1'];
        mockIdentify = { phase: 'idle', generation: null };
      });

      it('skips the identify tap and asks for the secret at once', async () => {
        await renderScreen('pairing');
        expect(mockIdentifyStart).not.toHaveBeenCalled();
        expect(screen.UNSAFE_getByType(TextInput)).toBeTruthy();
        expect(screen.queryByText(IDENTIFY_EXPLAINER)).toBeNull();
        expect(navigation.setOptions).toHaveBeenCalledWith({
          title: 'Enter new pairing secret',
        });
      });

      it('drives the sheet from the change itself', async () => {
        await renderScreen('pairing', 'nfc');
        expect(lastSheetProps().showOnDone).toBe(true);
        lastSheetProps().onCancel();
        expect(mockCancel).toHaveBeenCalledTimes(1);
        expect(mockIdentifyCancel).not.toHaveBeenCalled();
      });
    });

    it('keeps the identify tap when a ticked card has no pairing secret', async () => {
      mockGenerationsInUse = ['3.1', '4.0'];
      mockIdentify = { phase: 'idle', generation: null };
      await renderScreen('pairing');
      expect(mockIdentifyStart).toHaveBeenCalledTimes(1);
    });

    describe('on a card that has a pairing secret', () => {
      // The identify tap ends in 'done' as well. Only the change itself may
      // end the screen, or the user would be sent home before typing a thing.
      it('does not leave the screen when the identify tap is done', async () => {
        await renderScreen('pairing');
        expect(navigation.reset).not.toHaveBeenCalled();
        expect(screen.UNSAFE_getByType(TextInput)).toBeTruthy();
      });

      it('hands the sheet and the back guard over to the change', async () => {
        await renderScreen('pairing', 'nfc');
        expect(lastSheetProps().showOnDone).toBe(true);
        lastBeforeRemoveHandler()?.({ preventDefault: jest.fn() });
        expect(mockCancel).toHaveBeenCalledTimes(1);
        expect(mockIdentifyCancel).not.toHaveBeenCalled();
      });
    });

    describe('on a card that has none', () => {
      const absence = routeAbsence('ChangePairingSecret');

      beforeEach(() => {
        mockIdentify = { phase: 'done', generation: '4.0' };
      });

      it('explains it instead of asking for a secret or a PIN', async () => {
        await renderScreen('pairing');
        expect(screen.getByText(absence.title)).toBeTruthy();
        expect(screen.getByText(absence.detail)).toBeTruthy();
        expect(screen.UNSAFE_queryByType(TextInput)).toBeNull();
        expect(screen.queryByText(/digits/)).toBeNull();
        expect(mockStart).not.toHaveBeenCalled();
      });

      it('draws no NFC sheet, since no tap can follow', async () => {
        await renderScreen('pairing');
        expect(MockNFCBottomSheet).not.toHaveBeenCalled();
      });

      it('goes back from its one button', async () => {
        await renderScreen('pairing');
        fireEvent.press(screen.getByText('Go back'));
        expect(navigation.goBack).toHaveBeenCalledTimes(1);
      });

      it('keeps the plain title', async () => {
        await renderScreen('pairing');
        expect(navigation.setOptions).toHaveBeenCalledWith({
          title: 'Change pairing secret',
        });
      });

      it('does not leave for the Dashboard', async () => {
        await renderScreen('pairing');
        expect(navigation.reset).not.toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // NFCBottomSheet
  // -------------------------------------------------------------------------

  describe('NFCBottomSheet', () => {
    function lastProps() {
      const calls = MockNFCBottomSheet.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('passes nfc phase through', async () => {
      await renderScreen('pin', 'nfc');
      expect(lastProps().nfc.phase).toBe('nfc');
    });

    it('showOnDone is true', async () => {
      await renderScreen('pin');
      expect(lastProps().showOnDone).toBe(true);
    });

    it('cancels and goes back when NFC sheet is cancelled', async () => {
      await renderScreen('pin');
      lastProps().onCancel();
      expect(mockCancel).toHaveBeenCalled();
      expect(navigation.goBack).toHaveBeenCalled();
    });
  });

  describe('beforeRemove guard', () => {
    it('cancels NFC when leaving during NFC phase', async () => {
      await renderScreen('pin', 'nfc');
      lastBeforeRemoveHandler()?.({ preventDefault: jest.fn() });
      expect(mockCancel).toHaveBeenCalled();
    });

    it('returns from confirm step to entry step before leaving', async () => {
      await renderScreen('pin');
      await enterDigits(6, 0);
      const event = { preventDefault: jest.fn() };

      await act(async () => {
        lastBeforeRemoveHandler()?.(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Enter new PIN',
      });
    });
  });
});
