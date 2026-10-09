import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WelcomeScreen from '../src/screens/WelcomeScreen';

import { testPreferences as mockTestPreferences } from './preferences.testUtils';

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
    preferences: mockTestPreferences({ welcomeSeen: false }),
    setPreference: (...args: any[]) => mockSetPreference(...args),
  }),
}));

// useBuyKeycard picks browser or QR code from the network state.
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

// This file runs in the ios project, where the screen's action block resolves
// to WelcomeActions.ios.tsx and the purchase constants to purchaseLink.ios.ts.
// Resolution, not Platform.OS, decides that, so there is nothing to pin and no
// way to reach the affiliate wording from here: the Android action block is
// asserted in the android project under __tests__/android/.
//
// The URL and the label are written out instead of imported. They are the
// claim the App Store review turns on, and a constant would follow the source
// it is meant to hold in place.
describe('WelcomeScreen', () => {
  beforeEach(() => {
    mockSetPreference.mockClear();
    mockNavigate.mockClear();
    mockReplace.mockClear();
    mockConnected = true;
    // The preset's Linking.openURL mock is shared: clear it per test.
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

  // Get started is the only primary button here. The card is a prerequisite to
  // state, not a purchase to close, so the pointer under it is a link that
  // names where the information lives and asks for nothing.
  it('states the hardware requirement and points at it without an offer', () => {
    render(<WelcomeScreen navigation={navigation} route={route} />);

    expect(
      screen.getByText('Keycard Pal needs a Keycard to work.'),
    ).toBeTruthy();
    expect(screen.getByText('keycard.tech')).toBeTruthy();
    expect(screen.queryByText('Buy a Keycard')).toBeNull();
    expect(
      screen.getByTestId('welcome-buy-keycard').props.accessibilityRole,
    ).toBe('link');
  });

  // Nothing is earned on this build, so there is nothing to disclose and the
  // Advertisement label would be a false statement rather than a safe extra.
  it('shows no advertisement label', () => {
    render(<WelcomeScreen navigation={navigation} route={route} />);

    expect(screen.queryByTestId('affiliate-disclosure')).toBeNull();
    expect(screen.queryByText(/Advertisement/i)).toBeNull();
  });

  it('opens the product site in the browser when there is a network', async () => {
    render(<WelcomeScreen navigation={navigation} route={route} />);

    await pressBuy();

    // The product site, not the shop, and no referral parameter on the end.
    expect(Linking.openURL).toHaveBeenCalledWith('https://keycard.tech');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows the link as a QR code without a network (always in the offline build)', async () => {
    mockConnected = false;
    render(<WelcomeScreen navigation={navigation} route={route} />);

    await pressBuy();

    // No note under the QR code: the offline screen is the whole placement,
    // and there is no commission behind it to admit to.
    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: 'https://keycard.tech',
      title: 'keycard.tech',
      note: undefined,
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
