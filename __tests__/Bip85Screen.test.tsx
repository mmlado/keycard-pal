import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, Platform } from 'react-native';

import Bip85Screen, {
  BIP85_INDEX_EXPLAINER,
  BIP85_NEEDS_NEWER_CARD,
} from '../src/screens/bip85/Bip85Screen';
import NFCBottomSheet from '../src/components/NFCBottomSheet';
import type { Bip85Format } from '../src/utils/bip85';

import { testPreferences as mockTestPreferences } from './preferences.testUtils';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 0,
    bottom: mockBottomInset,
    left: 0,
    right: 0,
  }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

jest.mock('@react-native-community/blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

let mockGenerationsInUse: ('3.1' | '4.0')[] = ['4.0'];

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: mockTestPreferences({
      generationsInUse: mockGenerationsInUse,
    }),
    setPreference: jest.fn(),
  }),
}));

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));
const MockNFCBottomSheet = NFCBottomSheet as jest.MockedFunction<
  typeof NFCBottomSheet
>;

let mockBottomInset = 0;
let keyboardDidShow: ((event: any) => void) | null = null;
let keyboardDidHide: (() => void) | null = null;

jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
  if (event === 'keyboardDidShow' || event === 'keyboardWillShow') {
    keyboardDidShow = callback as (event: any) => void;
  }
  if (event === 'keyboardDidHide' || event === 'keyboardWillHide') {
    keyboardDidHide = callback as () => void;
  }
  return { remove: jest.fn() } as any;
});

const mockStart = jest.fn();
const mockCancel = jest.fn();
const mockReset = jest.fn();
const mockUseDeriveBip85 = jest.fn();

jest.mock('../src/hooks/keycard/useDeriveBip85', () => ({
  useDeriveBip85: () => mockUseDeriveBip85(),
}));

// Sixteen zero bytes are the all-"abandon" phrase that ends in "about".
const ZERO_ENTROPY = new Uint8Array(16);

const navigation = {
  addListener: jest.fn(() => jest.fn()),
  goBack: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
} as any;

function hookMock(phase: string, result: Uint8Array | null = null) {
  return {
    phase,
    status: '',
    result,
    start: mockStart,
    cancel: mockCancel,
    reset: mockReset,
    userCancels: 0,
  };
}

function screenFor(format: Bip85Format) {
  return (
    <Bip85Screen
      navigation={navigation}
      route={{ key: 'Bip85', name: 'Bip85', params: { format } } as any}
    />
  );
}

function renderScreen(format: Bip85Format = 'words12', phase = 'idle') {
  mockUseDeriveBip85.mockReturnValue(hookMock(phase));
  return render(screenFor(format));
}

/** Derive at `index`, then let the tap come back with `entropy`. */
function derive(
  format: Bip85Format,
  index: string,
  entropy: Uint8Array = ZERO_ENTROPY,
) {
  renderScreen(format);
  fireEvent.changeText(screen.getByDisplayValue('0'), index);
  fireEvent.press(screen.getByText('Derive'));
  mockUseDeriveBip85.mockReturnValue(hookMock('done', entropy));
  screen.rerender(screenFor(format));
}

/** What the hook's reset() leads to: the tap is idle again. */
function afterReset(format: Bip85Format) {
  mockUseDeriveBip85.mockReturnValue(hookMock('idle'));
  screen.rerender(screenFor(format));
}

/** The latest beforeRemove listener, the one header back and swipe reach. */
function beforeRemove(): (e: { preventDefault: () => void }) => void {
  const calls = navigation.addListener.mock.calls.filter(
    ([type]: [string]) => type === 'beforeRemove',
  );
  return calls[calls.length - 1][1];
}

const hidden = { includeHiddenElements: true };

