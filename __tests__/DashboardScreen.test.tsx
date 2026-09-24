import React, { act } from 'react';
import { AppState, Platform, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import DashboardScreen from '../src/screens/DashboardScreen';
import { BUY_KEYCARD_LABEL } from '../src/constants/purchaseLink';
import {
  noteTappedGeneration,
  resetLastTappedGeneration,
} from '../src/utils/lastTappedGeneration';

import { testPreferences as mockTestPreferences } from './preferences.testUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

let lastSnackDuration: number | undefined;

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return {
    MD3DarkTheme: { colors: {} },
    Text,
    Snackbar: ({ visible, children, duration }: any) => {
      lastSnackDuration = duration;
      return visible
        ? require('react').createElement(Text, null, children)
        : null;
    },
  };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

let mockLayout: 'tiles' | 'list' = 'tiles';
let mockGenerationsInUse: ('3.1' | '4.0')[] = ['3.1', '4.0'];

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: mockTestPreferences({
      dashboardLayout: mockLayout,
      generationsInUse: mockGenerationsInUse,
      generationRemindersDismissed: [],
    }),
    setPreference: jest.fn(),
  }),
}));

// Capture the useFocusEffect callback so tests can fire focus events.
let focusCallback: (() => void) | null = null;
const mockUseNavigationNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    focusCallback = cb;
  },
  useNavigation: () => ({ navigate: mockUseNavigationNavigate }),
}));

type MockAction = {
  label: string;
  detail?: string;
  icon: React.ComponentType<any>;
  navigate: (nav: any) => void;
};

const mockDashboardActions: MockAction[] = [];

// Forwards props, so the icon carries its testID.
const Icon = (props: any) => <View {...props} />;

function action(
  label: string,
  navigate: (nav: any) => void = jest.fn(),
  detail?: string,
): MockAction {
  return { label, detail, icon: Icon, navigate };
}

jest.mock('../src/navigation/dashboardActions', () => ({
  get dashboardActions() {
    return mockDashboardActions;
  },
}));

