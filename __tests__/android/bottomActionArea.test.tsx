import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, StyleSheet, Text } from 'react-native';

import BottomActionArea from '../../src/components/BottomActionArea';

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

const listeners: Record<string, (event?: unknown) => void> = {};

beforeEach(() => {
  for (const event of Object.keys(listeners)) delete listeners[event];
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    event: string,
    callback: (event?: unknown) => void,
  ) => {
    listeners[event] = callback;
    return { remove: jest.fn() };
  }) as unknown as typeof Keyboard.addListener);
});

afterEach(() => jest.restoreAllMocks());

const paddingBottom = () =>
  StyleSheet.flatten(screen.getByTestId('area').props.style).paddingBottom;

function renderArea() {
  return render(
    <BottomActionArea testID="area">
      <Text>Save</Text>
    </BottomActionArea>,
  );
}

describe('BottomActionArea on Android', () => {
  it('listens for the keyboard once it is up, as Android sends no keyboardWill events', () => {
    renderArea();
    expect(Object.keys(listeners).sort()).toEqual([
      'keyboardDidHide',
      'keyboardDidShow',
    ]);
  });

  it('clears the keyboard by 24 in both navigation modes, adding back the navigation bar the reported height leaves out', () => {
    // The same keyboard frame, reported shorter under the taller three-button bar.
    const modes = [
      { inset: 63, reported: 280 },
      { inset: 126, reported: 217 },
    ];
    for (const { inset, reported } of modes) {
      mockInsets.bottom = inset;
      const { unmount } = renderArea();
      act(() =>
        listeners.keyboardDidShow({ endCoordinates: { height: reported } }),
      );
      expect(paddingBottom()).toBe(367);
      unmount();
    }
  });

  it('returns to 16 above the navigation bar when the keyboard hides', () => {
    mockInsets.bottom = 63;
    renderArea();
    act(() => listeners.keyboardDidShow({ endCoordinates: { height: 280 } }));
    act(() => listeners.keyboardDidHide());
    expect(paddingBottom()).toBe(79);
  });
});
