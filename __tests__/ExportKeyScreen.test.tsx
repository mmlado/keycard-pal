import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { PreferencesProvider } from '../src/providers/preferences/Provider';
import ExportKeyScreen, {
  dashboardEntry,
} from '../src/screens/ExportKeyScreen';

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

// The screen reads and writes the xpub notice through the real provider, so
// only storage is mocked. These assertions describe the list layout's rows,
// so the stored preferences pin it.
const mockLoadPreferences = jest.fn();
const mockSavePreference = jest.fn();
jest.mock('../src/storage/preferencesStorage', () => ({
  loadPreferences: () => mockLoadPreferences(),
  savePreference: (...args: unknown[]) => mockSavePreference(...args),
}));

// ExportKeyScreen imports dashboardActions for border-style calculation.
jest.mock('../src/navigation/dashboardActions', () => ({
  dashboardActions: [{ label: 'Connect software wallet', navigate: jest.fn() }],
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = { navigate: jest.fn() } as any;

function storedPreferences(xpubNoticeDismissed: boolean) {
  mockLoadPreferences.mockResolvedValue({
    dashboardLayout: 'list',
    pinPadScramble: false,
    tokenImagesEnabled: false,
    welcomeSeen: true,
    xpubNoticeDismissed,
  });
}

// Renders under the provider and waits for the startup preference read.
async function renderScreen() {
  const result = render(
    <PreferencesProvider>
      <ExportKeyScreen
        navigation={navigation}
        route={{ key: 'ExportKey', name: 'ExportKey' } as any}
      />
    </PreferencesProvider>,
  );
  await act(async () => {});
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExportKeyScreen', () => {
  beforeEach(() => {
    navigation.navigate.mockClear();
    mockLoadPreferences.mockReset();
    mockSavePreference.mockReset().mockResolvedValue(undefined);
    storedPreferences(false);
  });

  describe('layout', () => {
    it('renders without crashing', async () => {
      expect(await renderScreen()).toBeDefined();
    });

    it('renders the Ethereum option', async () => {
      await renderScreen();
      expect(screen.getByText('Ethereum')).toBeTruthy();
    });

    it('explains the extended public key and its privacy caveat', async () => {
      await renderScreen();
      expect(screen.getByText(/extended public key \(xpub\)/)).toBeTruthy();
      expect(screen.getByText(/cannot spend/)).toBeTruthy();
    });

    it('does not show the xpub notice when it was previously dismissed', async () => {
      storedPreferences(true);
      await renderScreen();
      expect(screen.queryByText(/extended public key \(xpub\)/)).toBeNull();
    });

    it('hides the xpub notice and persists dismissal when the close button is pressed', async () => {
      await renderScreen();

      await act(async () => {
        fireEvent.press(screen.getByTestId('xpub-notice-close'));
      });

      expect(screen.queryByText(/extended public key \(xpub\)/)).toBeNull();
      expect(mockSavePreference).toHaveBeenCalledWith(
        'xpubNoticeDismissed',
        true,
      );
    });

    it('shows the NFC indicator for every export option', async () => {
      await renderScreen();

      for (const index of [0, 1, 2, 3, 4, 5, 6]) {
        expect(screen.getByTestId(`menu-nfc-indicator-${index}`)).toBeTruthy();
      }
    });

    // Each target carries its own icon, so the screen stays generic over the
    // table rather than mapping ids to icons itself.
    it('shows a leading icon for every export option', async () => {
      await renderScreen();

      for (const index of [0, 1, 2, 3, 4, 5, 6]) {
        expect(screen.getByTestId(`menu-icon-${index}`)).toBeTruthy();
      }
    });
  });

  describe('navigation', () => {
    it('navigates to Keycard with export_key operation when Ethereum is pressed', async () => {
      await renderScreen();
      fireEvent.press(screen.getByText('Ethereum'));
      expect(navigation.navigate).toHaveBeenCalledWith('Keycard', {
        operation: 'export_key',
        target: 'ethereum',
      });
    });

    it('navigates to Keycard with the bitcoin target when Bitcoin is pressed', async () => {
      await renderScreen();
      fireEvent.press(screen.getByText('Bitcoin'));
      expect(navigation.navigate).toHaveBeenCalledWith('Keycard', {
        operation: 'export_key',
        target: 'bitcoin',
      });
    });

    it('navigates to Keycard with the bitcoin-multisig target when Bitcoin Multisig is pressed', async () => {
      await renderScreen();
      fireEvent.press(screen.getByText('Bitcoin Multisig'));
      expect(navigation.navigate).toHaveBeenCalledWith('Keycard', {
        operation: 'export_key',
        target: 'bitcoin-multisig',
      });
    });

    it('navigates to Keycard with the bitcoin-testnet target when Bitcoin Testnet is pressed', async () => {
      await renderScreen();
      fireEvent.press(screen.getByText('Bitcoin Testnet'));
      expect(navigation.navigate).toHaveBeenCalledWith('Keycard', {
        operation: 'export_key',
        target: 'bitcoin-testnet',
      });
    });

    it('navigates to Keycard with the ledger-live target when Ledger Live is pressed', async () => {
      await renderScreen();
      fireEvent.press(screen.getByText('Ledger Live'));
      expect(navigation.navigate).toHaveBeenCalledWith('Keycard', {
        operation: 'export_key',
        target: 'ledger-live',
      });
    });

    it('navigates to Keycard with the ledger-legacy target when Ledger Legacy is pressed', async () => {
      await renderScreen();
      fireEvent.press(screen.getByText('Ledger Legacy'));
      expect(navigation.navigate).toHaveBeenCalledWith('Keycard', {
        operation: 'export_key',
        target: 'ledger-legacy',
      });
    });

    it('navigates to Keycard with the bitget target when Bitget is pressed', async () => {
      await renderScreen();
      fireEvent.press(screen.getByText('Bitget'));
      expect(navigation.navigate).toHaveBeenCalledWith('Keycard', {
        operation: 'export_key',
        target: 'bitget',
      });
    });
  });

  describe('dashboardEntry', () => {
    it('has label "Connect software wallet"', () => {
      expect(dashboardEntry.label).toBe('Connect software wallet');
    });

    it('calls navigation.navigate("ExportKey") when invoked', () => {
      const nav = { navigate: jest.fn() } as any;
      dashboardEntry.navigate(nav);
      expect(nav.navigate).toHaveBeenCalledWith('ExportKey');
    });
  });
});
