import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AppletVersionSettingsSection from '../src/components/settings/AppletVersionSettingsSection';
import DashboardLayoutSettingsSection from '../src/components/settings/DashboardLayoutSettingsSection';
import PinPadSettingsSection from '../src/components/settings/PinPadSettingsSection';
import TokenImagesSettingsSection from '../src/components/settings/TokenImagesSettingsSection.online';
import { usePreferences } from '../src/hooks/usePreferences';
import useTokenImagesEnabled from '../src/hooks/useTokenImagesEnabled.online';
import { PreferencesProvider } from '../src/providers/preferences/Provider';
import MinAppletVersionScreen from '../src/screens/MinAppletVersionScreen';
import SecretsMenuScreen from '../src/screens/secrets/SecretsMenuScreen';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Nothing between the settings rows and the bytes is mocked: the real
// provider and the real storage module run against an in-memory
// AsyncStorage, so this proves a toggle both lands in storage and reaches
// every other consumer. (The package's own Jest mock is ESM-only.)
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        store.set(key, value);
      },
      getMany: async (keys: string[]) =>
        Object.fromEntries(keys.map(key => [key, store.get(key) ?? null])),
      clear: async () => store.clear(),
    },
  };
});

jest.mock('react-native-paper', () => {
  const { Text: RNText, Switch } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text: RNText, Switch };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AsyncStorage = jest.requireMock(
  '@react-native-async-storage/async-storage',
).default;

/** A consumer elsewhere in the tree, the way PinPad or a menu screen is. */
function Probe() {
  const { preferences } = usePreferences();
  const images = useTokenImagesEnabled();
  return (
    <Text>
      {`layout:${preferences.dashboardLayout} scramble:${preferences.pinPadScramble} images:${images}`}
    </Text>
  );
}

/** Its own line, so the existing assertions keep reading one string. */
function GenerationProbe() {
  const { preferences } = usePreferences();
  return <Text>{`generation:${preferences.minGeneration}`}</Text>;
}

const pickerNavigation = { goBack: jest.fn() } as any;

/**
 * The picker screen beside the Settings row that shows its value, the two
 * ends of the one preference that is chosen on a screen of its own.
 */
async function renderAppletVersion() {
  const view = render(
    <PreferencesProvider>
      <AppletVersionSettingsSection onPress={jest.fn()} />
      <MinAppletVersionScreen
        navigation={pickerNavigation}
        route={{ key: 'MinAppletVersion', name: 'MinAppletVersion' } as any}
      />
      <GenerationProbe />
    </PreferencesProvider>,
  );
  await act(async () => {});
  return view;
}

async function renderSettings() {
  const view = render(
    <PreferencesProvider>
      <PinPadSettingsSection />
      <TokenImagesSettingsSection />
      <DashboardLayoutSettingsSection />
      <Probe />
    </PreferencesProvider>,
  );
  await act(async () => {});
  return view;
}

// Switches in render order: PIN pad scramble, then token images.
function scrambleSwitch() {
  return screen.getAllByRole('switch')[0];
}

function imagesSwitch() {
  return screen.getAllByRole('switch')[1];
}

async function flush() {
  await act(async () => {});
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('changing a setting', () => {
  it('starts from the defaults when nothing is stored', async () => {
    await renderSettings();
    expect(
      screen.getByText('layout:tiles scramble:false images:false'),
    ).toBeTruthy();
  });

  it('writes the PIN pad scramble and updates every consumer', async () => {
    await renderSettings();

    await act(async () => {
      fireEvent(scrambleSwitch(), 'valueChange', true);
    });
    await flush();

    expect(scrambleSwitch().props.value).toBe(true);
    expect(
      screen.getByText('layout:tiles scramble:true images:false'),
    ).toBeTruthy();
    expect(await AsyncStorage.getItem('preference_pinpad_scramble')).toBe('1');
  });

  it('writes the token images opt-in and updates useTokenImagesEnabled', async () => {
    await renderSettings();

    await act(async () => {
      fireEvent(imagesSwitch(), 'valueChange', true);
    });
    await flush();

    expect(imagesSwitch().props.value).toBe(true);
    expect(
      screen.getByText('layout:tiles scramble:false images:true'),
    ).toBeTruthy();
    expect(await AsyncStorage.getItem('preference_token_images_enabled')).toBe(
      '1',
    );
  });

  it('writes the layout and updates every consumer', async () => {
    await renderSettings();

    await act(async () => {
      fireEvent.press(screen.getByTestId('dashboard-layout-list'));
    });
    await flush();

    expect(
      screen.getByTestId('dashboard-layout-list').props.accessibilityState
        .selected,
    ).toBe(true);
    expect(
      screen.getByText('layout:list scramble:false images:false'),
    ).toBeTruthy();
    expect(await AsyncStorage.getItem('preference_dashboard_layout')).toBe(
      'list',
    );
  });

  it('turning a setting back off writes "0"', async () => {
    await renderSettings();

    await act(async () => {
      fireEvent(scrambleSwitch(), 'valueChange', true);
    });
    await act(async () => {
      fireEvent(scrambleSwitch(), 'valueChange', false);
    });
    await flush();

    expect(
      screen.getByText('layout:tiles scramble:false images:false'),
    ).toBeTruthy();
    expect(await AsyncStorage.getItem('preference_pinpad_scramble')).toBe('0');
  });

  // Both options read "N or newer" on the picker and the Settings row repeats
  // the current one, so the option is pressed by id, not by text.
  it('writes the minimum generation and updates the Settings row', async () => {
    await renderAppletVersion();
    expect(screen.getByText('generation:any')).toBeTruthy();
    expect(
      screen.getByLabelText('Keycard applet version, 3.1 or newer'),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('tile-1'));
    });
    await flush();

    expect(screen.getByText('generation:4.0')).toBeTruthy();
    expect(
      screen.getByLabelText('Keycard applet version, 4.0 or newer'),
    ).toBeTruthy();
    expect(await AsyncStorage.getItem('preference_min_generation')).toBe('4.0');
  });

  // The whole point of the preference: a menu elsewhere in the tree drops
  // what only older cards have, the moment the user says they have none.
  it('hides the pairing secret entry once 4.0 cards are declared', async () => {
    render(
      <PreferencesProvider>
        <MinAppletVersionScreen
          navigation={pickerNavigation}
          route={{ key: 'MinAppletVersion', name: 'MinAppletVersion' } as any}
        />
        <SecretsMenuScreen
          navigation={{ navigate: jest.fn() } as any}
          route={{ key: 'SecretsMenu', name: 'SecretsMenu' } as any}
        />
      </PreferencesProvider>,
    );
    await flush();
    expect(screen.getByText('Change Pairing Secret')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('4.0 or newer'));
    });
    await flush();

    expect(screen.queryByText('Change Pairing Secret')).toBeNull();
    expect(screen.getByText('Change PIN')).toBeTruthy();
  });

  it('keeps the minimum generation across a remount', async () => {
    const first = await renderAppletVersion();
    await act(async () => {
      fireEvent.press(screen.getByTestId('tile-1'));
    });
    await flush();
    first.unmount();

    render(
      <PreferencesProvider>
        <GenerationProbe />
      </PreferencesProvider>,
    );
    await flush();

    expect(screen.getByText('generation:4.0')).toBeTruthy();
  });

  // What a restart sees: a fresh provider reads back exactly what the
  // settings wrote.
  it('survives a remount, so the next launch reads the same values', async () => {
    const first = await renderSettings();
    await act(async () => {
      fireEvent(scrambleSwitch(), 'valueChange', true);
    });
    await act(async () => {
      fireEvent(imagesSwitch(), 'valueChange', true);
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('dashboard-layout-list'));
    });
    await flush();
    first.unmount();

    render(
      <PreferencesProvider>
        <Probe />
      </PreferencesProvider>,
    );
    await flush();

    expect(
      screen.getByText('layout:list scramble:true images:true'),
    ).toBeTruthy();
  });
});
