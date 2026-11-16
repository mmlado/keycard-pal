import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  KEYCARD_BUILD_GUIDE_LABEL,
  KEYCARD_BUILD_GUIDE_URL,
  NOT_LOCKED_DETAIL,
  NOT_LOCKED_HEADING,
  UNLOCK_KEY_CHOICES,
  UNLOCKED_HEADING,
  UPDATE_STEPS,
} from '../src/constants/installLock';
import UnlockInstallsScreen from '../src/screens/developerCards/UnlockInstallsScreen';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));
jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

const mockStart = jest.fn();
const mockUseUnlockInstalls = jest.fn();

jest.mock('../src/hooks/keycard/useInstallLock', () => ({
  useUnlockInstalls: () => mockUseUnlockInstalls(),
}));

const mockOpen = jest.fn();
const mockUseExternalLink = jest.fn();
jest.mock('../src/hooks/useExternalLink', () => ({
  useExternalLink: (link: unknown) => mockUseExternalLink(link),
}));

const navigation = {
  addListener: jest.fn(() => jest.fn()),
  goBack: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
} as any;
const route = { key: 'UnlockInstalls', name: 'UnlockInstalls' } as any;

function renderScreen(phase = 'idle', result: object | null = null) {
  mockUseUnlockInstalls.mockReturnValue({
    phase,
    status: '',
    result,
    successMessage: 'Applet installs unlocked',
    start: mockStart,
    cancel: jest.fn(),
    reset: jest.fn(),
    retry: jest.fn(),
    userCancels: 0,
  });
  return render(<UnlockInstallsScreen navigation={navigation} route={route} />);
}

const UNLOCKED = { outcome: 'unlocked', cardManagerKey: 'keycardDevelopment' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseExternalLink.mockReturnValue({ open: mockOpen, opensInBrowser: true });
});

describe('UnlockInstallsScreen', () => {
  describe('before the tap', () => {
    it('labels each choice by its words, not its icon', () => {
      renderScreen();
      for (const key of ['gpDefault', 'keycardDevelopment'] as const) {
        const { label, detail } = UNLOCK_KEY_CHOICES[key];
        expect(
          screen.getByTestId(`restore-${key}`).props.accessibilityLabel,
        ).toBe(`${label}. ${detail}`);
      }
    });

    it('offers both published keys, none picked', () => {
      renderScreen();
      for (const key of ['gpDefault', 'keycardDevelopment'] as const) {
        expect(screen.getByText(UNLOCK_KEY_CHOICES[key].label)).toBeTruthy();
        expect(
          screen.getByTestId(`restore-${key}`).props.accessibilityState,
        ).toEqual({ checked: false });
      }
    });

    it('does not start until a key is picked', () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('unlock-installs'));
      expect(mockStart).not.toHaveBeenCalled();
    });

    it.each(['gpDefault', 'keycardDevelopment'] as const)(
      'unlocks to %s once picked',
      key => {
        renderScreen();
        fireEvent.press(screen.getByTestId(`restore-${key}`));
        expect(
          screen.getByTestId(`restore-${key}`).props.accessibilityState,
        ).toEqual({ checked: true });
        fireEvent.press(screen.getByTestId('unlock-installs'));
        expect(mockStart).toHaveBeenCalledWith({
          action: 'unlock',
          restore: key,
        });
      },
    );
  });

  describe('after the tap', () => {
    it('stays on the result instead of leaving', () => {
      renderScreen('done', UNLOCKED);
      expect(navigation.reset).not.toHaveBeenCalled();
      expect(screen.getByText(UNLOCKED_HEADING)).toBeTruthy();
    });

    it('lists every update step', () => {
      renderScreen('done', UNLOCKED);
      for (const step of UPDATE_STEPS) {
        expect(screen.getByText(step)).toBeTruthy();
      }
    });

    it.each(['gpDefault', 'keycardDevelopment'] as const)(
      "says so when the card's installs were not locked, and names its %s key",
      key => {
        renderScreen('done', { outcome: 'notLocked', cardManagerKey: key });
        expect(screen.getByText(NOT_LOCKED_HEADING)).toBeTruthy();
        expect(screen.getByText(NOT_LOCKED_DETAIL[key])).toBeTruthy();
      },
    );

    it('reads each step as one line with its number', () => {
      renderScreen('done', UNLOCKED);
      UPDATE_STEPS.forEach((step, index) => {
        expect(screen.getByLabelText(`${index + 1}. ${step}`)).toBeTruthy();
      });
    });

    it('labels the guide link by its words, not its icon', () => {
      renderScreen('done', UNLOCKED);
      expect(
        screen.getByTestId('keycard-build-guide').props.accessibilityLabel,
      ).toBe(KEYCARD_BUILD_GUIDE_LABEL);
    });

    it("links Keycard's build guide", () => {
      renderScreen('done', UNLOCKED);
      expect(mockUseExternalLink).toHaveBeenCalledWith(
        expect.objectContaining({ url: KEYCARD_BUILD_GUIDE_URL }),
      );
      fireEvent.press(screen.getByTestId('keycard-build-guide'));
      expect(mockOpen).toHaveBeenCalled();
    });

    it('leaves to the Dashboard on Done, with no toast', () => {
      renderScreen('done', UNLOCKED);
      fireEvent.press(screen.getByTestId('unlock-done'));
      const [state] = navigation.reset.mock.calls.at(-1);
      expect(state.routes[0].name).toBe('Dashboard');
      expect(state.routes[0].params?.toast).toBeUndefined();
    });
  });
});
