import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import AddressMenuScreen, {
  dashboardEntry,
} from '../src/screens/address/AddressMenuScreen';

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
jest.mock('../src/hooks/useDashboardLayout', () => ({
  useDashboardLayout: () => ({ layout: 'list', loaded: true }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = { navigate: jest.fn() } as any;
const route = { key: 'AddressMenu', name: 'AddressMenu' } as any;

function renderScreen() {
  return render(<AddressMenuScreen navigation={navigation} route={route} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AddressMenuScreen', () => {
  beforeEach(() => {
    navigation.navigate.mockClear();
  });

  describe('layout', () => {
    it('renders the "Ethereum" menu entry', () => {
      renderScreen();
      expect(screen.getByText('Ethereum')).toBeTruthy();
    });

    it('renders the "Bitcoin" menu entry', () => {
      renderScreen();
      expect(screen.getByText('Bitcoin')).toBeTruthy();
    });

    it('shows the NFC indicator for both address entries', () => {
      renderScreen();
      expect(screen.getByTestId('menu-nfc-indicator-0')).toBeTruthy();
      expect(screen.getByTestId('menu-nfc-indicator-1')).toBeTruthy();
    });

    it('shows a leading icon on both address entries', () => {
      renderScreen();
      expect(screen.getByTestId('menu-icon-0')).toBeTruthy();
      expect(screen.getByTestId('menu-icon-1')).toBeTruthy();
    });
  });

  describe('navigation', () => {
    it('navigates to AddressList with coin=eth when Ethereum is pressed', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByText('Ethereum'));
      });
      expect(navigation.navigate).toHaveBeenCalledWith('AddressList', {
        coin: 'eth',
      });
    });

    it('navigates to AddressList with coin=btc when Bitcoin is pressed', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByText('Bitcoin'));
      });
      expect(navigation.navigate).toHaveBeenCalledWith('AddressList', {
        coin: 'btc',
      });
    });
  });

  describe('dashboardEntry', () => {
    it('has the correct label', () => {
      expect(dashboardEntry.label).toBe('Addresses');
    });

    it('navigates to AddressMenu when invoked', () => {
      const nav = { navigate: jest.fn() } as any;
      dashboardEntry.navigate(nav);
      expect(nav.navigate).toHaveBeenCalledWith('AddressMenu');
    });
  });
});
