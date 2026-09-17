import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import UnselectedKeycardReminder from '../src/components/UnselectedKeycardReminder';
import {
  noteTappedGeneration,
  resetLastTappedGeneration,
} from '../src/utils/lastTappedGeneration';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

let mockInUse: ('3.1' | '4.0')[] = ['4.0'];
let mockDismissed: ('3.1' | '4.0')[] = [];
const mockSetPreference = jest.fn();

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: {
      generationsInUse: mockInUse,
      generationRemindersDismissed: mockDismissed,
    },
    setPreference: (...args: unknown[]) => mockSetPreference(...args),
  }),
}));

const REMINDER = 'unselected-keycard-reminder';

beforeEach(() => {
  resetLastTappedGeneration();
  mockInUse = ['4.0'];
  mockDismissed = [];
  mockSetPreference.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnselectedKeycardReminder', () => {
  it('draws nothing before any card was tapped', () => {
    render(<UnselectedKeycardReminder />);
    expect(screen.queryByTestId(REMINDER)).toBeNull();
  });

  it('draws nothing after a tap of a card the user ticked', () => {
    noteTappedGeneration('4.0');
    render(<UnselectedKeycardReminder />);
    expect(screen.queryByTestId(REMINDER)).toBeNull();
  });

  it('appears after a tap of a card the user left unticked', () => {
    noteTappedGeneration('3.1');
    render(<UnselectedKeycardReminder />);
    expect(screen.getByTestId(REMINDER)).toBeTruthy();
    expect(screen.getByText(/applet 3\.x/)).toBeTruthy();
    expect(screen.getByText('Use 3.x Keycards')).toBeTruthy();
  });

  // The dashboard is usually already mounted when the tap happens elsewhere.
  it('appears when the tap comes while it is on screen', () => {
    render(<UnselectedKeycardReminder />);
    expect(screen.queryByTestId(REMINDER)).toBeNull();
    act(() => {
      noteTappedGeneration('3.1');
    });
    expect(screen.getByTestId(REMINDER)).toBeTruthy();
  });

  it('keeps internal vocabulary out of the wording', () => {
    noteTappedGeneration('3.1');
    const { toJSON } = render(<UnselectedKeycardReminder />);
    expect(JSON.stringify(toJSON())).not.toMatch(/generation|secure channel/i);
  });

  it('ticks the generation from its button, keeping table order', () => {
    noteTappedGeneration('3.1');
    render(<UnselectedKeycardReminder />);
    fireEvent.press(screen.getByTestId(`${REMINDER}-use`));
    expect(mockSetPreference).toHaveBeenCalledWith('generationsInUse', [
      '3.1',
      '4.0',
    ]);
  });

  // A friend's card should not keep asking. The user can still tick it in
  // Settings, which this leaves alone.
  it('stays quiet about that generation for good when closed', () => {
    noteTappedGeneration('3.1');
    render(<UnselectedKeycardReminder />);
    fireEvent.press(screen.getByTestId(`${REMINDER}-close`));
    expect(mockSetPreference).toHaveBeenCalledWith(
      'generationRemindersDismissed',
      ['3.1'],
    );
    expect(mockSetPreference).not.toHaveBeenCalledWith(
      'generationsInUse',
      expect.anything(),
    );
  });

  it('adds to reminders that were already closed', () => {
    mockInUse = ['3.1'];
    mockDismissed = ['3.1'];
    noteTappedGeneration('4.0');
    render(<UnselectedKeycardReminder />);
    fireEvent.press(screen.getByTestId(`${REMINDER}-close`));
    expect(mockSetPreference).toHaveBeenCalledWith(
      'generationRemindersDismissed',
      ['3.1', '4.0'],
    );
  });

  it('draws nothing for a generation it was closed for', () => {
    mockDismissed = ['3.1'];
    noteTappedGeneration('3.1');
    render(<UnselectedKeycardReminder />);
    expect(screen.queryByTestId(REMINDER)).toBeNull();
  });
});
