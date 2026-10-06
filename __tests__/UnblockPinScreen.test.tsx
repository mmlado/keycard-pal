import React, { act } from 'react';
import { BackHandler } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import UnblockPinScreen from '../src/screens/secrets/UnblockPinScreen';
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
let mockHook: { phase: string; pukError: string | null };

jest.mock('../src/hooks/keycard/useUnblockPin', () => ({
  useUnblockPin: () => ({
    phase: mockHook.phase,
    status: '',
    result: null,
    pinError: null,
    pukError: mockHook.pukError,
    start: mockStart,
    cancel: mockCancel,
    reset: jest.fn(),
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

const route = { key: 'UnblockPin', name: 'UnblockPin' } as any;

async function renderScreen(phase = 'idle', pukError: string | null = null) {
  mockHook = { phase, pukError };
  const result = render(
    <UnblockPinScreen navigation={navigation} route={route} />,
  );
  await act(async () => {});
  return result;
}

function rerenderWith(
  view: ReturnType<typeof render>,
  phase: string,
  pukError: string | null,
) {
  mockHook = { phase, pukError };
  view.rerender(<UnblockPinScreen navigation={navigation} route={route} />);
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

/** Press one digit key `count` times. keyIndex 0 = '1', 1 = '2'. */
async function enterDigits(count: number, keyIndex = 0) {
  const digit = String(keyIndex + 1);
  for (let i = 0; i < count; i++) {
    await act(async () => {
      fireEvent.press(screen.getByText(digit));
    });
  }
}

/** New PIN 111111, confirmed, so the screen is asking for the PUK. */
async function reachPuk() {
  const view = await renderScreen();
  await enterDigits(6, 0);
  await enterDigits(6, 0);
  return view;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnblockPinScreen', () => {
  beforeEach(() => {
    mockStart.mockClear();
    mockCancel.mockClear();
    MockNFCBottomSheet.mockClear();
    navigation.goBack.mockClear();
    navigation.reset.mockClear();
    navigation.setOptions.mockClear();
    navigation.addListener.mockClear();
    backSpy = jest.spyOn(BackHandler, 'addEventListener');
  });

  afterEach(() => {
    backSpy.mockRestore();
  });

  // The new PIN comes first, the way every secret change asks for the new
  // value before the credential that authorizes it.
  describe('new PIN', () => {
    it('opens on "Enter new PIN" with a 6-digit pad', async () => {
      await renderScreen();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Enter new PIN',
      });
      expect(screen.getByText('6 digits')).toBeTruthy();
    });

    it('asks to confirm after six digits', async () => {
      await renderScreen();
      navigation.setOptions.mockClear();
      await enterDigits(6, 0);
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Confirm new PIN',
      });
    });

    it('rejects a mismatch and stays on the confirmation', async () => {
      await renderScreen();
      await enterDigits(6, 0);
      await enterDigits(6, 1);
      expect(screen.getByText("PINs don't match")).toBeTruthy();
      expect(screen.getByText('6 digits')).toBeTruthy();
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('asks for the PUK once the PIN is confirmed', async () => {
      await reachPuk();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Enter your PUK',
      });
      expect(screen.getByText('12 digits')).toBeTruthy();
      expect(mockStart).not.toHaveBeenCalled();
    });
  });

  describe('PUK', () => {
    it('starts the tap with the PUK and the new PIN after twelve digits', async () => {
      await reachPuk();
      await enterDigits(12, 1);
      expect(mockStart).toHaveBeenCalledTimes(1);
      expect(mockStart).toHaveBeenCalledWith('222222222222', '111111');
    });

    it('shows the refusal on the PUK pad', async () => {
      const view = await reachPuk();
      await enterDigits(12, 1);
      rerenderWith(view, 'idle', 'PUK is not valid. 4 attempts left.');
      expect(
        screen.getByText('PUK is not valid. 4 attempts left.'),
      ).toBeTruthy();
      expect(screen.getByText('12 digits')).toBeTruthy();
    });

    it('sends the same new PIN with the next PUK', async () => {
      const view = await reachPuk();
      await enterDigits(12, 1);
      rerenderWith(view, 'idle', 'PUK is not valid. 4 attempts left.');
      mockStart.mockClear();
      await enterDigits(12, 2);
      expect(mockStart).toHaveBeenCalledWith('333333333333', '111111');
    });

    it('hides the pads while the card is being read', async () => {
      await renderScreen('nfc');
      expect(screen.queryByText(/digits/)).toBeNull();
    });
  });

  describe('NFCBottomSheet', () => {
    function lastProps() {
      const calls = MockNFCBottomSheet.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('follows the hook and shows the success sheet', async () => {
      await renderScreen('nfc');
      expect(lastProps().nfc.phase).toBe('nfc');
      expect(lastProps().showOnDone).toBe(true);
    });

    it('cancels and goes back from the sheet', async () => {
      await renderScreen('nfc');
      lastProps().onCancel();
      expect(mockCancel).toHaveBeenCalledTimes(1);
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('navigation', () => {
    it('resets to Dashboard with "PIN unblocked" when done', async () => {
      await renderScreen('done');
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Dashboard', params: { toast: 'PIN unblocked' } }],
      });
    });

    it('cancels the tap when leaving mid-tap', async () => {
      await renderScreen('nfc');
      lastBeforeRemoveHandler()?.({ preventDefault: jest.fn() });
      expect(mockCancel).toHaveBeenCalled();
    });

    it('returns from the PUK to the PIN confirmation before leaving', async () => {
      await reachPuk();
      navigation.setOptions.mockClear();
      const event = { preventDefault: jest.fn() };
      await act(async () => {
        lastBeforeRemoveHandler()?.(event);
      });
      expect(event.preventDefault).toHaveBeenCalled();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Confirm new PIN',
      });
      expect(screen.getByText('6 digits')).toBeTruthy();
    });

    it('returns from the confirmation to the entry before leaving', async () => {
      await renderScreen();
      await enterDigits(6, 0);
      navigation.setOptions.mockClear();
      const event = { preventDefault: jest.fn() };
      await act(async () => {
        lastBeforeRemoveHandler()?.(event);
      });
      expect(event.preventDefault).toHaveBeenCalled();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Enter new PIN',
      });
    });

    it('leaves from the first entry', async () => {
      await renderScreen();
      const event = { preventDefault: jest.fn() };
      await act(async () => {
        lastBeforeRemoveHandler()?.(event);
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('hardware back', () => {
    it('returns from the PUK to the PIN confirmation', async () => {
      await reachPuk();
      navigation.setOptions.mockClear();
      expect(await pressHardwareBack()).toBe(true);
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Confirm new PIN',
      });
      expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('steps the confirmation back to the entry', async () => {
      await renderScreen();
      await enterDigits(6, 0);
      navigation.setOptions.mockClear();
      expect(await pressHardwareBack()).toBe(true);
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Enter new PIN',
      });
      expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('leaves the screen from the first entry', async () => {
      await renderScreen();
      expect(await pressHardwareBack()).toBe(true);
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
  });
});
