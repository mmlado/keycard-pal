import React, { act } from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ConfirmKeyScreen from '../src/screens/keypair/ConfirmKeyScreen';
import NFCBottomSheet from '../src/components/NFCBottomSheet';
import PinPad from '../src/components/PinPad';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    require('react').useEffect(cb, []);
  },
}));

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));
const MockNFCBottomSheet = NFCBottomSheet as jest.MockedFunction<
  typeof NFCBottomSheet
>;

jest.mock('../src/components/PinPad', () => jest.fn(() => null));
const MockPinPad = PinPad as jest.MockedFunction<typeof PinPad>;

jest.mock('../src/assets/icons', () => {
  const { View } = require('react-native');
  const Icon = (props: any) => <View {...props} />;
  return {
    Icons: {
      checkmark: Icon,
      exclamation: Icon,
    },
  };
});

const mockStart = jest.fn();
const mockCancel = jest.fn();
const mockSubmitPin = jest.fn();
const mockUseLoadKey = jest.fn();

jest.mock('../src/hooks/keycard/useLoadKey', () => ({
  useLoadKey: () => mockUseLoadKey(),
  deriveMnemonicKeyPair: jest.fn(() => ({ type: 'keypair' })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// 12 words used as the seed phrase for all tests.
const WORDS = [
  'alpha',
  'bravo',
  'charlie',
  'delta',
  'echo',
  'foxtrot',
  'golf',
  'hotel',
  'india',
  'juliet',
  'kilo',
  'lima',
];

// With Math.random fixed to 0, Fisher-Yates shuffle of [0..11] produces
// [1,2,3,4,5,6,7,8,9,10,11,0]. After .slice(0,4).sort() → [1,2,3,4].
// challengePositions = [1,2,3,4], correct words = bravo, charlie, delta, echo.
const CHALLENGE_POSITIONS = [1, 2, 3, 4];
const CORRECT_WORDS = CHALLENGE_POSITIONS.map(i => WORDS[i]);

// With N_CHOICES=4: choices for slot 0 = ['charlie','delta','echo','bravo'],
// so 'charlie' is a wrong answer for that slot.
// With N_CHOICES=1: only the correct word is shown, so this button won't exist.
const WRONG_WORD_FOR_SLOT_0 = 'charlie';

const navigation = {
  addListener: jest.fn(() => jest.fn()),
  goBack: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
} as any;

const route = {
  key: 'ConfirmKey',
  name: 'ConfirmKey',
  params: { words: WORDS },
} as any;

function hookMock(phase: string) {
  return {
    phase,
    status: '',
    result: null,
    start: mockStart,
    cancel: mockCancel,
    submitPin: mockSubmitPin,
  };
}

function renderScreen(phase = 'idle') {
  mockUseLoadKey.mockReturnValue(hookMock(phase));
  return render(<ConfirmKeyScreen navigation={navigation} route={route} />);
}

async function pressChoice(word: string) {
  await act(async () => {
    fireEvent.press(screen.getByText(word));
  });
}

/** Complete all N_CHALLENGE correct answers. */
async function completeChallenge() {
  for (const word of CORRECT_WORDS) {
    await pressChoice(word);
  }
}

describe('ConfirmKeyScreen insets', () => {
  afterEach(() => {
    mockInsets.top = 0;
    mockInsets.bottom = 0;
  });

  it('reserves the bottom inset and leaves the top to the header', () => {
    mockInsets.top = 48;
    mockInsets.bottom = 34;
    const { toJSON } = renderScreen();
    const style = StyleSheet.flatten((toJSON() as any).props.style);
    expect(style.paddingBottom).toBe(34);
    expect(style.paddingTop).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConfirmKeyScreen', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    mockStart.mockClear();
    mockCancel.mockClear();
    mockSubmitPin.mockClear();
    MockNFCBottomSheet.mockClear();
    MockPinPad.mockClear();
    navigation.goBack.mockClear();
    navigation.reset.mockClear();
    navigation.setOptions.mockClear();
  });

  afterEach(() => {
    (Math.random as jest.Mock).mockRestore();
  });

  // -------------------------------------------------------------------------
  // Initial layout
  // -------------------------------------------------------------------------

  describe('initial layout', () => {
    it('sets header title to "Check your backup" when idle', async () => {
      await renderScreen();
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Check your backup',
      });
    });

    it('shows unfilled slots at start', () => {
      renderScreen();
      expect(screen.getAllByText('____').length).toBeGreaterThan(0);
    });

    it('shows choice buttons for the first challenge', () => {
      renderScreen();
      // With random=0: slot 0 correct word is 'bravo', choices include it
      expect(screen.getAllByText(CORRECT_WORDS[0]).length).toBeGreaterThan(0);
    });

    it('hides choices once all answers are filled', async () => {
      renderScreen();
      await completeChallenge();
      for (const word of CORRECT_WORDS) {
        expect(screen.getAllByText(word)).toHaveLength(1);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Choice interaction
  // -------------------------------------------------------------------------

  describe('word challenge', () => {
    it('fills the first slot and shows the next choices on correct answer', async () => {
      renderScreen();
      await pressChoice(CORRECT_WORDS[0]);
      // First slot now shows the word instead of ____
      expect(screen.getAllByText(CORRECT_WORDS[0]).length).toBeGreaterThan(0);
      // Second slot's correct word is now available as a choice
      expect(screen.getByText(CORRECT_WORDS[1])).toBeTruthy();
    });

    it('does not advance when the wrong word is pressed', async () => {
      renderScreen();
      await pressChoice(WRONG_WORD_FOR_SLOT_0);
      expect(screen.getAllByText('____').length).toBeGreaterThan(0);
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('calls start() after all correct answers are provided', async () => {
      renderScreen();
      await completeChallenge();
      expect(mockStart).toHaveBeenCalledTimes(1);
    });

    it('does not call start() before all answers are filled', async () => {
      renderScreen();
      await pressChoice(CORRECT_WORDS[0]);
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('shows "Wrong answer · 2 retries left" after first wrong answer', async () => {
      renderScreen();
      await pressChoice(WRONG_WORD_FOR_SLOT_0);
      expect(screen.getByText('Wrong answer · 2 retries left')).toBeTruthy();
    });

    it('shows "Wrong answer · 1 retry left" after second wrong answer', async () => {
      renderScreen();
      await pressChoice(WRONG_WORD_FOR_SLOT_0);
      await pressChoice(WRONG_WORD_FOR_SLOT_0);
      expect(screen.getByText('Wrong answer · 1 retry left')).toBeTruthy();
    });

    it('calls goBack only after third wrong answer', async () => {
      renderScreen();
      await pressChoice(WRONG_WORD_FOR_SLOT_0);
      expect(navigation.goBack).not.toHaveBeenCalled();
      await pressChoice(WRONG_WORD_FOR_SLOT_0);
      expect(navigation.goBack).not.toHaveBeenCalled();
      await pressChoice(WRONG_WORD_FOR_SLOT_0);
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // PinPad
  // -------------------------------------------------------------------------

  describe('PinPad', () => {
    function lastProps() {
      const calls = MockNFCBottomSheet.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('nfc.phase is not pin_entry when phase is idle', async () => {
      await renderScreen('idle');
      expect(lastProps().nfc.phase).not.toBe('pin_entry');
    });

    it('nfc.phase is pin_entry when phase is pin_entry', async () => {
      await renderScreen('pin_entry');
      expect(lastProps().nfc.phase).toBe('pin_entry');
    });

    it('nfc.submitPin is the submitPin function when phase is pin_entry', async () => {
      await renderScreen('pin_entry');
      expect(lastProps().nfc.submitPin).toBe(mockSubmitPin);
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
  });

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  describe('navigation', () => {
    it('resets to Dashboard with toast when phase is done', async () => {
      await renderScreen('done');
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [
          {
            name: 'Dashboard',
            params: { toast: 'Key pair has been added to Keycard' },
          },
        ],
      });
    });

    it('does not navigate when phase is not done', async () => {
      await renderScreen('idle');
      expect(navigation.reset).not.toHaveBeenCalled();
    });

    it('calls cancel() and navigation.goBack() when NFCBottomSheet cancel is pressed', async () => {
      await renderScreen('nfc');
      const onCancel = MockNFCBottomSheet.mock.calls[0][0].onCancel;
      await act(async () => {
        onCancel();
      });
      expect(mockCancel).toHaveBeenCalledTimes(1);
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
  });
});
