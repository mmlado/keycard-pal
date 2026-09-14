import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import DashboardLayoutSettingsSection from '../src/components/settings/DashboardLayoutSettingsSection';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

const mockLoadPreference = jest.fn().mockResolvedValue('tiles');
const mockSavePreference = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/storage/preferencesStorage', () => ({
  loadDashboardLayout: () => mockLoadPreference(),
}));

// Writes go through the hook module so every mounted screen is told to re-read.
jest.mock('../src/hooks/useDashboardLayout', () => ({
  setDashboardLayout: (v: string) => mockSavePreference(v),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadPreference.mockResolvedValue('tiles');
  mockSavePreference.mockResolvedValue(undefined);
});

async function renderSection() {
  const view = render(<DashboardLayoutSettingsSection />);
  await act(async () => {});
  return view;
}

function segment(value: 'tiles' | 'list') {
  return screen.getByTestId(`dashboard-layout-${value}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardLayoutSettingsSection', () => {
  it('renders the row label', async () => {
    await renderSection();
    expect(screen.getByText('Layout')).toBeTruthy();
  });

  it('offers a segment per layout', async () => {
    await renderSection();
    expect(segment('tiles')).toBeTruthy();
    expect(segment('list')).toBeTruthy();
  });

  it('selects tiles by default', async () => {
    await renderSection();
    expect(segment('tiles').props.accessibilityState.selected).toBe(true);
    expect(segment('list').props.accessibilityState.selected).toBe(false);
  });

  it('selects the persisted layout on mount', async () => {
    mockLoadPreference.mockResolvedValue('list');
    await renderSection();
    expect(segment('list').props.accessibilityState.selected).toBe(true);
    expect(segment('tiles').props.accessibilityState.selected).toBe(false);
  });

  it('saves the layout when a segment is pressed', async () => {
    await renderSection();
    await act(async () => {
      fireEvent.press(segment('list'));
    });
    expect(mockSavePreference).toHaveBeenCalledWith('list');
    expect(segment('list').props.accessibilityState.selected).toBe(true);
  });

  it('saves tiles when switching back', async () => {
    mockLoadPreference.mockResolvedValue('list');
    await renderSection();
    await act(async () => {
      fireEvent.press(segment('tiles'));
    });
    expect(mockSavePreference).toHaveBeenCalledWith('tiles');
  });

  // The control shows the selection immediately, so a failed write has to put
  // it back rather than leaving the UI disagreeing with storage.
  it('reverts the selection when the save fails', async () => {
    mockSavePreference.mockRejectedValue(new Error('storage full'));
    await renderSection();
    await act(async () => {
      fireEvent.press(segment('list'));
    });
    expect(segment('tiles').props.accessibilityState.selected).toBe(true);
    expect(segment('list').props.accessibilityState.selected).toBe(false);
  });

  it('marks the segments as radios', async () => {
    await renderSection();
    expect(segment('tiles').props.accessibilityRole).toBe('radio');
  });
});
