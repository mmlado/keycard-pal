import React from 'react';
import { Linking, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen, { dashboardEntry } from '../src/screens/SettingsScreen';
import {
  AFFILIATE_DISCLOSURE,
  BUY_KEYCARD_LABEL,
  KEYCARD_PURCHASE_URL,
} from '../src/constants/keycard';

import { testPreferences as mockTestPreferences } from './preferences.testUtils';

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

// Stubbed like every other section, but it keeps its two props: they are how
// the screen's tap reaches it.
jest.mock('../src/components/settings/KeycardsInUseSettingsSection', () => {
  const { Text } = require('react-native');
  return ({
    onSetFromCard,
    readingCard,
  }: {
    onSetFromCard: () => void;
    readingCard: boolean;
  }) => (
    <Text onPress={onSetFromCard}>
      {readingCard ? 'Reading card' : 'Set from my Keycard'}
    </Text>
  );
});

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// One object for the life of the file. The real provider hands out a stable
// setPreference, and a fresh one per render would re-run the screen's effect on
// every render, hiding whether it is keyed on the tap finishing.
const mockSetPreference = jest.fn();
const mockPreferencesValue = {
  preferences: mockTestPreferences(),
  setPreference: (...args: unknown[]) => mockSetPreference(...args),
};
jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => mockPreferencesValue,
}));

const mockResetLastTapped = jest.fn();
jest.mock('../src/utils/lastTappedGeneration', () => ({
  resetLastTappedGeneration: () => mockResetLastTapped(),
}));

const mockIdentifyStart = jest.fn();
const mockIdentifyCancel = jest.fn();
let mockIdentify: {
  phase: 'idle' | 'nfc' | 'done' | 'error';
  generation: '3.1' | '4.0' | null;
};

jest.mock('../src/hooks/keycard/useIdentifyCard', () => ({
  useIdentifyCard: () => ({
    phase: mockIdentify.phase,
    status: '',
    cardPresence: 'waiting',
    generation: mockIdentify.generation,
    start: mockIdentifyStart,
    retry: mockIdentifyStart,
    cancel: mockIdentifyCancel,
    openNFCSettings: undefined,
  }),
}));

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

const navigation = {
  setOptions: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
} as any;

const MockNFCBottomSheet = jest.requireMock('../src/components/NFCBottomSheet');

function lastSheetProps() {
  const calls = MockNFCBottomSheet.mock.calls;
  return calls[calls.length - 1][0];
}

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
    navigation.navigate.mockClear();
    navigation.goBack.mockClear();
    mockSetPreference.mockClear();
    mockResetLastTapped.mockClear();
    mockIdentifyStart.mockClear();
    mockIdentifyCancel.mockClear();
    MockNFCBottomSheet.mockClear();
    mockIdentify = { phase: 'idle', generation: null };
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
    expect(screen.getByTestId('affiliate-disclosure')).toBeTruthy();
  });

  // For the user who would rather tap a card than read applet versions.
  describe('set from my Keycard', () => {
    it('starts a read of the card from the section', () => {
      renderScreen();
      fireEvent.press(screen.getByText('Set from my Keycard'));
      expect(mockIdentifyStart).toHaveBeenCalledTimes(1);
    });

    it('tells the section while a card is being read', () => {
      mockIdentify = { phase: 'nfc', generation: null };
      renderScreen();
      expect(screen.getByText('Reading card')).toBeTruthy();
    });

    // "Buy a Keycard" is the first row of this very screen, and the user stays
    // here on cancel, so the sheet does not repeat the shop link.
    it('keeps the shop link off its NFC sheet', () => {
      mockIdentify = { phase: 'nfc', generation: null };
      renderScreen();
      expect(lastSheetProps().hideNoCardExit).toBe(true);
    });

    it('gives the NFC sheet the read', () => {
      mockIdentify = { phase: 'nfc', generation: null };
      renderScreen();
      expect(lastSheetProps().nfc.phase).toBe('nfc');
      expect(lastSheetProps().nfc.retry).toBe(mockIdentifyStart);
    });

    it('ticks only the generation of the card that was read', () => {
      mockIdentify = { phase: 'done', generation: '3.1' };
      renderScreen();
      expect(mockSetPreference).toHaveBeenCalledWith('generationsInUse', [
        '3.1',
      ]);
    });

    // A plain re-render at 'done' must not write again: the selection may
    // have been changed by hand since, and this would silently undo that.
    it('does not narrow again on a re-render with nothing new', () => {
      mockIdentify = { phase: 'done', generation: '3.1' };
      const view = renderScreen();
      mockSetPreference.mockClear();
      view.rerender(
        <SettingsScreen navigation={navigation} route={{} as any} />,
      );
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    // The tap was the user setting the selection, so it must not come back
    // as a dashboard reminder about that same card.
    it('leaves no reminder behind for the dashboard', () => {
      mockIdentify = { phase: 'done', generation: '3.1' };
      renderScreen();
      expect(mockResetLastTapped).toHaveBeenCalledTimes(1);
    });

    it('changes nothing until a card has been read', () => {
      mockIdentify = { phase: 'nfc', generation: null };
      renderScreen();
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    // Reading a second card of the same generation has to narrow the
    // selection again, though the generation it found has not changed.
    it('narrows again when another card of the same generation is read', () => {
      mockIdentify = { phase: 'done', generation: '3.1' };
      const view = renderScreen();
      mockSetPreference.mockClear();

      mockIdentify = { phase: 'nfc', generation: '3.1' };
      view.rerender(
        <SettingsScreen navigation={navigation} route={{} as any} />,
      );
      expect(mockSetPreference).not.toHaveBeenCalled();

      mockIdentify = { phase: 'done', generation: '3.1' };
      view.rerender(
        <SettingsScreen navigation={navigation} route={{} as any} />,
      );
      expect(mockSetPreference).toHaveBeenCalledWith('generationsInUse', [
        '3.1',
      ]);
    });

    // The user is in Settings to change settings; cancelling a read is not a
    // reason to leave, and a finished one has nowhere to go either.
    it('stays in Settings when the read is cancelled', () => {
      mockIdentify = { phase: 'nfc', generation: null };
      renderScreen();
      lastSheetProps().onCancel();
      expect(mockIdentifyCancel).toHaveBeenCalledTimes(1);
      expect(navigation.goBack).not.toHaveBeenCalled();
    });
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
    expect(Linking.openURL).toHaveBeenCalledWith(KEYCARD_PURCHASE_URL);
  });

  it('offers the Keycard purchase link as a QR code without a network (always in the offline build)', async () => {
    mockConnected = false;
    renderScreen();
    await pressBuy();
    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: KEYCARD_PURCHASE_URL,
      title: BUY_KEYCARD_LABEL,
      note: AFFILIATE_DISCLOSURE,
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
