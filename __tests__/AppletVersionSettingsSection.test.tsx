import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import AppletVersionSettingsSection from '../src/components/settings/AppletVersionSettingsSection';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

let mockMinGeneration: '3.1' | '4.0' | 'any' = 'any';

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: { minGeneration: mockMinGeneration },
    setPreference: jest.fn(),
  }),
}));

beforeEach(() => {
  mockMinGeneration = 'any';
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppletVersionSettingsSection', () => {
  it('shows the floor while nothing is declared', () => {
    render(<AppletVersionSettingsSection onPress={jest.fn()} />);
    expect(screen.getByText('Keycard applet version')).toBeTruthy();
    expect(screen.getByText('3.1 or newer')).toBeTruthy();
  });

  it('shows the declared generation', () => {
    mockMinGeneration = '4.0';
    render(<AppletVersionSettingsSection onPress={jest.fn()} />);
    expect(screen.getByText('4.0 or newer')).toBeTruthy();
  });

  it('reads the value out with the label', () => {
    mockMinGeneration = '4.0';
    render(<AppletVersionSettingsSection onPress={jest.fn()} />);
    expect(
      screen.getByLabelText('Keycard applet version, 4.0 or newer'),
    ).toBeTruthy();
  });

  it('opens the picker when pressed', () => {
    const onPress = jest.fn();
    render(<AppletVersionSettingsSection onPress={onPress} />);
    fireEvent.press(screen.getByTestId('settings-applet-version'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
