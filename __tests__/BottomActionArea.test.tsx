import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, StyleSheet, Text } from 'react-native';

import BottomActionArea from '../src/components/BottomActionArea';

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

const listeners: Record<string, (event?: unknown) => void> = {};
const removed: string[] = [];

beforeEach(() => {
  for (const event of Object.keys(listeners)) delete listeners[event];
  removed.length = 0;
  mockInsets.bottom = 0;
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    event: string,
    callback: (event?: unknown) => void,
  ) => {
    listeners[event] = callback;
    return { remove: () => removed.push(event) };
  }) as unknown as typeof Keyboard.addListener);
});

afterEach(() => jest.restoreAllMocks());

function renderArea() {
  return render(
    <BottomActionArea testID="area" style={{ paddingHorizontal: 24 }}>
      <Text>Save</Text>
    </BottomActionArea>,
  );
}

const areaStyle = () =>
  StyleSheet.flatten(screen.getByTestId('area').props.style);

describe('BottomActionArea', () => {
  it('holds its action 16 above the bottom inset at rest, in the style it was given', () => {
    mockInsets.bottom = 34;
    renderArea();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(areaStyle()).toMatchObject({
      paddingBottom: 50,
      paddingHorizontal: 24,
    });
  });

  it('holds it 16 above the bottom edge on a phone with no bottom inset', () => {
    renderArea();
    expect(areaStyle().paddingBottom).toBe(16);
  });

  it('rises to 24 above the keyboard as iOS announces it, without adding the inset the height already holds', () => {
    mockInsets.bottom = 34;
    renderArea();
    expect(Object.keys(listeners).sort()).toEqual([
      'keyboardWillHide',
      'keyboardWillShow',
    ]);

    act(() => listeners.keyboardWillShow({ endCoordinates: { height: 336 } }));
    expect(areaStyle().paddingBottom).toBe(360);

    act(() => listeners.keyboardWillHide());
    expect(areaStyle().paddingBottom).toBe(50);
  });

  it('never drops below its resting padding for a short keyboard bar', () => {
    mockInsets.bottom = 34;
    renderArea();
    act(() => listeners.keyboardWillShow({ endCoordinates: { height: 20 } }));
    expect(areaStyle().paddingBottom).toBe(50);
  });

  it('stops listening when it unmounts', () => {
    const { unmount } = renderArea();
    unmount();
    expect(removed.sort()).toEqual(['keyboardWillHide', 'keyboardWillShow']);
  });
});
