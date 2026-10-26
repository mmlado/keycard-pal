import React from 'react';
import { Keyboard, ScrollView } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import KeyboardAwareScrollView, {
  useKeepAboveKeyboard,
} from '../src/components/KeyboardAwareScrollView';
import TextInputSetting from '../src/components/settings/TextInputSetting';

jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 64 }));

type Handles = ReturnType<typeof useKeepAboveKeyboard>;
let field: Handles;

// A field the test focuses by hand, its block measured where the test says.
function Probe() {
  field = useKeepAboveKeyboard();
  return null;
}

function focusFieldAt(y: number, height = 120) {
  (field.block.ref as { current: unknown }).current = {
    measureInWindow: (
      cb: (x: number, y: number, w: number, h: number) => void,
    ) => cb(0, y, 300, height),
  };
  act(() => field.input.onFocus());
}

function renderArea() {
  const view = render(
    <KeyboardAwareScrollView>
      <Probe />
    </KeyboardAwareScrollView>,
  );
  const scrollView = screen.UNSAFE_getByType(ScrollView);
  const scrollTo = jest.fn();
  // The area holds this instance by ref, so replacing the method intercepts it.
  (scrollView.instance as any).scrollTo = scrollTo;
  return { ...view, scrollView, scrollTo };
}

// The area picks its event names by platform, so the test drives whichever it registered.
let listeners: Record<string, (event: any) => void> = {};
let added: string[] = [];
let removed: string[] = [];

function showKeyboard(screenY: number) {
  act(() => {
    listeners.keyboardWillShow?.({ endCoordinates: { screenY } });
    listeners.keyboardDidShow?.({ endCoordinates: { screenY } });
  });
}

function hideKeyboard() {
  act(() => {
    listeners.keyboardWillHide?.({});
    listeners.keyboardDidHide?.({});
  });
}

function scrollBy(scrollView: any, y: number) {
  act(() => {
    scrollView.props.onScroll({ nativeEvent: { contentOffset: { y } } });
  });
}

beforeEach(() => {
  listeners = {};
  added = [];
  removed = [];
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    event: string,
    handler: (e: any) => void,
  ) => {
    listeners[event] = handler;
    added.push(event);
    return { remove: () => removed.push(event) };
  }) as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('KeyboardAwareScrollView', () => {
  it('scrolls a field the keyboard would cover, by exactly the hidden amount', () => {
    const { scrollView, scrollTo } = renderArea();
    showKeyboard(1000);
    scrollBy(scrollView, 200);

    // The field ends at 1020, plus the 16px gap, against a keyboard top of 1000.
    focusFieldAt(900);

    expect(scrollTo).toHaveBeenCalledWith({ y: 236, animated: true });
  });

  it('leaves a field the keyboard does not reach alone', () => {
    const { scrollView, scrollTo } = renderArea();
    showKeyboard(1000);
    scrollBy(scrollView, 200);

    focusFieldAt(100);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does nothing while the keyboard is down', () => {
    const { scrollTo } = renderArea();

    focusFieldAt(900);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('stops scrolling once the keyboard is dismissed', () => {
    const { scrollTo } = renderArea();
    showKeyboard(1000);
    hideKeyboard();

    focusFieldAt(900);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('forgets a field once it loses focus', () => {
    const { scrollView, scrollTo } = renderArea();
    showKeyboard(1000);
    focusFieldAt(900);
    act(() => field.input.onBlur());
    scrollTo.mockClear();

    act(() => scrollView.props.onLayout());

    expect(scrollTo).not.toHaveBeenCalled();
  });

  // The keyboard shrinks the ScrollView, and only then is there a viewport to scroll into.
  it('retries on layout, which is when the shrunk viewport exists', () => {
    const { scrollView, scrollTo } = renderArea();
    showKeyboard(1000);
    focusFieldAt(900);
    scrollTo.mockClear();

    act(() => scrollView.props.onLayout());

    expect(scrollTo).toHaveBeenCalledWith({ y: 36, animated: true });
  });

  it("scrolls again when a focused field's block grows, as when Revert and Save appear", () => {
    const { scrollTo } = renderArea();
    showKeyboard(1000);
    focusFieldAt(900);
    scrollTo.mockClear();

    act(() => field.block.onLayout());

    expect(scrollTo).toHaveBeenCalledWith({ y: 36, animated: true });
  });

  it('leaves a block that grows without focus alone', () => {
    const { scrollTo } = renderArea();
    showKeyboard(1000);
    focusFieldAt(900);
    act(() => field.input.onBlur());
    scrollTo.mockClear();

    act(() => field.block.onLayout());

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('measures from the current scroll offset', () => {
    const { scrollView, scrollTo } = renderArea();
    showKeyboard(1000);
    scrollBy(scrollView, 500);

    focusFieldAt(900);

    expect(scrollTo).toHaveBeenCalledWith({ y: 536, animated: true });
  });

  // UIKit scrolls the focused field flush with the keyboard during its animation.
  it('scrolls again on iOS once the keyboard has settled', () => {
    const { scrollTo } = renderArea();
    focusFieldAt(900);
    act(() =>
      listeners.keyboardWillShow({ endCoordinates: { screenY: 1000 } }),
    );
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => listeners.keyboardDidShow({ endCoordinates: { screenY: 1000 } }));

    expect(scrollTo).toHaveBeenCalledWith({ y: 36, animated: true });
  });

  it("scrolls against the keyboard's settled frame, not the one announced", () => {
    const { scrollTo } = renderArea();
    focusFieldAt(900);
    act(() =>
      listeners.keyboardWillShow({ endCoordinates: { screenY: 1000 } }),
    );

    act(() => listeners.keyboardDidShow({ endCoordinates: { screenY: 950 } }));

    expect(scrollTo).toHaveBeenCalledWith({ y: 86, animated: true });
  });

  it('drops every keyboard listener it added when it goes', () => {
    const { unmount } = renderArea();
    expect(Object.keys(listeners).sort()).toEqual([
      'keyboardDidShow',
      'keyboardWillHide',
      'keyboardWillShow',
    ]);

    unmount();

    expect(removed.sort()).toEqual(added.sort());
  });

  it('keeps a real settings field above the keyboard, Revert and Save included', () => {
    render(
      <KeyboardAwareScrollView>
        <TextInputSetting
          label="Project ID"
          value="abc"
          placeholder="Project ID"
          onSave={async () => {}}
        />
      </KeyboardAwareScrollView>,
    );
    const scrollTo = jest.fn();
    (screen.UNSAFE_getByType(ScrollView).instance as any).scrollTo = scrollTo;
    const input = screen.getByPlaceholderText('Project ID');
    // The jest View is a mock component; the field's ref is its instance.
    let block: any = input;
    while (!(block.props.onLayout && block.instance)) block = block.parent;
    block.instance.measureInWindow = (
      cb: (x: number, y: number, w: number, h: number) => void,
    ) => cb(0, 900, 300, 120);
    showKeyboard(1000);

    fireEvent(input, 'focus');
    expect(scrollTo).toHaveBeenCalledWith({ y: 36, animated: true });

    scrollTo.mockClear();
    fireEvent.changeText(input, 'abcd');
    expect(screen.getByText('Save')).toBeTruthy();
    fireEvent(block, 'layout');
    expect(scrollTo).toHaveBeenCalledWith({ y: 36, animated: true });

    scrollTo.mockClear();
    fireEvent(input, 'blur');
    fireEvent(block, 'layout');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('a field outside any scroll area renders and hands its block to no one', () => {
    render(<Probe />);
    expect(() => act(() => field.input.onFocus())).not.toThrow();
  });
});
