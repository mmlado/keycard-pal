import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SecretsMenuScreen, {
  dashboardEntry,
} from '../src/screens/secrets/SecretsMenuScreen';

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
let mockMinGeneration: '3.1' | '4.0' | 'any' = 'any';

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: { dashboardLayout: 'list', minGeneration: mockMinGeneration },
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
    mockMinGeneration = 'any';
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
    it('is hidden once the user has declared 4.0 cards', () => {
      mockMinGeneration = '4.0';
      renderScreen();
      expect(screen.queryByText('Change Pairing Secret')).toBeNull();
      expect(screen.getByText('Change PIN')).toBeTruthy();
      expect(screen.getByText('Change PUK')).toBeTruthy();
    });

    it('stays for 3.1 cards', () => {
      mockMinGeneration = '3.1';
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
