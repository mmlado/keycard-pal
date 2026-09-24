import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import KeycardSettingsSection from '../src/components/settings/KeycardSettingsSection';
import {
  BUY_KEYCARD_LABEL,
  KEYCARD_PURCHASE_URL,
} from '../src/constants/purchaseLink';

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

async function pressRow() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('settings-buy-keycard'));
  });
}

// This file runs in the ios project, so `constants/purchaseLink` and
// `components/AffiliateDisclosure` resolve to their `.ios` twins: the product
// site with no referral parameter, and a disclosure that renders nothing.
// That is resolution, not a runtime flag, so there is no platform to pin here
// and no way to reach the affiliate wording from this file. The Android arm
// of these same expectations lives under `__tests__/android/`.
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

  it('names the destination and shows no disclosure beside it', () => {
    render(<KeycardSettingsSection />);

    // 'keycard.tech'. Naming where the hardware comes from is the whole of
    // the row on this build: no imperative verb, and nothing to disclose
    // because nothing is earned, so the label would be a claim about
    // commercial status rather than a disclosure.
    expect(screen.getByText(BUY_KEYCARD_LABEL)).toBeTruthy();
    expect(screen.queryByText('Buy a Keycard')).toBeNull();
    expect(screen.queryByTestId('affiliate-disclosure')).toBeNull();
  });

  describe('with a network connection (online build)', () => {
    it('shows the open-in-browser icon', () => {
      render(<KeycardSettingsSection />);
      expect(screen.getByTestId('icon-browser')).toBeTruthy();
      expect(screen.queryByTestId('icon-qr')).toBeNull();
    });

    it('opens the product site in the browser', async () => {
      render(<KeycardSettingsSection />);
      await pressRow();
      // 'https://keycard.tech', the product site, never the shop the Android
      // build points at.
      expect(Linking.openURL).toHaveBeenCalledWith(KEYCARD_PURCHASE_URL);
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
      // The QR screen is the whole placement when there is no network, so on
      // the build that pays a commission it carries the label through the
      // route. Here there is no commission, hence no note to carry.
      expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
        url: KEYCARD_PURCHASE_URL,
        title: BUY_KEYCARD_LABEL,
        note: undefined,
      });
      expect(Linking.openURL).not.toHaveBeenCalled();
    });
  });
});
