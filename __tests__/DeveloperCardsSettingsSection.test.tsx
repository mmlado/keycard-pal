import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import DeveloperCardsSettingsSection from '../src/components/settings/DeveloperCardsSettingsSection';
import { PreferencesProvider } from '../src/providers/preferences/Provider';
import type { DeveloperCardOptions } from '../src/storage/preferencesStorage';
import { testPreferences } from './preferences.testUtils';

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

let mockInstallLockSupported = true;
jest.mock('../src/utils/installLockSupport', () => ({
  get INSTALL_LOCK_SUPPORTED() {
    return mockInstallLockSupported;
  },
}));

const mockLoadPreferences = jest.fn();
const mockSavePreference = jest.fn();

jest.mock('../src/storage/customTokensStorage', () => ({
  restoreCustomTokens: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/storage/preferencesStorage', () => ({
  loadPreferences: () => mockLoadPreferences(),
  savePreference: (...args: unknown[]) => mockSavePreference(...args),
}));

function stored(developerCardOptions: DeveloperCardOptions) {
  mockLoadPreferences.mockResolvedValue(
    testPreferences({ developerCardOptions }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInstallLockSupported = true;
  stored('unset');
  mockSavePreference.mockResolvedValue(undefined);
});

async function renderSection() {
  render(
    <PreferencesProvider>
      <DeveloperCardsSettingsSection />
    </PreferencesProvider>,
  );
  await act(async () => {});
}

const toggle = () => screen.getByRole('switch');

describe('DeveloperCardsSettingsSection', () => {
  it('names the options', async () => {
    await renderSection();
    expect(screen.getByText('Show developer card options')).toBeTruthy();
  });

  it.each([
    ['unset', false],
    ['hidden', false],
    ['shown', true],
  ] as const)('shows %p as %p', async (choice, on) => {
    stored(choice);
    await renderSection();
    expect(toggle().props.value).toBe(on);
  });

  it('stores turning it on as shown', async () => {
    await renderSection();
    await act(async () => {
      fireEvent(toggle(), 'valueChange', true);
    });
    expect(mockSavePreference).toHaveBeenCalledWith(
      'developerCardOptions',
      'shown',
    );
  });

  it('stores turning it off as hidden, a choice the next approval keeps', async () => {
    stored('shown');
    await renderSection();
    await act(async () => {
      fireEvent(toggle(), 'valueChange', false);
    });
    expect(mockSavePreference).toHaveBeenCalledWith(
      'developerCardOptions',
      'hidden',
    );
  });

  it('renders nothing where the install lock is not supported', async () => {
    mockInstallLockSupported = false;
    stored('shown');
    await renderSection();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
