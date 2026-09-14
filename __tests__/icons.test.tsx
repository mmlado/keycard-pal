import React from 'react';
import { render } from '@testing-library/react-native';

import { Icons } from '../src/assets/icons';

// Every Material Design Icons glyph is wrapped in a component that defaults its
// size and colour, so both the defaulted and the explicit path are exercised.
describe('Icons registry', () => {
  it('renders a glyph with its default size and colour', () => {
    const { toJSON } = render(<Icons.settings />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a glyph with an explicit size and colour', () => {
    const { toJSON } = render(
      <Icons.settings width={32} height={32} color="#FF6400" testID="icon" />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('exposes the nfc sub-icons', () => {
    expect(Icons.nfc.default).toBeTruthy();
    expect(Icons.nfc.success).toBeTruthy();
    expect(Icons.nfc.failure).toBeTruthy();
  });
});
