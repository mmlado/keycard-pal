import React from 'react';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';

import TextEntry from '../src/components/TextEntry';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../src/components/BottomActionArea', () => {
  const { View } = require('react-native');
  return ({ children }: any) => (
    <View testID="bottom-action-area">{children}</View>
  );
});

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const onSubmit = jest.fn();
const onType = jest.fn();

function renderEntry(
  props: Partial<React.ComponentProps<typeof TextEntry>> = {},
) {
  return render(<TextEntry onSubmit={onSubmit} onType={onType} {...props} />);
}

/** Find TextInput from toJSON */
function getTextInputFromJSON(json: any): any {
  let found: any = null;
  function walk(node: any) {
    if (!node || found) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.type === 'TextInput') {
      found = node;
      return;
    }
    if (node.children) walk(node.children);
  }
  walk(json);
  return found;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TextEntry', () => {
  beforeEach(() => {
    onSubmit.mockClear();
    onType.mockClear();
  });

  it('keeps Continue clear of the keyboard in the bottom action area', () => {
    renderEntry();
    expect(
      within(screen.getByTestId('bottom-action-area')).getByText('Continue'),
    ).toBeTruthy();
  });

  it('renders a TextInput', () => {
    const { toJSON } = renderEntry();
    expect(getTextInputFromJSON(toJSON())).toBeTruthy();
  });

  it('Continue button is disabled when value is empty', () => {
    // Verify by attempting to press — disabled button should not call onSubmit
    renderEntry();
    fireEvent.press(screen.getByText('Continue'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Continue button is enabled after typing', () => {
    renderEntry();
    const input = screen.UNSAFE_getByType(require('react-native').TextInput);
    fireEvent.changeText(input, 'secret');
    fireEvent.press(screen.getByText('Continue'));
    expect(onSubmit).toHaveBeenCalledWith('secret');
  });

  it('calls onSubmit with the typed value when Continue is pressed', () => {
    renderEntry();
    const input = screen.UNSAFE_getByType(require('react-native').TextInput);
    fireEvent.changeText(input, 'mysecret');
    fireEvent.press(screen.getByText('Continue'));
    expect(onSubmit).toHaveBeenCalledWith('mysecret');
  });

  it('clears the field after submit', () => {
    renderEntry();
    const input = screen.UNSAFE_getByType(require('react-native').TextInput);
    fireEvent.changeText(input, 'mysecret');
    fireEvent.press(screen.getByText('Continue'));
    expect(
      screen.UNSAFE_getByType(require('react-native').TextInput).props.value,
    ).toBe('');
  });

  it('does not call onSubmit when value is empty', () => {
    renderEntry();
    fireEvent.press(screen.getByText('Continue'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onType when text changes', () => {
    renderEntry();
    const input = screen.UNSAFE_getByType(require('react-native').TextInput);
    fireEvent.changeText(input, 'x');
    expect(onType).toHaveBeenCalled();
  });

  it('clears the value when resetKey changes', () => {
    const { rerender } = renderEntry({ resetKey: 'entry' });
    const input = screen.UNSAFE_getByType(require('react-native').TextInput);
    fireEvent.changeText(input, 'typed');
    expect(
      screen.UNSAFE_getByType(require('react-native').TextInput).props.value,
    ).toBe('typed');
    rerender(
      <TextEntry onSubmit={onSubmit} onType={onType} resetKey="confirm" />,
    );
    expect(
      screen.UNSAFE_getByType(require('react-native').TextInput).props.value,
    ).toBe('');
  });

  it('shows the error when provided', () => {
    renderEntry({ error: 'Secrets do not match' });
    expect(screen.getByText('Secrets do not match')).toBeTruthy();
  });
});
