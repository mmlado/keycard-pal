import React from 'react';
import { Linking, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen, { dashboardEntry } from '../src/screens/SettingsScreen';

// ---------------------------------------------------------------------------
// Mocks — every other section is a stub so this test only proves the screen
// mounts the Keycard purchase section in both build flavors.
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => {
  const { View } = require('react-native');
  const Icon = (props: any) => <View {...props} />;
  return { Icons: { openInBrowser: Icon, qr: Icon } };
});

jest.mock('../src/components/settings/DashboardLayoutSettingsSection', () => {
  const { Text } = require('react-native');
  return () => <Text>Layout</Text>;
});

jest.mock(
  '../src/components/settings/ens/EnsSettingsSection.online',
  () => () => null,
);
jest.mock('../src/components/settings/PinPadSettingsSection', () => () => null);
jest.mock(
  '../src/components/settings/tenderly/TenderlySettingsSection.online',
  () => () => null,
);
jest.mock(
  '../src/components/settings/TokenImagesSettingsSection.online',
  () => () => null,
);
jest.mock(
  '../src/components/settings/WalletConnectSettingsSection.online',
  () => () => null,
);

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

const navigation = { setOptions: jest.fn() } as any;

function renderScreen() {
  return render(<SettingsScreen navigation={navigation} route={{} as any} />);
}

async function pressBuy() {
  await act(async () => {
    fireEvent.press(screen.getByText('Buy a Keycard'));
  });
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    navigation.setOptions.mockClear();
    mockConnected = true;
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    (Linking.openURL as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sets the header title', () => {
    renderScreen();
    expect(navigation.setOptions).toHaveBeenCalledWith({ title: 'Settings' });
  });

  // The purchase link is the one section that always stays at the top; every
  // other section is added below it.
  it('keeps Buy a Keycard above the layout section', () => {
    const { toJSON } = renderScreen();
    const rendered = JSON.stringify(toJSON());
    // Both have to be present, or a missing section would make indexOf return
    // -1 and the ordering assertion would pass for the wrong reason.
    expect(rendered).toContain('Buy a Keycard');
    expect(rendered).toContain('Layout');
    expect(rendered.indexOf('Buy a Keycard')).toBeLessThan(
      rendered.indexOf('Layout'),
    );
  });

  it('renders on Android with the height keyboard behaviour', () => {
    const origOS = Platform.OS;
    Platform.OS = 'android';
    try {
      renderScreen();
      expect(screen.getByText('Buy a Keycard')).toBeTruthy();
    } finally {
      Platform.OS = origOS;
    }
  });

  it('exposes a dashboard entry that opens Settings', () => {
    const nav = { navigate: jest.fn() } as any;
    dashboardEntry.navigate(nav);
    expect(nav.navigate).toHaveBeenCalledWith('Settings');
    expect(dashboardEntry.label).toBe('Settings');
  });

  it('offers the Keycard purchase link in the browser when there is a network', async () => {
    renderScreen();
    await pressBuy();
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://get.keycard.tech/vuxxnf',
    );
  });

  it('offers the Keycard purchase link as a QR code without a network (always in the offline build)', async () => {
    mockConnected = false;
    renderScreen();
    await pressBuy();
    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: 'https://get.keycard.tech/vuxxnf',
      title: 'Buy a Keycard',
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
