import React from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';

import KeyboardAwareScrollView, {
  useKeepAboveKeyboard,
} from '../../src/components/KeyboardAwareScrollView';

jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 64 }));

let field: ReturnType<typeof useKeepAboveKeyboard>;

function Probe() {
  field = useKeepAboveKeyboard();
  return null;
}

const listeners: Record<string, (event?: unknown) => void> = {};

beforeEach(() => {
  for (const event of Object.keys(listeners)) delete listeners[event];
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    event: string,
    handler: (event?: unknown) => void,
  ) => {
    listeners[event] = handler;
    return { remove: jest.fn() };
  }) as unknown as typeof Keyboard.addListener);
});

afterEach(() => jest.restoreAllMocks());

describe('KeyboardAwareScrollView on Android', () => {
  it('listens for the keyboard once it is up, and shrinks by height', () => {
    render(
      <KeyboardAwareScrollView>
        <Probe />
      </KeyboardAwareScrollView>,
    );
    expect(Object.keys(listeners).sort()).toEqual([
      'keyboardDidHide',
      'keyboardDidShow',
    ]);
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe(
      'height',
    );
  });

  it('scrolls the focused field once the shrunk viewport lays out, not on the keyboard event', () => {
    render(
      <KeyboardAwareScrollView>
        <Probe />
      </KeyboardAwareScrollView>,
    );
    const scrollView = screen.UNSAFE_getByType(ScrollView);
    const scrollTo = jest.fn();
    (scrollView.instance as any).scrollTo = scrollTo;
    (field.block.ref as { current: unknown }).current = {
      measureInWindow: (
        cb: (x: number, y: number, w: number, h: number) => void,
      ) => cb(0, 900, 300, 120),
    };
    act(() => field.input.onFocus());

    act(() => listeners.keyboardDidShow({ endCoordinates: { screenY: 1000 } }));
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => scrollView.props.onLayout());
    expect(scrollTo).toHaveBeenCalledWith({ y: 36, animated: true });
  });
});
