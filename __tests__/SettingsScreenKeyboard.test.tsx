import React from 'react';
import { Keyboard, ScrollView } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';

import SettingsScreen from '../src/screens/SettingsScreen';

import { testPreferences as mockTestPreferences } from './preferences.testUtils';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// The screen is rendered outside a navigator, where the real hook throws.
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 64 }));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

jest.mock('../src/components/NFCBottomSheet', () => () => null);
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));

jest.mock(
  '../src/components/settings/KeycardsInUseSettingsSection',
  () => () => null,
);
jest.mock(
  '../src/components/settings/DashboardLayoutSettingsSection',
  () => () => null,
);
jest.mock('../src/components/settings/PinPadSettingsSection', () => () => null);
jest.mock(
  '../src/components/settings/ens/EnsSettingsSection.online',
  () => () => null,
);
jest.mock(
  '../src/components/settings/TokenImagesSettingsSection.online',
  () => () => null,
);
jest.mock(
  '../src/components/settings/tenderly/TenderlySettingsSection.online',
  () => () => null,
);

// Stands in for a settings section holding a field: it hands the screen's
// handler out so the test can drive focus without a real TextInput.
let onFieldFocus: ((field: unknown) => void) | null = null;
jest.mock(
  '../src/components/settings/WalletConnectSettingsSection.online',
  () => {
    const {
      useFieldFocus: useFocus,
    } = require('../src/components/settings/fieldFocus');
    return () => {
      onFieldFocus = useFocus();
      return null;
    };
  },
);

const mockPreferencesValue = {
  preferences: mockTestPreferences(),
  setPreference: jest.fn(),
};
jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => mockPreferencesValue,
}));

jest.mock('../src/utils/lastTappedGeneration', () => ({
  resetLastTappedGeneration: jest.fn(),
}));

jest.mock('../src/hooks/keycard/useIdentifyCard', () => ({
  useIdentifyCard: () => ({
    phase: 'idle',
    status: '',
    cardPresence: 'waiting',
    generation: null,
    start: jest.fn(),
    retry: jest.fn(),
    cancel: jest.fn(),
    openNFCSettings: undefined,
  }),
}));

jest.mock('../src/utils/connectivity.online', () => ({
  getNetworkConnected: () => true,
  subscribeNetworkConnected: () => () => {},
  isNetworkConnected: () => Promise.resolve(true),
}));

jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: { isReady: () => true, navigate: jest.fn() },
}));

const navigation = {
  setOptions: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
} as any;

/** A field at `y` of height `height`, with the measure callback under our control. */
function fakeField(y: number, height = 120) {
  return {
    measureInWindow: (
      cb: (x: number, y: number, w: number, h: number) => void,
    ) => cb(0, y, 300, height),
  };
}

function renderScreen() {
  const view = render(
    <SettingsScreen navigation={navigation} route={{} as any} />,
  );
  const scrollView = screen.UNSAFE_getByType(ScrollView);
  const scrollTo = jest.fn();
  // The screen holds this instance by ref, so replacing the method intercepts it.
  (scrollView.instance as any).scrollTo = scrollTo;
  return { ...view, scrollView, scrollTo };
}

// The screen picks its event names by platform, so the test drives whichever it
// registered rather than guessing.
let listeners: Record<string, (event: any) => void> = {};
let added: string[] = [];
let removed: string[] = [];

function showKeyboard(screenY: number) {
  act(() => {
    listeners.keyboardWillShow?.({ endCoordinates: { screenY } });
    listeners.keyboardDidShow?.({ endCoordinates: { screenY } });
  });
}

function hideKeyboard() {
  act(() => {
    listeners.keyboardWillHide?.({});
    listeners.keyboardDidHide?.({});
  });
}

function scrollBy(scrollView: any, y: number) {
  act(() => {
    scrollView.props.onScroll({ nativeEvent: { contentOffset: { y } } });
  });
}

beforeEach(() => {
  onFieldFocus = null;
  listeners = {};
  added = [];
  removed = [];
  jest.clearAllMocks();
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    event: string,
    handler: (e: any) => void,
  ) => {
    listeners[event] = handler;
    added.push(event);
    return { remove: () => removed.push(event) };
  }) as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SettingsScreen, keeping a focused field above the keyboard', () => {
  it('scrolls a field the keyboard would cover, by exactly the hidden amount', () => {
    const { scrollView, scrollTo } = renderScreen();
    showKeyboard(1000);
    scrollBy(scrollView, 200);

    // Field ends at 1020, plus the 16px gap, against a keyboard top of 1000.
    act(() => onFieldFocus!(fakeField(900)));

    expect(scrollTo).toHaveBeenCalledWith({ y: 236, animated: true });
  });

  it('leaves a field the keyboard does not reach alone', () => {
    const { scrollView, scrollTo } = renderScreen();
    showKeyboard(1000);
    scrollBy(scrollView, 200);

    act(() => onFieldFocus!(fakeField(100)));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does nothing while the keyboard is down', () => {
    const { scrollTo } = renderScreen();

    act(() => onFieldFocus!(fakeField(900)));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('stops scrolling once the keyboard is dismissed', () => {
    const { scrollTo } = renderScreen();
    showKeyboard(1000);
    hideKeyboard();

    act(() => onFieldFocus!(fakeField(900)));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('ignores a blur, which hands back no field', () => {
    const { scrollTo } = renderScreen();
    showKeyboard(1000);

    act(() => onFieldFocus!(null));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  // The keyboard shrinks the ScrollView, and only then is there a viewport to
  // scroll the field into, so layout has to retry the last focused field.
  it('retries on layout, which is when the shrunk viewport exists', () => {
    const { scrollView, scrollTo } = renderScreen();
    showKeyboard(1000);
    act(() => onFieldFocus!(fakeField(900)));
    scrollTo.mockClear();

    act(() => scrollView.props.onLayout());

    expect(scrollTo).toHaveBeenCalledWith({ y: 36, animated: true });
  });

  it('measures from the current scroll offset', () => {
    const { scrollView, scrollTo } = renderScreen();
    showKeyboard(1000);
    scrollBy(scrollView, 500);

    act(() => onFieldFocus!(fakeField(900)));

    expect(scrollTo).toHaveBeenCalledWith({ y: 536, animated: true });
  });

  it('drops every keyboard listener it added when the screen goes', () => {
    const { unmount } = renderScreen();
    expect(Object.keys(listeners)).toHaveLength(2);

    unmount();

    expect(removed.sort()).toEqual(added.sort());
  });
});
