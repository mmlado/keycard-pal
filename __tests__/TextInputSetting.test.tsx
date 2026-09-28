import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import TextInputSetting from '../src/components/settings/TextInputSetting';
import { FieldFocusContext } from '../src/components/settings/fieldFocus';

function renderField(onFieldFocus: jest.Mock) {
  return render(
    <FieldFocusContext.Provider value={onFieldFocus}>
      <TextInputSetting
        label="Project ID"
        value="abc"
        dirty={false}
        placeholder="Enter WalletConnect Project ID"
        onChangeText={jest.fn()}
        onSave={jest.fn()}
      />
    </FieldFocusContext.Provider>,
  );
}

describe('TextInputSetting', () => {
  // The screen owns the ScrollView, so it is the only one that can scroll a
  // focused field clear of the keyboard: the field has to hand itself over.
  it('hands its input to the field-focus context on focus', () => {
    const onFieldFocus = jest.fn();
    renderField(onFieldFocus);

    fireEvent(
      screen.getByPlaceholderText('Enter WalletConnect Project ID'),
      'focus',
    );

    expect(onFieldFocus).toHaveBeenCalledTimes(1);
    expect(onFieldFocus.mock.calls[0][0]).toBeTruthy();
  });

  it('renders without a provider', () => {
    render(
      <TextInputSetting
        label="Project ID"
        value="abc"
        dirty={false}
        onChangeText={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(screen.getByDisplayValue('abc')).toBeTruthy();
  });
});
