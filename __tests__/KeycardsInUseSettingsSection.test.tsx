import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import KeycardsInUseSettingsSection, {
  KEYCARDS_IN_USE_EXPLAINER,
} from '../src/components/settings/KeycardsInUseSettingsSection';

import {
  getLastTappedGeneration,
  noteTappedGeneration,
  resetLastTappedGeneration,
} from '../src/utils/lastTappedGeneration';

import { testPreferences as mockTestPreferences } from './preferences.testUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

let mockInUse: ('3.1' | '4.0')[] = ['3.1', '4.0'];
const mockSetPreference = jest.fn();

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: mockTestPreferences({ generationsInUse: mockInUse }),
    setPreference: (...args: unknown[]) => mockSetPreference(...args),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSection(readingCard = false, onSetFromCard = jest.fn()) {
  render(
    <KeycardsInUseSettingsSection
      onSetFromCard={onSetFromCard}
      readingCard={readingCard}
    />,
  );
  return onSetFromCard;
}

function box(generation: '3.1' | '4.0') {
  return screen.getByTestId(`keycards-in-use-${generation}`);
}

beforeEach(() => {
  mockInUse = ['3.1', '4.0'];
  mockSetPreference.mockClear();
  resetLastTappedGeneration();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KeycardsInUseSettingsSection', () => {
  // One box per generation, by its label.
  it('offers each generation by its label', () => {
    renderSection();
    expect(screen.getByText('Keycards in use')).toBeTruthy();
    expect(screen.getByText('Applet 3.x')).toBeTruthy();
    expect(screen.getByText('Applet 4.x')).toBeTruthy();
  });

  it('says that the choice never stops a card from working', () => {
    renderSection();
    expect(screen.getByText(KEYCARDS_IN_USE_EXPLAINER)).toBeTruthy();
    expect(KEYCARDS_IN_USE_EXPLAINER).toContain('keeps working');
    expect(KEYCARDS_IN_USE_EXPLAINER).not.toMatch(/generation|secure channel/i);
  });

  it('ticks what is in use', () => {
    mockInUse = ['4.0'];
    renderSection();
    expect(box('3.1').props.accessibilityState.checked).toBe(false);
    expect(box('4.0').props.accessibilityState.checked).toBe(true);
  });

  it('unticks a generation', () => {
    renderSection();
    fireEvent.press(box('3.1'));
    expect(mockSetPreference).toHaveBeenCalledWith('generationsInUse', ['4.0']);
  });

  // Stored in table order, whatever order was ticked.
  it('ticks a generation, keeping table order', () => {
    mockInUse = ['4.0'];
    renderSection();
    fireEvent.press(box('3.1'));
    expect(mockSetPreference).toHaveBeenCalledWith('generationsInUse', [
      '3.1',
      '4.0',
    ]);
  });

  // An empty selection says nothing about the user's cards.
  it('does not let the last ticked box be unticked', () => {
    mockInUse = ['3.1'];
    renderSection();
    expect(box('3.1').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(box('3.1'));
    expect(mockSetPreference).not.toHaveBeenCalled();
  });

  it('leaves the other box free while one is locked', () => {
    mockInUse = ['3.1'];
    renderSection();
    expect(box('4.0').props.accessibilityState.disabled).toBe(false);
  });

  // The reminder must follow a tap, never this edit.
  it('forgets the last tapped card when the selection is edited', () => {
    noteTappedGeneration('4.0');
    renderSection();
    fireEvent.press(box('4.0'));
    expect(getLastTappedGeneration()).toBeNull();
  });

  it('keeps the last tapped card when a locked box is pressed', () => {
    mockInUse = ['3.1'];
    noteTappedGeneration('4.0');
    renderSection();
    fireEvent.press(box('3.1'));
    expect(getLastTappedGeneration()).toBe('4.0');
  });

  describe('set from my Keycard', () => {
    it('starts the tap', () => {
      const onSetFromCard = renderSection();
      fireEvent.press(screen.getByText('Set from my Keycard'));
      expect(onSetFromCard).toHaveBeenCalledTimes(1);
    });

    it('cannot be started twice while a card is being read', () => {
      const onSetFromCard = renderSection(true);
      fireEvent.press(screen.getByTestId('keycards-in-use-set-from-card'));
      expect(onSetFromCard).not.toHaveBeenCalled();
    });
  });
});
