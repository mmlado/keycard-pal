import React, { act } from 'react';
import { TextInput } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ChangeSecretScreen from '../src/screens/secrets/ChangeSecretScreen';
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
const mockUseChangeSecret = jest.fn();

jest.mock('../src/hooks/keycard/useChangeSecret', () => ({
  useChangeSecret: () => mockUseChangeSecret(),
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
