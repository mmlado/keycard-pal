import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import KeycardSettingsSection from '../src/components/settings/KeycardSettingsSection';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => {
  const { View } = require('react-native');
  return {
    Icons: {
      openInBrowser: (props: any) => <View testID="icon-browser" {...props} />,
      qr: (props: any) => <View testID="icon-qr" {...props} />,
    },
  };
});

// The offline build swaps this module for a stub that always reports
// disconnected, so "no network" below also covers the offline flavor.
let mockConnected = true;
jest.mock('../src/utils/connectivity.online', () => ({
  getNetworkConnected: () => mockConnected,
  subscribeNetworkConnected: () => () => {},
  isNetworkConnected: () => Promise.resolve(mockConnected),
}));

const mockNavigate = jest.fn();
jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => true,
    navigate: (...args: any[]) => mockNavigate(...args),
  },
}));

const PURCHASE_URL = 'https://get.keycard.tech/vuxxnf';

async function pressRow() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('settings-buy-keycard'));
  });
}

describe('KeycardSettingsSection', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockConnected = true;
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    (Linking.openURL as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the Buy a Keycard row', () => {
    render(<KeycardSettingsSection />);
    expect(screen.getByText('Buy a Keycard')).toBeTruthy();
  });

  describe('with a network connection (online build)', () => {
    it('shows the open-in-browser icon', () => {
      render(<KeycardSettingsSection />);
      expect(screen.getByTestId('icon-browser')).toBeTruthy();
      expect(screen.queryByTestId('icon-qr')).toBeNull();
    });

    it('opens the affiliate link in the browser', async () => {
      render(<KeycardSettingsSection />);
      await pressRow();
      expect(Linking.openURL).toHaveBeenCalledWith(PURCHASE_URL);
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('without a network connection (and always in the offline build)', () => {
    beforeEach(() => {
      mockConnected = false;
    });

    it('shows the QR icon', () => {
      render(<KeycardSettingsSection />);
      expect(screen.getByTestId('icon-qr')).toBeTruthy();
      expect(screen.queryByTestId('icon-browser')).toBeNull();
    });

    it('shows the link as a QR code and never opens a browser', async () => {
      render(<KeycardSettingsSection />);
      await pressRow();
      expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
        url: PURCHASE_URL,
        title: 'Buy a Keycard',
      });
      expect(Linking.openURL).not.toHaveBeenCalled();
    });
  });
});
