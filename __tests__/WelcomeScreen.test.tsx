import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WelcomeScreen from '../src/screens/WelcomeScreen';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return {
    MD3DarkTheme: { colors: {} },
    Text,
  };
});

jest.mock('../src/assets/icons', () => {
  const { View } = require('react-native');
  const Icon = (props: any) => <View {...props} />;
  return {
    Icons: {
      keycardPal: Icon,
      nfcActivate: Icon,
      openInBrowser: Icon,
      qr: Icon,
    },
  };
});

// Get started writes the flag through the preferences context.
const mockSetPreference = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: { welcomeSeen: false },
    setPreference: (...args: any[]) => mockSetPreference(...args),
  }),
}));

// The buy button goes through useBuyKeycard: live network state decides
// between browser and QR code, and the offline build's stub always reports
// disconnected.
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

const mockReplace = jest.fn();
const navigation = { replace: mockReplace } as any;
const route = { key: 'Welcome-1', name: 'Welcome' } as any;

async function pressBuy() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('welcome-buy-keycard'));
  });
}

describe('WelcomeScreen', () => {
  beforeEach(() => {
    mockSetPreference.mockClear();
    mockNavigate.mockClear();
    mockReplace.mockClear();
    mockConnected = true;
    // The RN jest preset already mocks Linking.openURL, so spyOn returns that
    // shared mock; clear it to keep call history per-test.
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    (Linking.openURL as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the welcome title and explainer copy', () => {
    render(<WelcomeScreen navigation={navigation} route={route} />);

    expect(screen.getByText('Welcome to Keycard Pal')).toBeTruthy();
    expect(
      screen.getByText(
        'The air-gapped companion app for your Keycard hardware wallet.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Keys stay in hardware')).toBeTruthy();
    expect(screen.getByText('Air-gapped by design')).toBeTruthy();
    expect(screen.getByText('Sign with a tap')).toBeTruthy();
  });

  it('marks welcome as seen and replaces with Dashboard on Get started', () => {
    render(<WelcomeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByTestId('welcome-get-started'));

    expect(mockSetPreference).toHaveBeenCalledWith('welcomeSeen', true);
    expect(mockReplace).toHaveBeenCalledWith('Dashboard');
  });

  it('opens the affiliate purchase link in the browser when there is a network', async () => {
    render(<WelcomeScreen navigation={navigation} route={route} />);

    await pressBuy();

    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://get.keycard.tech/vuxxnf',
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows the purchase link as a QR code without a network (always in the offline build)', async () => {
    mockConnected = false;
    render(<WelcomeScreen navigation={navigation} route={route} />);

    await pressBuy();

    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: 'https://get.keycard.tech/vuxxnf',
      title: 'Buy a Keycard',
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('shows the buy button', () => {
    render(<WelcomeScreen navigation={navigation} route={route} />);

    expect(screen.getByText('Buy a Keycard')).toBeTruthy();
  });
});
