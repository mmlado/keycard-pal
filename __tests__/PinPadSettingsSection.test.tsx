import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PinPadSettingsSection from '../src/components/settings/PinPadSettingsSection';
import { PreferencesProvider } from '../src/providers/preferences/Provider';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

// The section reads and writes through the real provider; only storage is
// mocked, so a failed write exercises the provider's rollback.
const mockLoadPreferences = jest.fn();
const mockSavePreference = jest.fn();

jest.mock('../src/storage/preferencesStorage', () => ({
  loadPreferences: () => mockLoadPreferences(),
  savePreference: (...args: unknown[]) => mockSavePreference(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function storedScramble(pinPadScramble: boolean) {
  mockLoadPreferences.mockResolvedValue({
    dashboardLayout: 'tiles',
    pinPadScramble,
    tokenImagesEnabled: false,
    welcomeSeen: true,
    xpubNoticeDismissed: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  storedScramble(false);
  mockSavePreference.mockResolvedValue(undefined);
});

async function renderSection() {
  render(
    <PreferencesProvider>
      <PinPadSettingsSection />
    </PreferencesProvider>,
  );
  await act(async () => {});
}

function getSwitch() {
  return screen.getByRole('switch');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PinPadSettingsSection', () => {
  it('renders toggle label', async () => {
    await renderSection();
    expect(screen.getByText('Scramble PIN pad')).toBeTruthy();
  });

  it('renders toggle off by default', async () => {
    await renderSection();
    expect(getSwitch().props.value).toBe(false);
  });

  it('saves true when toggled on', async () => {
    await renderSection();
    await act(async () => {
      fireEvent(getSwitch(), 'valueChange', true);
    });
    expect(mockSavePreference).toHaveBeenCalledWith('pinPadScramble', true);
    expect(getSwitch().props.value).toBe(true);
  });

  it('saves false when toggled off', async () => {
    storedScramble(true);
    await renderSection();
    await act(async () => {
      fireEvent(getSwitch(), 'valueChange', false);
    });
    expect(mockSavePreference).toHaveBeenCalledWith('pinPadScramble', false);
    expect(getSwitch().props.value).toBe(false);
  });

  it('reverts toggle state when save fails', async () => {
    mockSavePreference.mockRejectedValue(new Error('storage full'));
    await renderSection();
    await act(async () => {
      fireEvent(getSwitch(), 'valueChange', true);
    });
    expect(getSwitch().props.value).toBe(false);
  });

  it('shows the persisted value on mount', async () => {
    storedScramble(true);
    await renderSection();
    expect(getSwitch().props.value).toBe(true);
  });
});
