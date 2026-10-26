import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import TextInputSetting, {
  SAVE_FAILED,
} from '../src/components/settings/TextInputSetting';

const mockKeep = {
  block: { ref: { current: null }, onLayout: jest.fn() },
  input: { onFocus: jest.fn(), onBlur: jest.fn() },
};

jest.mock('../src/components/KeyboardAwareScrollView', () => ({
  useKeepAboveKeyboard: () => mockKeep,
}));

function renderField(
  props: Partial<React.ComponentProps<typeof TextInputSetting>> = {},
) {
  const onSave = jest.fn(async () => undefined);
  const view = render(
    <TextInputSetting
      label="Project ID"
      value="abc"
      placeholder="Enter WalletConnect Project ID"
      onSave={onSave}
      {...props}
    />,
  );
  return { ...view, onSave: (props.onSave as jest.Mock) ?? onSave };
}

const input = () =>
  screen.getByPlaceholderText('Enter WalletConnect Project ID');

beforeEach(() => jest.clearAllMocks());

describe('TextInputSetting', () => {
  it('shows the stored value and no buttons until it is edited', () => {
    renderField();
    expect(input().props.value).toBe('abc');
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Revert')).toBeNull();
  });

  it('offers Save and Revert for an edit, and Revert brings the stored value back', () => {
    renderField();
    fireEvent.changeText(input(), 'abcd');
    expect(screen.getByText('Save')).toBeTruthy();

    fireEvent.press(screen.getByText('Revert'));

    expect(input().props.value).toBe('abc');
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('counts an edit that only adds spaces as no edit', () => {
    renderField();
    fireEvent.changeText(input(), ' abc ');
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('saves the trimmed draft and takes the stored value afterwards', async () => {
    const { rerender, onSave } = renderField();
    fireEvent.changeText(input(), '  xyz ');
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });
    expect(onSave).toHaveBeenCalledWith('xyz');

    rerender(
      <TextInputSetting
        label="Project ID"
        value="xyz"
        placeholder="Enter WalletConnect Project ID"
        onSave={onSave}
      />,
    );
    expect(input().props.value).toBe('xyz');
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('shows the stored value after a save that stores what was already there', async () => {
    // The registry URL stores the default for an empty field.
    renderField({ value: 'https://default', onSave: jest.fn(async () => {}) });
    fireEvent.changeText(input(), '');
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });
    expect(input().props.value).toBe('https://default');
  });

  it('keeps the draft and shows the line a save returns', async () => {
    renderField({
      onSave: jest.fn(async () => 'Not an Ethereum mainnet endpoint.'),
    });
    fireEvent.changeText(input(), 'https://other');
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });
    expect(screen.getByText('Not an Ethereum mainnet endpoint.')).toBeTruthy();
    expect(input().props.value).toBe('https://other');

    fireEvent.changeText(input(), 'https://other2');
    expect(screen.queryByText('Not an Ethereum mainnet endpoint.')).toBeNull();
  });

  it('says a save failed when it throws, and keeps the draft', async () => {
    renderField({
      onSave: jest.fn(async () => {
        throw new Error('storage full');
      }),
    });
    fireEvent.changeText(input(), 'new-id');
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });
    expect(screen.getByText(SAVE_FAILED)).toBeTruthy();
    expect(input().props.value).toBe('new-id');
  });

  it('shows a spinner and locks the input while it saves', async () => {
    let finish: () => void = () => {};
    renderField({
      onSave: jest.fn(
        () =>
          new Promise<void>(resolve => {
            finish = resolve;
          }),
      ),
    });
    fireEvent.changeText(input(), 'slow');
    act(() => {
      fireEvent.press(screen.getByText('Save'));
    });
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Revert')).toBeNull();
    expect(input().props.editable).toBe(false);

    await act(async () => finish());
    expect(input().props.editable).toBe(true);
  });

  it('keeps Save off for an empty draft when a value is required', async () => {
    const { onSave } = renderField({ required: true });
    fireEvent.changeText(input(), '   ');
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('follows the stored value when it changes underneath', () => {
    const { rerender, onSave } = renderField({ value: '' });
    rerender(
      <TextInputSetting
        label="Project ID"
        value="https://default"
        placeholder="Enter WalletConnect Project ID"
        onSave={onSave}
      />,
    );
    expect(input().props.value).toBe('https://default');
  });

  it('hands its block and its input to the scroll area', () => {
    renderField();
    fireEvent(input(), 'focus');
    fireEvent(input(), 'blur');
    expect(mockKeep.input.onFocus).toHaveBeenCalledTimes(1);
    expect(mockKeep.input.onBlur).toHaveBeenCalledTimes(1);
  });
});
