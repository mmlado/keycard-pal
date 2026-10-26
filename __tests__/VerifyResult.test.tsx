import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import VerifyResult from '../src/components/VerifyResult';

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

describe('VerifyResult', () => {
  it('shows a check mark and its words for a match', () => {
    render(
      <VerifyResult
        matches
        text="Recovery phrase matches"
        onDone={jest.fn()}
      />,
    );
    expect(screen.getByTestId('verify-match')).toBeTruthy();
    expect(screen.queryByTestId('verify-mismatch')).toBeNull();
    expect(screen.getByText('Recovery phrase matches')).toBeTruthy();
  });

  it('shows an X and its words for a mismatch', () => {
    render(
      <VerifyResult
        matches={false}
        text="Recovery phrase does not match"
        onDone={jest.fn()}
      />,
    );
    expect(screen.getByTestId('verify-mismatch')).toBeTruthy();
    expect(screen.queryByTestId('verify-match')).toBeNull();
    expect(screen.getByText('Recovery phrase does not match')).toBeTruthy();
  });

  it('OK hands control back', () => {
    const onDone = jest.fn();
    render(<VerifyResult matches text="SLIP39 shares match" onDone={onDone} />);
    fireEvent.press(screen.getByText('OK'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
