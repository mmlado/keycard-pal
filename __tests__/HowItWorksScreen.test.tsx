import React from 'react';
import { render, screen } from '@testing-library/react-native';

import HowItWorksScreen from '../src/screens/HowItWorksScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

describe('HowItWorksScreen', () => {
  it('shows the welcome slides', () => {
    render(<HowItWorksScreen />);

    expect(screen.getByText('Welcome to Keycard Pal')).toBeTruthy();
    expect(screen.getByText('Set up your Keycard')).toBeTruthy();
    expect(screen.getByText('Connect your wallet')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 3')).toBeTruthy();
  });

  it('has no Get started and no Keycard pointer', () => {
    render(<HowItWorksScreen />);

    expect(screen.queryByText('Get started')).toBeNull();
    expect(screen.queryByText('keycard.tech')).toBeNull();
  });
});
