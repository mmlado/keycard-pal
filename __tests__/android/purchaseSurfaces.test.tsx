import React from 'react';
import { render, screen } from '@testing-library/react-native';

import KeycardPurchaseCard from '../../src/components/KeycardPurchaseCard';
import NFCBottomSheet from '../../src/components/NFCBottomSheet';
import NFCError from '../../src/components/NFCBottomSheet/NFCError';
import KeycardSettingsSection from '../../src/components/settings/KeycardSettingsSection';
import {
  AFFILIATE_DISCLOSURE,
  AFFILIATE_DISCLOSURE_SHORT,
  BUY_KEYCARD_LABEL,
  NO_CARD_EXIT_LABEL,
} from '../../src/constants/purchaseLink';
import WelcomeScreen from '../../src/screens/WelcomeScreen';

import { testPreferences as mockTestPreferences } from '../preferences.testUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { useSafeAreaInsets: () => mockInsets, SafeAreaView: View };
});

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../../src/assets/icons', () => require('../../__mocks__/iconsMock'));

jest.mock('../../src/components/PinPad', () => {
  const { View } = require('react-native');
  return () => <View testID="pin-pad" />;
});

// PrimaryButton is deliberately NOT mocked anywhere in this file: the button's
// own Text is where the label becomes visible, and a mock would let the file
// pass with nothing on screen at all.

let mockConnected = true;
jest.mock('../../src/utils/connectivity.online', () => ({
  getNetworkConnected: () => mockConnected,
  subscribeNetworkConnected: () => () => {},
  isNetworkConnected: () => Promise.resolve(mockConnected),
}));

jest.mock('../../src/navigation/navigationRef', () => ({
  navigationRef: { isReady: () => true, navigate: jest.fn() },
}));

jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: mockTestPreferences({ welcomeSeen: false }),
    setPreference: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The disclosure has to be the very node carrying the testID, not merely
 * somewhere in the tree: a label that drifted onto a different element would
 * still satisfy two separate queries, and copy under no testID at all would
 * satisfy a testID-only check.
 */
function expectDisclosure(copy: string) {
  expect(screen.getByText(copy)).toBe(
    screen.getByTestId('affiliate-disclosure'),
  );
}

const onCancel = jest.fn();
const navigation = { replace: jest.fn() } as any;
const route = { key: 'Welcome-1', name: 'Welcome' } as any;

/**
 * Proof that the Android build still labels its paid placements.
 *
 * The affiliate URL pays the developer a commission, which makes every surface
 * offering it an advertisement that has to say so. Five of them exist, and the
 * iOS suite cannot see any of them: that project resolves the `.ios` twins, so
 * `<AffiliateDisclosure />` there renders nothing by construction and would go
 * on passing if this copy disappeared from Android entirely. This file runs in
 * the android project, where resolution picks the base files, and is the only
 * place the Advertisement wording is actually rendered and read back.
 *
 * Behaviour those components already cover in the iOS arm is not repeated
 * here. What is asserted is what changes with the platform: the label, and the
 * imperative "Buy a Keycard" wording that goes with a placement someone is
 * paid for.
 */
describe('Android purchase surfaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnected = true;
    mockInsets.bottom = 0;
  });

  // Written out rather than compared to the constants alone: every assertion
  // below reads the same exports the components do, so the constants would
  // agree with any wording that replaced them. These are the sentences the
  // disclosure obligation is discharged with.
  it('carries the Advertisement copy and the imperative label', () => {
    expect(BUY_KEYCARD_LABEL).toBe('Buy a Keycard');
    expect(AFFILIATE_DISCLOSURE).toBe(
      'Advertisement: affiliate link. The developer earns a commission if you buy a Keycard.',
    );
    expect(AFFILIATE_DISCLOSURE_SHORT).toBe(
      'Advertisement: affiliate link, pays the developer a commission.',
    );
  });

  // 1. The Welcome screen, through WelcomeActions.tsx. The android twin offers
  // the shop as a button of its own, so the label sits between that button and
  // Get started rather than beside a quiet link.
  it('labels the Buy a Keycard button on the Welcome screen', () => {
    render(<WelcomeScreen navigation={navigation} route={route} />);

    expect(screen.getByTestId('welcome-buy-keycard')).toBeTruthy();
    expect(screen.getByText('Buy a Keycard')).toBeTruthy();
    expect(screen.getByTestId('welcome-get-started')).toBeTruthy();
    expectDisclosure(AFFILIATE_DISCLOSURE);
  });

  // The same button offline, where the tap shows a QR code instead of opening
  // a browser. Both icon arms render; the shared icons mock answers every key
  // with the same component, so the assertion stays on what is true.
  it('keeps the button and its label without a network', () => {
    mockConnected = false;

    render(<WelcomeScreen navigation={navigation} route={route} />);

    expect(screen.getByTestId('welcome-buy-keycard')).toBeTruthy();
    expect(screen.getByText('Buy a Keycard')).toBeTruthy();
    expectDisclosure(AFFILIATE_DISCLOSURE);
  });

  // 2. Settings, the permanent home of the link. The short wording is used
  // where a row has no room for the full sentence.
  it('labels the Settings row', () => {
    render(<KeycardSettingsSection />);

    expect(screen.getByTestId('settings-buy-keycard')).toBeTruthy();
    expect(screen.getByText('Buy a Keycard')).toBeTruthy();
    expectDisclosure(AFFILIATE_DISCLOSURE_SHORT);
  });

  // 3. The purchase card, shown wherever the app has to explain that the
  // hardware is a prerequisite.
  it('labels the purchase card', () => {
    render(<KeycardPurchaseCard />);

    expect(screen.getByText('Keycard required')).toBeTruthy();
    expect(screen.getByText('Buy a Keycard')).toBeTruthy();
    expectDisclosure(AFFILIATE_DISCLOSURE);
  });

  // 4. The NFC sheet's no-card exit, reached through NFCBottomSheet because
  // the sheet is what decides the link is offered at all. Nothing is pinned:
  // showSheet tests Platform.OS === 'android' and this project already is.
  // The exit reads "Don't have a Keycard?" rather than the button label, so
  // there is no label to check here, only the disclosure beside it.
  it.each(['nfc', 'error'] as const)(
    'labels the no-card exit on the NFC sheet in phase %s',
    phase => {
      render(
        <NFCBottomSheet
          nfc={{ phase, status: 'Ready', cardPresence: 'waiting' }}
          onCancel={onCancel}
        />,
      );

      expect(screen.getByText(NO_CARD_EXIT_LABEL)).toBeTruthy();
      expectDisclosure(AFFILIATE_DISCLOSURE_SHORT);
    },
  );

  // 5. The error overlay. Rendered directly rather than through
  // NFCBottomSheet, which mounts it only when Platform.OS === 'ios': pinning
  // that here would pair an iOS runtime with android resolution and describe a
  // build nobody ships. The file has no `.ios` twin, so it is compiled into
  // the android bundle with the disclosure that resolves there, and that is
  // what is checked.
  it('labels the no-card exit on the error overlay', () => {
    render(
      <NFCError
        status="Session timed out"
        onCancel={onCancel}
        onBuyKeycard={jest.fn()}
      />,
    );

    expect(screen.getByText(NO_CARD_EXIT_LABEL)).toBeTruthy();
    expectDisclosure(AFFILIATE_DISCLOSURE_SHORT);
  });
});
