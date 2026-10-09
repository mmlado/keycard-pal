import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { Icons } from '../src/assets/icons';
import theme from '../src/theme';

// Every Material Design Icons glyph is wrapped in a component that defaults its
// size and colour. Asserting the props the wrapper passes down catches a
// default that stops being applied, which a render-tree check would not.
describe('Icons registry', () => {
  it('passes its default size and colour to the glyph', () => {
    render(<Icons.settings testID="icon" />);

    const glyph = screen.getByTestId('icon');
    expect(glyph.props.name).toBe('cog-outline');
    expect(glyph.props.size).toBe(24);
    expect(glyph.props.color).toBe(theme.colors.onSurface);
  });

  it('passes an explicit size and colour through to the glyph', () => {
    render(
      <Icons.settings width={32} height={32} color="#FF6400" testID="icon" />,
    );

    const glyph = screen.getByTestId('icon');
    expect(glyph.props.size).toBe(32);
    expect(glyph.props.color).toBe('#FF6400');
  });

  it('exposes the nfc sub-icons', () => {
    expect(Icons.nfc.default).toBeTruthy();
    expect(Icons.nfc.success).toBeTruthy();
    expect(Icons.nfc.failure).toBeTruthy();
  });
});
