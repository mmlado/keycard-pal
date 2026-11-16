import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import DeveloperCardsMenuScreen from '../src/screens/developerCards/DeveloperCardsMenuScreen';
import { testPreferences as mockTestPreferences } from './preferences.testUtils';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

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

const navigation = { navigate: jest.fn() } as any;
const route = { key: 'DeveloperCardsMenu', name: 'DeveloperCardsMenu' } as any;

function renderScreen() {
  return render(
    <DeveloperCardsMenuScreen navigation={navigation} route={route} />,
  );
}

beforeEach(() => {
  navigation.navigate.mockClear();
  mockGenerationsInUse = ['3.1', '4.0'];
});

describe('DeveloperCardsMenuScreen', () => {
  it.each([
    ['Lock applet installs', 'LockInstalls'],
    ['Unlock applet installs', 'UnlockInstalls'],
  ])('%s opens its screen', (label, target) => {
    renderScreen();
    fireEvent.press(screen.getByText(label));
    expect(navigation.navigate).toHaveBeenCalledWith(target);
  });

  // Each opens a screen first; the button there starts the tap and carries the mark.
  it('marks neither entry as starting a tap', () => {
    renderScreen();
    expect(screen.queryByTestId('menu-nfc-indicator-0')).toBeNull();
    expect(screen.queryByTestId('menu-nfc-indicator-1')).toBeNull();
  });

  it('leaves both out when only 3.x cards are ticked', () => {
    mockGenerationsInUse = ['3.1'];
    renderScreen();
    expect(screen.queryByText('Lock applet installs')).toBeNull();
    expect(screen.queryByText('Unlock applet installs')).toBeNull();
  });
});