jest.mock(
  '../src/components/walletConnect/DashboardCard.online',
  () => () => null,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = {
  navigate: jest.fn(),
  setParams: jest.fn(),
} as any;

// AppState.currentState is a jest.fn() in the preset, so set it explicitly.
function setAppState(state: 'active' | 'inactive' | 'background') {
  (AppState as any).currentState = state;
}

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
    mockUseNavigationNavigate.mockClear();
    mockDashboardActions.length = 0;
    focusCallback = null;
    mockLayout = 'tiles';
    mockGenerationsInUse = ['3.1', '4.0'];
    resetLastTappedGeneration();
    // mockImplementation alone leaves call history from earlier tests in place.
    (AppState.addEventListener as jest.Mock).mockClear();
    setAppState('active');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('static layout', () => {
    it('renders the Scan button', async () => {
      await renderScreen();
      expect(screen.getByText('Scan')).toBeTruthy();
    });

    it('renders one fewer pressable when action list is empty', async () => {
      mockDashboardActions.push(action('Sentinel'));
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
      mockDashboardActions.push(action('Action One'), action('Action Two'));
      await renderScreen();
      expect(screen.getByText('Action One')).toBeTruthy();
      expect(screen.getByText('Action Two')).toBeTruthy();
    });

    it('calls the action navigate when an item is pressed', async () => {
      const mockNavigate = jest.fn();
      mockDashboardActions.push(action('Test Action', mockNavigate));
      await renderScreen();
      fireEvent.press(screen.getByText('Test Action'));
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith(navigation);
    });

    it('only calls the pressed action, not others', async () => {
      const mockFirst = jest.fn();
      const mockSecond = jest.fn();
      mockDashboardActions.push(
        action('First', mockFirst),
        action('Second', mockSecond),
      );
      await renderScreen();
      fireEvent.press(screen.getByText('Second'));
      expect(mockSecond).toHaveBeenCalledTimes(1);
      expect(mockFirst).not.toHaveBeenCalled();
    });
  });

  // An odd count promotes the first entry to a hero tile.
  describe('tile grid', () => {
    it('renders the first entry as a hero tile when the count is odd', async () => {
      mockDashboardActions.push(
        action('One', jest.fn(), 'Hero detail'),
        action('Two'),
        action('Three'),
      );
      await renderScreen();
      expect(screen.getByTestId('tile-hero')).toBeTruthy();
      expect(screen.getByTestId('tile-0')).toBeTruthy();
      expect(screen.getByTestId('tile-1')).toBeTruthy();
      expect(screen.queryByTestId('tile-2')).toBeNull();
    });

    it('renders only standard tiles when the count is even', async () => {
      mockDashboardActions.push(action('One'), action('Two'));
      await renderScreen();
      expect(screen.queryByTestId('tile-hero')).toBeNull();
      expect(screen.getByTestId('tile-0')).toBeTruthy();
      expect(screen.getByTestId('tile-1')).toBeTruthy();
    });

    it('shows the detail line on the hero tile only', async () => {
      mockDashboardActions.push(
        action('One', jest.fn(), 'Hero detail'),
        action('Two', jest.fn(), 'Standard detail'),
        action('Three'),
      );
      await renderScreen();
      expect(screen.getByText('Hero detail')).toBeTruthy();
      expect(screen.queryByText('Standard detail')).toBeNull();
    });
  });

  // The reminder is mounted only here.
  describe('unselected Keycard reminder', () => {
    it('shows after a tap of a card the user left unticked', async () => {
      mockGenerationsInUse = ['4.0'];
      noteTappedGeneration('3.1');
      await renderScreen();
      expect(screen.getByTestId('unselected-keycard-reminder')).toBeTruthy();
    });

    it('stays away while the tapped card is one the user ticked', async () => {
      noteTappedGeneration('3.1');
      await renderScreen();
      expect(screen.queryByTestId('unselected-keycard-reminder')).toBeNull();
    });
  });

  describe('layout preference', () => {
    it('renders the list instead of tiles when the preference says list', async () => {
      mockLayout = 'list';
      mockDashboardActions.push(action('One'), action('Two'));
      await renderScreen();
      expect(screen.queryByTestId('tile-grid')).toBeNull();
      expect(screen.getByTestId('menu-icon-0')).toBeTruthy();
      expect(screen.getByText('One')).toBeTruthy();
    });

    it('renders tiles when the preference says tiles', async () => {
      mockLayout = 'tiles';
      mockDashboardActions.push(action('One'), action('Two'));
      await renderScreen();
      expect(screen.getByTestId('tile-grid')).toBeTruthy();
      expect(screen.queryByTestId('menu-icon-0')).toBeNull();
    });
  });

  describe('navigation', () => {
    it('navigates to QRScanner when Scan is pressed', async () => {
      await renderScreen();
      fireEvent.press(screen.getByText('Scan'));
      expect(navigation.navigate).toHaveBeenCalledWith('QRScanner');
    });

    it('does not call navigation.navigate when an action item is pressed', async () => {
      mockDashboardActions.push(action('Some Action'));
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

  // The toast outlasts Apple's NFC sheet, which covers it for about 3.4 s.
  describe('toast vs the iOS NFC sheet', () => {
    const origOS = Platform.OS;

    afterEach(() => {
      Platform.OS = origOS;
    });

    it('outlasts the NFC sheet on iOS', async () => {
      Platform.OS = 'ios';
      await renderScreen({ toast: 'Card name updated' });
      await act(async () => {
        focusCallback?.();
      });
      expect(lastSnackDuration).toBe(7000);
    });

    it('keeps the default duration on Android, which has no system sheet', async () => {
      Platform.OS = 'android';
      await renderScreen({ toast: 'Card name updated' });
      await act(async () => {
        focusCallback?.();
      });
      expect(lastSnackDuration).toBe(3000);
    });

    // Regression: waiting for AppState 'active' showed the toast late, into an empty screen.
    it('shows immediately rather than waiting for the app to become active', async () => {
      Platform.OS = 'ios';
      setAppState('inactive');
      await renderScreen({ toast: 'Card name updated' });
      await act(async () => {
        focusCallback?.();
      });
      expect(screen.getByText('Card name updated')).toBeTruthy();
      expect(AppState.addEventListener).not.toHaveBeenCalled();
    });
  });

  it('does not render the buy-Keycard notice', async () => {
    await renderScreen();
    expect(screen.queryByText('Keycard required')).toBeNull();
    expect(screen.queryByText(BUY_KEYCARD_LABEL)).toBeNull();
  });
});
