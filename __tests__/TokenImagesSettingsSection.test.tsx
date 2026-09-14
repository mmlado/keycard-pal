import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import TokenImagesSettingsSection from '../src/components/settings/TokenImagesSettingsSection.online';
import { PreferencesProvider } from '../src/providers/preferences/Provider';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// The section reads and writes through the real provider; only storage is
// mocked, so a failed write exercises the provider's rollback.
const mockLoadPreferences = jest.fn();
const mockSavePreference = jest.fn();

jest.mock('../src/storage/preferencesStorage', () => ({
  loadPreferences: () => mockLoadPreferences(),
  savePreference: (...args: unknown[]) => mockSavePreference(...args),
}));

jest.mock('react-native-paper', () => {
  const { Text, Switch } = require('react-native');
  return {
    MD3DarkTheme: { colors: {} },
    Text,
    Switch,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function storedEnabled(tokenImagesEnabled: boolean) {
  mockLoadPreferences.mockResolvedValue({
    dashboardLayout: 'tiles',
    pinPadScramble: false,
    tokenImagesEnabled,
    welcomeSeen: true,
    xpubNoticeDismissed: false,
  });
}

async function renderSection() {
  render(
    <PreferencesProvider>
      <TokenImagesSettingsSection />
    </PreferencesProvider>,
  );
  await act(async () => {});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TokenImagesSettingsSection', () => {
  beforeEach(() => {
    mockLoadPreferences.mockReset();
    mockSavePreference.mockReset();
    storedEnabled(false);
    mockSavePreference.mockResolvedValue(undefined);
  });

  it('renders the toggle with label', async () => {
    await renderSection();
    expect(screen.getByText('Load token images')).toBeTruthy();
  });

  it('toggle is off by default (opt-in)', async () => {
    await renderSection();
    expect(screen.getByRole('switch').props.value).toBe(false);
  });

  it('reflects stored preference when enabled', async () => {
    storedEnabled(true);
    await renderSection();
    expect(screen.getByRole('switch').props.value).toBe(true);
  });

  it('saves and updates state when toggled on', async () => {
    await renderSection();
    await act(async () => {
      fireEvent(screen.getByRole('switch'), 'valueChange', true);
    });
    expect(mockSavePreference).toHaveBeenCalledWith('tokenImagesEnabled', true);
    expect(screen.getByRole('switch').props.value).toBe(true);
  });

  it('reverts state when save rejects', async () => {
    storedEnabled(true);
    mockSavePreference.mockRejectedValue(new Error('storage error'));
    await renderSection();
    await act(async () => {
      fireEvent(screen.getByRole('switch'), 'valueChange', false);
    });
    expect(screen.getByRole('switch').props.value).toBe(true);
  });
});
