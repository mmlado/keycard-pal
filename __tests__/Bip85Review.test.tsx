import React from 'react';
import { StyleSheet } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';

import Bip85Review, {
  BIP85_INVALID_KEY,
  BIP85_RESULT_EXPLAINER,
} from '../src/components/Bip85Review';
import type { Bip85Format } from '../src/utils/bip85';

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

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

jest.mock('@react-native-community/blur', () => ({
  BlurView: 'BlurView',
}));

const onDone = jest.fn();

function renderReview(format: Bip85Format, entropy: Uint8Array, index = 0) {
  return render(
    <Bip85Review
      format={format}
      index={index}
      entropy={entropy}
      onDone={onDone}
    />,
  );
}

async function reveal() {
  await act(async () => {
    fireEvent.press(screen.getByText('Reveal'));
  });
}

const hidden = { includeHiddenElements: true };

describe('Bip85Review', () => {
  beforeEach(() => {
    onDone.mockClear();
  });

  it('keeps its button above the bottom inset in the bottom action area', () => {
    renderReview('words12', new Uint8Array(16));
    expect(
      within(screen.getByTestId('bottom-action-area')).getByText('Reveal'),
    ).toBeTruthy();
  });

  describe('recovery phrase', () => {
    // Sixteen zero bytes are the all-"abandon" phrase that ends in "about".
    const entropy = new Uint8Array(16);

    it('keeps the words from sight and from a screen reader until revealed', async () => {
      renderReview('words12', entropy);
      expect(screen.getByText(BIP85_RESULT_EXPLAINER)).toBeTruthy();
      expect(screen.queryByText('about')).toBeNull();
      expect(
        screen.getByLabelText('12-word BIP39 phrase hidden. Reveal shows it.'),
      ).toBeTruthy();
      expect(screen.UNSAFE_queryAllByType('BlurView' as any)).toHaveLength(1);

      await reveal();

      expect(screen.getByText('about')).toBeTruthy();
      expect(screen.UNSAFE_queryAllByType('BlurView' as any)).toHaveLength(0);
    });

    it('numbers the words across two columns', () => {
      renderReview('words12', entropy);
      expect(screen.getAllByText('abandon', hidden)).toHaveLength(11);
      expect(screen.getByText('1.', hidden)).toBeTruthy();
      expect(screen.getByText('12.', hidden)).toBeTruthy();
    });
  });

  describe('text', () => {
    it('shows a password as one block that cannot be selected', async () => {
      renderReview('password', new Uint8Array(64));
      await reveal();
      const secret = screen.getByTestId('bip85-secret');
      expect(secret.props.children).toBe('A'.repeat(21));
      expect(secret.props.selectable).toBeFalsy();
    });

    it('shows hex as it came from the card', async () => {
      renderReview('hex32', new Uint8Array(32).fill(0xab));
      await reveal();
      expect(screen.getByTestId('bip85-secret').props.children).toBe(
        'ab'.repeat(32),
      );
    });
  });

  it('shows the path, outside the blur', () => {
    renderReview('xprv', new Uint8Array(64).fill(1), 7);
    expect(screen.getByText("m/83696968'/32'/7'")).toBeTruthy();
  });

  // iOS has no font named monospace, and a password's I, l, 1, O and 0 must stay apart.
  it('sets the secret and the path in a monospace font that iOS has', async () => {
    renderReview('password', new Uint8Array(64));
    await reveal();
    const fontOf = (element: { props: { style: unknown } }) =>
      StyleSheet.flatten(element.props.style as any).fontFamily;
    expect(fontOf(screen.getByTestId('bip85-secret'))).toBe('ui-monospace');
    expect(fontOf(screen.getByText("m/83696968'/707764'/21'/0'"))).toBe(
      'ui-monospace',
    );
  });

  it('leaves on Done', async () => {
    renderReview('words12', new Uint8Array(16));
    await reveal();
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByText('Done'));
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // BIP85: such bytes are no key, and the user moves on to the next index.
  it('asks for the next index when the bytes are no key', async () => {
    renderReview('wif', new Uint8Array(32));
    expect(screen.getByText(BIP85_INVALID_KEY)).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType('BlurView' as any)).toHaveLength(0);
    expect(screen.queryByText('Reveal')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByText('Done'));
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
