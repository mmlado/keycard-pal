import React, { act } from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import DashboardScreen from '../src/screens/DashboardScreen';

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
    Snackbar: ({ visible, children }: any) =>
      visible ? require('react').createElement(Text, null, children) : null,
  };
});

jest.mock('../src/assets/icons', () => {
  const { View } = require('react-native');
  const Icon = (props: any) => <View {...props} />;
  return {
    Icons: {
      chevronRight: Icon,
      close: Icon,
      nfcActivate: Icon,
      openInBrowser: Icon,
      qr: Icon,
      scan: Icon,
    },
  };
});

// Capture the useFocusEffect callback so tests can fire focus events.
let focusCallback: (() => void) | null = null;
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    focusCallback = cb;
  },
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const mockDashboardActions: { label: string; navigate: (nav: any) => void }[] =
  [];

jest.mock('../src/navigation/dashboardActions', () => ({
  get dashboardActions() {
    return mockDashboardActions;
  },
}));

const mockLoadBooleanPreference = jest.fn();
const mockSaveBooleanPreference = jest.fn();

jest.mock('../src/storage/preferencesStorage', () => ({
  loadDashboardKeycardNoticeDismissed: (...args: any[]) =>
    mockLoadBooleanPreference(...args),
  saveDashboardKeycardNoticeDismissed: (...args: any[]) =>
    mockSaveBooleanPreference(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = {
  navigate: jest.fn(),
  setParams: jest.fn(),
} as any;

async function renderScreen(routeParams?: { toast?: string }) {
  focusCallback = null;
  const route = routeParams ? { params: routeParams } : ({} as any);
  const view = render(
    <DashboardScreen navigation={navigation} route={route as any} />,
  );
  await act(async () => {});
  return view;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardScreen', () => {
  beforeEach(() => {
    navigation.navigate.mockClear();
    navigation.setParams.mockClear();
    mockDashboardActions.length = 0;
    mockLoadBooleanPreference.mockReset();
    mockSaveBooleanPreference.mockReset();
    mockLoadBooleanPreference.mockResolvedValue(true);
    mockSaveBooleanPreference.mockResolvedValue(undefined);
    focusCallback = null;
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('static layout', () => {
    it('renders the Scan transaction button', async () => {
      await renderScreen();
      expect(screen.getByText('Scan transaction')).toBeTruthy();
    });

    it('renders one fewer pressable when action list is empty', async () => {
      mockDashboardActions.push({ label: 'Sentinel', navigate: jest.fn() });
      await renderScreen();
      expect(screen.getByText('Sentinel')).toBeTruthy();

      mockDashboardActions.length = 0;
      screen.unmount();
      await renderScreen();
      expect(screen.queryByText('Sentinel')).toBeNull();
    });
  });

  describe('action list', () => {
    it('renders items with their labels', async () => {
      mockDashboardActions.push(
        { label: 'Action One', navigate: jest.fn() },
        { label: 'Action Two', navigate: jest.fn() },
      );
      await renderScreen();
      expect(screen.getByText('Action One')).toBeTruthy();
      expect(screen.getByText('Action Two')).toBeTruthy();
    });

    it('calls the action navigate when an item is pressed', async () => {
      const mockNavigate = jest.fn();
      mockDashboardActions.push({
        label: 'Test Action',
        navigate: mockNavigate,
      });
      await renderScreen();
      fireEvent.press(screen.getByText('Test Action'));
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith(navigation);
    });

    it('only calls the pressed action, not others', async () => {
      const mockFirst = jest.fn();
      const mockSecond = jest.fn();
      mockDashboardActions.push(
        { label: 'First', navigate: mockFirst },
        { label: 'Second', navigate: mockSecond },
      );
      await renderScreen();
      fireEvent.press(screen.getByText('Second'));
      expect(mockSecond).toHaveBeenCalledTimes(1);
      expect(mockFirst).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('navigates to QRScanner when Scan transaction is pressed', async () => {
      await renderScreen();
      fireEvent.press(screen.getByText('Scan transaction'));
      expect(navigation.navigate).toHaveBeenCalledWith('QRScanner');
    });

    it('does not call navigation.navigate when an action item is pressed', async () => {
      mockDashboardActions.push({ label: 'Some Action', navigate: jest.fn() });
      await renderScreen();
      fireEvent.press(screen.getByText('Some Action'));
      expect(navigation.navigate).not.toHaveBeenCalled();
    });
  });

  describe('toast / snackbar', () => {
    it('shows the snackbar with the toast message when the screen is focused', async () => {
      await renderScreen({ toast: 'Card initialized' });
      await act(async () => {
        focusCallback?.();
      });
      expect(screen.getByText('Card initialized')).toBeTruthy();
    });

    it('clears the toast param after showing the snackbar', async () => {
      await renderScreen({ toast: 'Card initialized' });
      await act(async () => {
        focusCallback?.();
      });
      expect(navigation.setParams).toHaveBeenCalledWith({ toast: undefined });
    });

    it('does not show the snackbar when there is no toast param', async () => {
      await renderScreen();
      await act(async () => {
        focusCallback?.();
      });
      expect(navigation.setParams).not.toHaveBeenCalled();
      expect(screen.queryByText('Card initialized')).toBeNull();
    });
  });

  describe('keycard notice', () => {
    it('shows the notice when it has not been dismissed', async () => {
      mockLoadBooleanPreference.mockResolvedValue(false);
      await renderScreen();

      expect(screen.getByText('Keycard required')).toBeTruthy();
      expect(screen.getByText('Buy a Keycard')).toBeTruthy();
      expect(screen.getByText(/ShellSummer9746/)).toBeTruthy();
    });

    it('hides the notice when it was already dismissed', async () => {
      await renderScreen();
      expect(screen.queryByText('Keycard required')).toBeNull();
    });

    it('opens the purchase link in the browser', async () => {
      mockLoadBooleanPreference.mockResolvedValue(false);
      await renderScreen();

      fireEvent.press(screen.getByTestId('dashboard-keycard-purchase-link'));

      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://get.keycard.tech/vuxxnf',
      );
    });

    it('dismisses the notice and remembers that choice', async () => {
      mockLoadBooleanPreference.mockResolvedValue(false);
      await renderScreen();

      await act(async () => {
        fireEvent.press(screen.getByTestId('dashboard-keycard-notice-close'));
      });

      expect(mockSaveBooleanPreference).toHaveBeenCalledWith(true);
      expect(screen.queryByText('Keycard required')).toBeNull();
    });

    it('hides the notice when load rejects', async () => {
      mockLoadBooleanPreference.mockRejectedValue(new Error('storage error'));
      await renderScreen();
      expect(screen.queryByText('Keycard required')).toBeNull();
    });

    it('dismisses the notice even when save rejects', async () => {
      mockLoadBooleanPreference.mockResolvedValue(false);
      mockSaveBooleanPreference.mockRejectedValue(new Error('storage error'));
      await renderScreen();

      await act(async () => {
        fireEvent.press(screen.getByTestId('dashboard-keycard-notice-close'));
      });

      expect(screen.queryByText('Keycard required')).toBeNull();
    });
  });
});
