import React from 'react';
import { ScrollView } from 'react-native';
import { useFocusedInputHandler } from 'react-native-keyboard-controller';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import KeyboardAwareScrollView, {
  FIELD_GAP,
  useKeepAboveKeyboard,
} from '../src/components/KeyboardAwareScrollView';
import TextInputSetting from '../src/components/settings/TextInputSetting';

type Handles = ReturnType<typeof useKeepAboveKeyboard>;
const fields: Handles[] = [];

// Fields the test lays out and focuses by hand.
function Probe({ index }: { index: number }) {
  fields[index] = useKeepAboveKeyboard();
  return null;
}

const layout = (values: { y?: number; height: number }) => ({
  nativeEvent: { layout: { x: 0, y: values.y ?? 0, width: 300, ...values } },
});

function lay(
  field: Handles,
  input: { y: number; height: number },
  block: number,
) {
  act(() => {
    field.input.onLayout(layout(input) as any);
    field.block.onLayout(layout({ height: block }) as any);
  });
}

function renderArea(count = 1) {
  render(
    <KeyboardAwareScrollView>
      {Array.from({ length: count }, (_, index) => (
        <Probe key={index} index={index} />
      ))}
    </KeyboardAwareScrollView>,
  );
}

const bottomOffset = () =>
  screen.UNSAFE_getByType(ScrollView).props.bottomOffset;

// The library reports where the focused input's caret ends, from the input's top.
function caretAt(y: number) {
  const [handler] = jest.mocked(useFocusedInputHandler).mock.calls.at(-1)!;
  act(() => {
    handler.onSelectionChange!({
      target: 1,
      selection: {
        start: { x: 0, y: 0, position: 0 },
        end: { x: 0, y, position: 0 },
      },
    });
    // The update reaches React in a microtask, which the fake timers hold.
    jest.runAllTicks();
  });
}

beforeEach(() => {
  fields.length = 0;
});

describe('KeyboardAwareScrollView', () => {
  it('keeps the caret FIELD_GAP above the keyboard while no field is focused', () => {
    renderArea();
    expect(bottomOffset()).toBe(FIELD_GAP);
  });

  it('takes the caret to be at the bottom of its input until the library reports it', () => {
    renderArea();
    lay(fields[0], { y: 20, height: 40 }, 60);
    act(() => fields[0].input.onFocus());
    expect(bottomOffset()).toBe(FIELD_GAP);
  });

  it('adds the part of the focused input below its caret', () => {
    renderArea();
    lay(fields[0], { y: 20, height: 40 }, 60);
    act(() => fields[0].input.onFocus());

    caretAt(33);

    expect(bottomOffset()).toBe(FIELD_GAP + 7);
  });

  it('clamps the caret to its input, as the library does', () => {
    renderArea();
    lay(fields[0], { y: 20, height: 40 }, 60);
    act(() => fields[0].input.onFocus());

    caretAt(55);
    expect(bottomOffset()).toBe(FIELD_GAP);

    caretAt(-5);
    expect(bottomOffset()).toBe(FIELD_GAP + 40);
  });

  it('adds Revert and Save once they appear under the focused input', () => {
    renderArea();
    lay(fields[0], { y: 20, height: 40 }, 60);
    act(() => fields[0].input.onFocus());
    caretAt(33);

    act(() => fields[0].block.onLayout(layout({ height: 100 }) as any));

    expect(bottomOffset()).toBe(FIELD_GAP + 7 + 40);
  });

  it('ignores the caret and layout of a field that is not focused', () => {
    renderArea();
    lay(fields[0], { y: 20, height: 40 }, 100);
    caretAt(33);
    expect(bottomOffset()).toBe(FIELD_GAP);
  });

  it('follows focus from one field to the next, and back to the gap on blur', () => {
    renderArea(2);
    lay(fields[0], { y: 20, height: 40 }, 100);
    lay(fields[1], { y: 20, height: 40 }, 60);
    act(() => fields[0].input.onFocus());
    expect(bottomOffset()).toBe(FIELD_GAP + 40);

    act(() => {
      fields[0].input.onBlur();
      fields[1].input.onFocus();
    });
    expect(bottomOffset()).toBe(FIELD_GAP);

    act(() => fields[1].input.onBlur());
    expect(bottomOffset()).toBe(FIELD_GAP);
  });

  it('takes a real settings field, Revert and Save included', () => {
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
    const input = screen.getByPlaceholderText('Project ID');
    // The block is the label's nearest ancestor with a layout handler; the input has its own.
    let block: any = screen.getByText('Project ID');
    while (!block.props.onLayout) block = block.parent;

    fireEvent(input, 'layout', layout({ y: 24, height: 40 }));
    fireEvent(block, 'layout', layout({ height: 64 }));
    fireEvent(input, 'focus');
    caretAt(33);
    expect(bottomOffset()).toBe(FIELD_GAP + 7);

    fireEvent.changeText(input, 'abcd');
    expect(screen.getByText('Save')).toBeTruthy();
    fireEvent(block, 'layout', layout({ height: 100 }));
    expect(bottomOffset()).toBe(FIELD_GAP + 7 + 36);

    fireEvent(input, 'blur');
    expect(bottomOffset()).toBe(FIELD_GAP);
  });

  it('a field outside any scroll area renders and hands its reach to no one', () => {
    render(<Probe index={0} />);
    expect(() => act(() => fields[0].input.onFocus())).not.toThrow();
  });
});
