import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import Bip85MenuScreen from '../src/screens/bip85/Bip85MenuScreen';

import { testPreferences as mockTestPreferences } from './preferences.testUtils';

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

const navigation = { navigate: jest.fn() } as any;
const route = { key: 'Bip85Menu', name: 'Bip85Menu' } as any;

function renderScreen() {
  return render(<Bip85MenuScreen navigation={navigation} route={route} />);
}

describe('Bip85MenuScreen', () => {
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

  it('groups the formats under their kind, in menu order', () => {
    const { toJSON } = renderScreen();
    const rendered = JSON.stringify(toJSON());
    const order = [
      'BIP39 recovery phrase',
      '12 words',
      '18 words',
      '24 words',
      'Private key',
      'Bitcoin WIF',
      'BIP32 XPRV',
      'Hex entropy',
      '32 bytes',
      '64 bytes',
      'Base64 password',
      '21 characters',
    ].map(text => rendered.indexOf(`"${text}"`));
    expect(order.every(position => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('opens each format', () => {
    renderScreen();
    for (const [label, format] of [
      ['12 words', 'words12'],
      ['18 words', 'words18'],
      ['24 words', 'words24'],
      ['Bitcoin WIF', 'wif'],
      ['BIP32 XPRV', 'xprv'],
      ['32 bytes', 'hex32'],
      ['64 bytes', 'hex64'],
      ['21 characters', 'password'],
    ] as const) {
      fireEvent.press(screen.getByText(label));
      expect(navigation.navigate).toHaveBeenLastCalledWith('Bip85', {
        format,
      });
    }
  });

  // Each row opens a form; the tap comes after it.
  it('marks no row as an NFC action', () => {
    renderScreen();
    expect(screen.queryByTestId(/menu-nfc-indicator/)).toBeNull();
  });
});
