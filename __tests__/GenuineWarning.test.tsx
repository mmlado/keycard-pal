import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import GenuineWarning from '../src/components/NFCBottomSheet/GenuineWarning';

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

const onCancel = jest.fn();
const onProceed = jest.fn();

function renderWarning() {
  return render(<GenuineWarning onCancel={onCancel} onProceed={onProceed} />);
}

function containerStyle() {
  return StyleSheet.flatten(screen.getByTestId('genuine-warning').props.style);
}

beforeEach(() => {
  onCancel.mockClear();
  onProceed.mockClear();
  mockInsets.top = 0;
  mockInsets.bottom = 0;
});

describe('GenuineWarning', () => {
  it('names the card as unverified', () => {
    renderWarning();
    expect(screen.getByText('Unverified Keycard')).toBeTruthy();
  });

  it('cancels and proceeds through its two buttons', () => {
    renderWarning();
    fireEvent.press(screen.getByTestId('cancel-button'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('proceed-button'));
    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  it('pads the top by at least 24', () => {
    renderWarning();
    expect(containerStyle().paddingTop).toBe(24);
  });

  it('pads the top by the status bar inset when that is larger', () => {
    mockInsets.top = 48;
    renderWarning();
    expect(containerStyle().paddingTop).toBe(48);
  });

  it('pads the bottom by the inset plus 8, with a 16 floor', () => {
    renderWarning();
    expect(containerStyle().paddingBottom).toBe(24);
    screen.unmount();
    mockInsets.bottom = 34;
    renderWarning();
    expect(containerStyle().paddingBottom).toBe(42);
  });
});
