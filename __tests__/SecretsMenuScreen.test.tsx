import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SecretsMenuScreen, {
  dashboardEntry,
} from '../src/screens/secrets/SecretsMenuScreen';

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

// These assertions describe the list layout's rows, so pin the preference.
let mockGenerationsInUse: ('3.1' | '4.0')[] = ['3.1', '4.0'];

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: mockTestPreferences({
      dashboardLayout: 'list',
      generationsInUse: mockGenerationsInUse,
    }),
    setPreference: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = { navigate: jest.fn() } as any;
const route = { key: 'SecretsMenu', name: 'SecretsMenu' } as any;

function renderScreen() {
  return render(<SecretsMenuScreen navigation={navigation} route={route} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SecretsMenuScreen', () => {
  beforeEach(() => {
    navigation.navigate.mockClear();
    mockGenerationsInUse = ['3.1', '4.0'];
  });

  describe('layout', () => {
    it('renders "Change PIN" entry', () => {
      renderScreen();
      expect(screen.getByText('Change PIN')).toBeTruthy();
    });

    it('renders "Change PUK" entry', () => {
      renderScreen();
      expect(screen.getByText('Change PUK')).toBeTruthy();
    });

    it('renders "Change Pairing Secret" entry', () => {
      renderScreen();
      expect(screen.getByText('Change Pairing Secret')).toBeTruthy();
    });

    it('shows a leading icon on every row', () => {
      renderScreen();
      for (const index of [0, 1, 2]) {
        expect(screen.getByTestId(`menu-icon-${index}`)).toBeTruthy();
      }
    });
  });

  // The pairing secret row taps at once, so it carries the NFC mark.
  describe('NFC indicator', () => {
    it('marks only the pairing secret entry', () => {
      renderScreen();
      expect(screen.queryByTestId('menu-nfc-indicator-0')).toBeNull();
      expect(screen.queryByTestId('menu-nfc-indicator-1')).toBeNull();
      expect(screen.getByTestId('menu-nfc-indicator-2')).toBeTruthy();
    });
  });

  describe('navigation', () => {
    it('navigates to ChangeSecret with pin secretType', () => {
      renderScreen();
      fireEvent.press(screen.getByText('Change PIN'));
      expect(navigation.navigate).toHaveBeenCalledWith('ChangeSecret', {
        secretType: 'pin',
      });
    });

    it('navigates to ChangeSecret with puk secretType', () => {
      renderScreen();
      fireEvent.press(screen.getByText('Change PUK'));
      expect(navigation.navigate).toHaveBeenCalledWith('ChangeSecret', {
        secretType: 'puk',
      });
    });

    it('navigates to ChangeSecret with pairing secretType', () => {
      renderScreen();
      fireEvent.press(screen.getByText('Change Pairing Secret'));
      expect(navigation.navigate).toHaveBeenCalledWith('ChangeSecret', {
        secretType: 'pairing',
      });
    });
  });

  // The pairing secret went away with applet 4.0. PIN and PUK did not.
  describe('pairing secret entry', () => {
    it('is hidden when only 4.x cards are ticked', () => {
      mockGenerationsInUse = ['4.0'];
      renderScreen();
      expect(screen.queryByText('Change Pairing Secret')).toBeNull();
      expect(screen.getByText('Change PIN')).toBeTruthy();
      expect(screen.getByText('Change PUK')).toBeTruthy();
    });

    it('stays when 3.x cards are ticked', () => {
      mockGenerationsInUse = ['3.1'];
      renderScreen();
      expect(screen.getByText('Change Pairing Secret')).toBeTruthy();
    });
  });

  describe('dashboardEntry', () => {
    it('has the correct label', () => {
      expect(dashboardEntry.label).toBe('Secrets');
    });

    it('navigates to SecretsMenu when invoked', () => {
      const nav = { navigate: jest.fn() } as any;
      dashboardEntry.navigate(nav);
      expect(nav.navigate).toHaveBeenCalledWith('SecretsMenu');
    });
  });
});