describe('Bip85Screen', () => {
  beforeEach(() => {
    mockStart.mockClear();
    mockCancel.mockClear();
    mockReset.mockClear();
    MockNFCBottomSheet.mockClear();
    navigation.addListener.mockClear();
    navigation.goBack.mockClear();
    navigation.reset.mockClear();
    navigation.setOptions.mockClear();
    keyboardDidShow = null;
    keyboardDidHide = null;
    mockBottomInset = 0;
    mockGenerationsInUse = ['4.0'];
  });

  describe('index', () => {
    it('explains the index and starts at 0', () => {
      renderScreen();
      expect(screen.getByText(BIP85_INDEX_EXPLAINER)).toBeTruthy();
      expect(screen.getByDisplayValue('0')).toBeTruthy();
    });

    it('derives the format at the typed index', () => {
      renderScreen('wif');
      fireEvent.changeText(screen.getByDisplayValue('0'), '42');
      fireEvent.press(screen.getByText('Derive'));
      expect(mockStart).toHaveBeenCalledWith({ format: 'wif', index: 42 });
    });

    it('keeps digits only', () => {
      renderScreen();
      fireEvent.changeText(screen.getByDisplayValue('0'), '1.5-');
      expect(screen.getByDisplayValue('15')).toBeTruthy();
    });

    // Any hardened index, so one used with another BIP85 tool can be derived here.
    it('takes every hardened index', () => {
      renderScreen();
      expect(screen.getByDisplayValue('0').props.maxLength).toBe(10);
      fireEvent.changeText(screen.getByDisplayValue('0'), '2147483647');
      fireEvent.press(screen.getByText('Derive'));
      expect(mockStart).toHaveBeenCalledWith({
        format: 'words12',
        index: 2147483647,
      });
    });

    it.each(['', '2147483648'])('does not derive at index %p', index => {
      renderScreen();
      fireEvent.changeText(screen.getByDisplayValue('0'), index);
      fireEvent.press(screen.getByText('Derive'));
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('moves the bottom action above the keyboard', () => {
      const { toJSON } = renderScreen();

      act(() => {
        keyboardDidShow?.({ endCoordinates: { height: 280 } });
      });
      expect(JSON.stringify(toJSON())).toContain('"paddingBottom":288');

      act(() => {
        keyboardDidHide?.();
      });
      expect(JSON.stringify(toJSON())).toContain('"paddingBottom":16');
    });

    it('adds the navigation bar back on Android', () => {
      const origOS = Platform.OS;
      Platform.OS = 'android';
      try {
        mockBottomInset = 63;
        const { toJSON } = renderScreen();
        act(() => {
          keyboardDidShow?.({ endCoordinates: { height: 280 } });
        });
        expect(JSON.stringify(toJSON())).toContain('"paddingBottom":351');
      } finally {
        Platform.OS = origOS;
      }
    });

    it('hides the form during the tap', () => {
      renderScreen('words12', 'nfc');
      expect(screen.queryByText('Derive')).toBeNull();
    });
  });

  // The menu entry shows while any 4.x card is ticked, so a 3.x one may be in hand.
  describe('older cards', () => {
    it('says a 4.x card is needed while a 3.x card is ticked', () => {
      mockGenerationsInUse = ['3.1', '4.0'];
      renderScreen();
      expect(
        screen.getByText(`${BIP85_INDEX_EXPLAINER} ${BIP85_NEEDS_NEWER_CARD}`),
      ).toBeTruthy();
    });

    it('says nothing when only 4.x cards are ticked', () => {
      renderScreen();
      expect(screen.queryByText(BIP85_NEEDS_NEWER_CARD, { exact: false })).toBe(
        null,
      );
    });
  });

  describe('result', () => {
    it('shows what the card returned, behind the blur', () => {
      derive('words12', '0');
      expect(screen.queryByText('about')).toBeNull();
      expect(screen.getByText('about', hidden)).toBeTruthy();
      expect(screen.UNSAFE_queryAllByType('BlurView' as any)).toHaveLength(1);
    });

    // The field is still editable until the PIN pad opens.
    it('shows the path of the index it derived, not of a later edit', () => {
      renderScreen('hex32');
      fireEvent.changeText(screen.getByDisplayValue('0'), '7');
      fireEvent.press(screen.getByText('Derive'));
      fireEvent.changeText(screen.getByDisplayValue('7'), '8');
      mockUseDeriveBip85.mockReturnValue(hookMock('done', new Uint8Array(32)));
      screen.rerender(screenFor('hex32'));
      expect(screen.getByText("m/83696968'/128169'/32'/7'")).toBeTruthy();
    });

    it('does not leave by itself when the tap is done', () => {
      derive('words12', '0');
      expect(navigation.reset).not.toHaveBeenCalled();
      expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('keeps the success sheet off the result', () => {
      derive('words12', '0');
      const props = MockNFCBottomSheet.mock.calls.at(-1)![0];
      expect(props.showOnDone).toBeFalsy();
    });
  });

  // Indexes are usually derived in a row, so Done and back return to the form.
  describe('after the result', () => {
    it('Done clears the result and offers the next index', async () => {
      derive('words12', '4');
      await act(async () => {
        fireEvent.press(screen.getByText('Reveal'));
      });
      await act(async () => {
        fireEvent.press(screen.getByText('Done'));
      });
      expect(mockReset).toHaveBeenCalledTimes(1);
      expect(navigation.reset).not.toHaveBeenCalled();

      afterReset('words12');
      expect(screen.getByDisplayValue('5')).toBeTruthy();
      expect(screen.queryByText('about', hidden)).toBeNull();
    });

    it('offers the next index after an invalid key too', async () => {
      derive('wif', '9', new Uint8Array(32));
      await act(async () => {
        fireEvent.press(screen.getByText('Done'));
      });
      afterReset('wif');
      expect(screen.getByDisplayValue('10')).toBeTruthy();
    });

    it('stays at the highest index', async () => {
      derive('hex32', '2147483647', new Uint8Array(32));
      await act(async () => {
        fireEvent.press(screen.getByText('Reveal'));
      });
      await act(async () => {
        fireEvent.press(screen.getByText('Done'));
      });
      afterReset('hex32');
      expect(screen.getByDisplayValue('2147483647')).toBeTruthy();
    });

    it('back returns to the form instead of leaving', () => {
      derive('words12', '0');
      const preventDefault = jest.fn();
      act(() => {
        beforeRemove()({ preventDefault });
      });
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it('back on the form leaves', () => {
      renderScreen();
      const preventDefault = jest.fn();
      beforeRemove()({ preventDefault });
      expect(preventDefault).not.toHaveBeenCalled();
      expect(mockReset).not.toHaveBeenCalled();
    });
  });

  describe('header title', () => {
    it.each([
      ['words24', '24-word BIP39 phrase'],
      ['xprv', 'BIP32 extended private key'],
      ['password', 'Base64 password'],
    ] as const)('names %s', (format, title) => {
      renderScreen(format);
      expect(navigation.setOptions).toHaveBeenLastCalledWith({ title });
    });
  });

  describe('cancel', () => {
    it('cancels the tap and goes back', async () => {
      renderScreen('words12', 'nfc');
      const onCancel = MockNFCBottomSheet.mock.calls[0][0].onCancel;
      await act(async () => {
        onCancel();
      });
      expect(mockCancel).toHaveBeenCalledTimes(1);
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
  });
});
