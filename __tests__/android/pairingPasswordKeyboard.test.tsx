import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';

import PairingPasswordEntry from '../../src/components/NFCBottomSheet/PairingPasswordEntry';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsets = { top: 48, bottom: 24, left: 0, right: 0 };

let keyboardShow: ((event: any) => void) | null = null;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
  if (event === 'keyboardDidShow') {
    keyboardShow = callback as (event: any) => void;
  }
  return { remove: jest.fn() } as any;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PairingPasswordEntry on Android', () => {
  it('adds the navigation bar inset, which the reported keyboard height leaves out', () => {
    render(
      <PairingPasswordEntry
        error={null}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    act(() => {
      keyboardShow?.({ endCoordinates: { height: 300 } });
    });

    const style = StyleSheet.flatten(
      screen.getByTestId('pairing-password-entry').props.style,
    );
    expect(style.paddingBottom).toBe(332);
  });
});
