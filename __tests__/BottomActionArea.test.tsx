import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';

import BottomActionArea from '../src/components/BottomActionArea';

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

const keyboard = useReanimatedKeyboardAnimation as jest.Mock;

// The library's height: negative while the keyboard is up.
function keyboardAt(height: number) {
  keyboard.mockReturnValue({
    height: { value: -height },
    progress: { value: height > 0 ? 1 : 0 },
  });
}

beforeEach(() => {
  mockInsets.bottom = 0;
  keyboardAt(0);
});

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

  it('rises to 24 above the keyboard, without adding the inset the height already holds', () => {
    mockInsets.bottom = 34;
    keyboardAt(336);
    renderArea();
    expect(areaStyle().paddingBottom).toBe(360);
  });

  it('is the same in both Android navigation modes, the keyboard reaching the screen bottom', () => {
    for (const inset of [63, 126]) {
      mockInsets.bottom = inset;
      keyboardAt(343);
      const { unmount } = renderArea();
      expect(areaStyle().paddingBottom).toBe(367);
      unmount();
    }
  });

  it('never drops below its resting padding for a short keyboard bar', () => {
    mockInsets.bottom = 34;
    keyboardAt(20);
    renderArea();
    expect(areaStyle().paddingBottom).toBe(50);
  });
});
