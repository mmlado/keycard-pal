import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import MinAppletVersionScreen, {
  MIN_APPLET_VERSION_EXPLAINER,
} from '../src/screens/MinAppletVersionScreen';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

let mockMinGeneration: '3.1' | '4.0' | 'any' = 'any';
const mockSetPreference = jest.fn();

// These assertions describe the list layout's rows, so pin the preference.
jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: { dashboardLayout: 'list', minGeneration: mockMinGeneration },
    setPreference: (...args: unknown[]) => mockSetPreference(...args),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = { goBack: jest.fn() } as any;
const route = { key: 'MinAppletVersion', name: 'MinAppletVersion' } as any;

function renderScreen() {
  return render(
    <MinAppletVersionScreen navigation={navigation} route={route} />,
  );
}

function selected(testID: string): boolean {
  return screen.getByTestId(testID).props.accessibilityState.selected;
}

beforeEach(() => {
  mockMinGeneration = 'any';
  mockSetPreference.mockClear();
  navigation.goBack.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MinAppletVersionScreen', () => {
  // One option per generation, named by applet version. Not one per release,
  // and no generation or secure channel wording.
  it('offers each generation by its applet version', () => {
    renderScreen();
    expect(screen.getByText('3.1 or newer')).toBeTruthy();
    expect(screen.getByText('4.0 or newer')).toBeTruthy();
  });

  it('says that the choice never stops a card from working', () => {
    renderScreen();
    expect(screen.getByText(MIN_APPLET_VERSION_EXPLAINER)).toBeTruthy();
    expect(MIN_APPLET_VERSION_EXPLAINER).toContain('keeps working');
  });

  it('marks the floor as current while nothing is declared', () => {
    renderScreen();
    expect(selected('menu-row-0')).toBe(true);
    expect(selected('menu-row-1')).toBe(false);
  });

  it('marks the declared generation as current', () => {
    mockMinGeneration = '4.0';
    renderScreen();
    expect(selected('menu-row-0')).toBe(false);
    expect(selected('menu-row-1')).toBe(true);
  });

  it('stores a newer generation and goes back', () => {
    renderScreen();
    fireEvent.press(screen.getByText('4.0 or newer'));
    expect(mockSetPreference).toHaveBeenCalledWith('minGeneration', '4.0');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  // The floor is "hide nothing", and stays that even if an older generation is
  // ever added below it, so it is stored as the sentinel, not as its version.
  it('stores the floor as any', () => {
    mockMinGeneration = '4.0';
    renderScreen();
    fireEvent.press(screen.getByText('3.1 or newer'));
    expect(mockSetPreference).toHaveBeenCalledWith('minGeneration', 'any');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
