import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PinPadSettingsSection from '../src/components/settings/PinPadSettingsSection';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

const mockLoadPreference = jest.fn().mockResolvedValue(false);
const mockSavePreference = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/storage/preferencesStorage', () => ({
  loadBooleanPreference: (...args: unknown[]) => mockLoadPreference(...args),
  preferenceKeys: { pinPadScramble: 'preference_pinpad_scramble' },
  saveBooleanPreference: (...args: unknown[]) => mockSavePreference(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadPreference.mockResolvedValue(false);
});

function getSwitch() {
  return screen.getByRole('switch');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PinPadSettingsSection', () => {
  it('renders toggle label', () => {
    render(<PinPadSettingsSection />);
    expect(screen.getByText('Scramble PIN pad')).toBeTruthy();
  });

  it('renders toggle off by default', async () => {
    render(<PinPadSettingsSection />);
    await act(async () => {});
    const switchComponent = getSwitch();
    expect(switchComponent.props.value).toBe(false);
  });

  it('calls saveBooleanPreference with true when toggled on', async () => {
    render(<PinPadSettingsSection />);
    await act(async () => {});
    const switchComponent = getSwitch();
    await act(async () => {
      fireEvent(switchComponent, 'valueChange', true);
    });
    expect(mockSavePreference).toHaveBeenCalledWith(
      'preference_pinpad_scramble',
      true,
    );
  });

  it('calls saveBooleanPreference with false when toggled off', async () => {
    render(<PinPadSettingsSection />);
    await act(async () => {});
    const switchComponent = getSwitch();
    await act(async () => {
      fireEvent(switchComponent, 'valueChange', false);
    });
    expect(mockSavePreference).toHaveBeenCalledWith(
      'preference_pinpad_scramble',
      false,
    );
  });

  it('reverts toggle state when save fails', async () => {
    mockSavePreference.mockRejectedValue(new Error('storage full'));
    render(<PinPadSettingsSection />);
    await act(async () => {});
    const switchComponent = getSwitch();
    await act(async () => {
      fireEvent(switchComponent, 'valueChange', true);
    });
    expect(getSwitch().props.value).toBe(false);
  });

  it('loads persisted value on mount', async () => {
    mockLoadPreference.mockResolvedValue(true);
    render(<PinPadSettingsSection />);
    await act(async () => {});
    const switchComponent = getSwitch();
    expect(switchComponent.props.value).toBe(true);
    expect(mockLoadPreference).toHaveBeenCalledWith(
      'preference_pinpad_scramble',
    );
  });
});
