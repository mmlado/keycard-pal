import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import KeySizeScreen from '../src/screens/keypair/KeySizeScreen';

import { testPreferences as mockTestPreferences } from './preferences.testUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

// These assertions describe the list layout's rows, so pin the preference.
jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: mockTestPreferences({ dashboardLayout: 'list' }),
    setPreference: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = { navigate: jest.fn() } as any;
const route = { key: 'KeySize', name: 'KeySize' } as any;

function renderScreen() {
  return render(<KeySizeScreen navigation={navigation} route={route} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KeySizeScreen', () => {
  beforeEach(() => {
    navigation.navigate.mockClear();
    mockInsets.bottom = 0;
  });

  it('keeps the last entry above the bottom inset', () => {
    mockInsets.bottom = 34;
    const { toJSON } = renderScreen();
    const root = toJSON() as any;
    expect(StyleSheet.flatten(root.props.style).paddingBottom).toBe(34);
  });

  describe('layout', () => {
    it('renders the "12 word" option', () => {
      renderScreen();
      expect(screen.getByText('12 word')).toBeTruthy();
    });

    it('renders the "24 word" option', () => {
      renderScreen();
      expect(screen.getByText('24 word')).toBeTruthy();
    });

    it('renders the "12 word + passphrase" option', () => {
      renderScreen();
      expect(screen.getByText('12 word + passphrase')).toBeTruthy();
    });

    it('renders the "24 word + passphrase" option', () => {
      renderScreen();
      expect(screen.getByText('24 word + passphrase')).toBeTruthy();
    });

    it('shows a leading icon on every option', () => {
      renderScreen();
      for (const index of [0, 1, 2, 3]) {
        expect(screen.getByTestId(`menu-icon-${index}`)).toBeTruthy();
      }
    });
  });

  describe('navigation', () => {
    it('navigates to GenerateKey with size 12 when "12 word" is pressed', () => {
      renderScreen();
      fireEvent.press(screen.getByText('12 word'));
      expect(navigation.navigate).toHaveBeenCalledWith('GenerateKey', {
        size: 12,
      });
    });

    it('navigates to GenerateKey with size 12 + passphrase when "12 word + passphrase" is pressed', () => {
      renderScreen();
      fireEvent.press(screen.getByText('12 word + passphrase'));
      expect(navigation.navigate).toHaveBeenCalledWith('GenerateKey', {
        size: 12,
        passphrase: true,
      });
    });

    it('navigates to GenerateKey with size 24 when "24 word" is pressed', () => {
      renderScreen();
      fireEvent.press(screen.getByText('24 word'));
      expect(navigation.navigate).toHaveBeenCalledWith('GenerateKey', {
        size: 24,
      });
    });

    it('navigates to GenerateKey with size 24 + passphrase when "24 word + passphrase" is pressed', () => {
      renderScreen();
      fireEvent.press(screen.getByText('24 word + passphrase'));
      expect(navigation.navigate).toHaveBeenCalledWith('GenerateKey', {
        size: 24,
        passphrase: true,
      });
    });
  });
});
