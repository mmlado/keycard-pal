import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';

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

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

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

// Literals, not the constants: a constant would follow the source it should hold in place.
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
  });

  it('follows the introduction with the three steps, each with its position', () => {
    render(<WelcomeScreen navigation={navigation} route={route} />);

    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.getByText('Set up your Keycard')).toBeTruthy();
    expect(
      screen.getByText(/In Keycard, Initialize sets its PIN, and Key pair/),
    ).toBeTruthy();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect(screen.getByText('Connect your wallet')).toBeTruthy();
    expect(screen.getByText(/In Connect software wallet, pick/)).toBeTruthy();
    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
    expect(screen.getAllByText('Sign with a tap')).toHaveLength(2);
    expect(screen.getByText(/press Scan\. Check what you are/)).toBeTruthy();
  });

  it('gives the pager one dot per slide, named for a screen reader', () => {
    render(<WelcomeScreen navigation={navigation} route={route} />);

    expect(screen.getByLabelText('Welcome')).toBeTruthy();
    expect(screen.getByLabelText('Step 1 of 3')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 3')).toBeTruthy();
    expect(screen.queryByTestId('slide-dot-4')).toBeNull();
  });

  // Literals: a step must name each entry exactly as its menu shows it.
  it('names entries that exist under those labels', () => {
    const source = (file: string) =>
      readFileSync(join(__dirname, '..', 'src', file), 'utf8');

    expect(source('screens/KeycardMenuScreen.tsx')).toContain(
      "label: 'Keycard'",
    );
    expect(source('screens/KeycardMenuScreen.tsx')).toContain(
      "label: 'Initialize'",
    );
    expect(source('screens/KeycardMenuScreen.tsx')).toContain(
      "label: 'Key pair'",
    );
    expect(source('screens/ExportKeyScreen.tsx')).toContain(
      "label: 'Connect software wallet'",
    );
    expect(source('screens/DashboardScreen.tsx')).toContain('label="Scan"');
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

    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: 'https://keycard.tech',
      title: 'keycard.tech',
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
