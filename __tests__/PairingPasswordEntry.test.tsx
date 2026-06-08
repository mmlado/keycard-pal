import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import PairingPasswordEntry from '../src/components/NFCBottomSheet/PairingPasswordEntry';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const onSubmit = jest.fn();
const onCancel = jest.fn();

function renderEntry(
  props: Partial<React.ComponentProps<typeof PairingPasswordEntry>> = {},
) {
  return render(
    <PairingPasswordEntry
      error={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />,
  );
}

beforeEach(() => {
  onSubmit.mockClear();
  onCancel.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PairingPasswordEntry', () => {
  it('renders title and body text', () => {
    renderEntry();
    expect(screen.getByText('Custom pairing password')).toBeTruthy();
    expect(screen.getByText(/non-default pairing password/)).toBeTruthy();
  });

  it('renders a TextInput with secureTextEntry', () => {
    renderEntry();
    const input = screen.getByPlaceholderText('Pairing password');
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('Continue button is disabled when input is empty', () => {
    renderEntry();
    fireEvent.press(screen.getByText('Continue'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with trimmed password when Continue is pressed', () => {
    renderEntry();
    fireEvent.changeText(screen.getByPlaceholderText('Pairing password'), 'myPassword');
    fireEvent.press(screen.getByText('Continue'));
    expect(onSubmit).toHaveBeenCalledWith('myPassword');
  });

  it('trims whitespace before submitting', () => {
    renderEntry();
    fireEvent.changeText(screen.getByPlaceholderText('Pairing password'), '  secret  ');
    fireEvent.press(screen.getByText('Continue'));
    expect(onSubmit).toHaveBeenCalledWith('secret');
  });

  it('does not call onSubmit when input is only whitespace', () => {
    renderEntry();
    fireEvent.changeText(screen.getByPlaceholderText('Pairing password'), '   ');
    fireEvent.press(screen.getByText('Continue'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is pressed', () => {
    renderEntry();
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows error message when error prop is provided', () => {
    renderEntry({ error: 'Wrong pairing password. Try again.' });
    expect(screen.getByText('Wrong pairing password. Try again.')).toBeTruthy();
  });

  it('does not show error when error prop is null', () => {
    renderEntry({ error: null });
    expect(screen.queryByText('Wrong pairing password. Try again.')).toBeNull();
  });
});
