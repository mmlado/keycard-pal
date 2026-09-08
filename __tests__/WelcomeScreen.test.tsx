import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

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

const mockSaveWelcomeSeen = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/storage/preferencesStorage', () => ({
  saveWelcomeSeen: (...args: any[]) => mockSaveWelcomeSeen(...args),
}));

let mockInternetEnabled = true;
jest.mock('../src/utils/buildConfig', () => ({
  get INTERNET_ENABLED() {
    return mockInternetEnabled;
  },
}));

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const navigation = { navigate: mockNavigate, replace: mockReplace } as any;
const route = { key: 'Welcome-1', name: 'Welcome' } as any;

describe('WelcomeScreen', () => {
  beforeEach(() => {
    mockSaveWelcomeSeen.mockClear();
    mockNavigate.mockClear();
    mockReplace.mockClear();
    mockInternetEnabled = true;
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

    expect(mockSaveWelcomeSeen).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('Dashboard');
  });

  it('opens the affiliate purchase link in the browser (online build)', () => {
    render(<WelcomeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByTestId('welcome-buy-keycard'));

    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://get.keycard.tech/vuxxnf',
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows the purchase link as a QR code instead (offline build)', () => {
    mockInternetEnabled = false;
    render(<WelcomeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByTestId('welcome-buy-keycard'));

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

  it('still navigates when persisting the flag fails', () => {
    mockSaveWelcomeSeen.mockRejectedValueOnce(new Error('storage failure'));
    render(<WelcomeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByTestId('welcome-get-started'));

    expect(mockReplace).toHaveBeenCalledWith('Dashboard');
  });
});
