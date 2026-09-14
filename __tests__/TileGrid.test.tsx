import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import TileGrid, {
  gridMetrics,
  LARGE_WIDTH,
  MAX_GRID_WIDTH,
  SMALL_WIDTH,
  TileEntry,
} from '../src/components/TileGrid';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

let mockWidth = 400;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 800, scale: 2, fontScale: 1 }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Renders a marker rather than null, so a tile that stopped drawing its icon
// would fail rather than pass silently.
const Icon = (props: any) => <View {...props} testID="entry-icon" />;

function entry(label: string, onPress = jest.fn(), detail?: string): TileEntry {
  return { label, detail, icon: Icon, onPress };
}

function nfcEntry(label: string): TileEntry {
  return { label, icon: Icon, requiresNfc: true, onPress: jest.fn() };
}

// The grid's style prop is an array of a registered style and an inline object.
function gridStyle(): Record<string, any> {
  const style = screen.getByTestId('tile-grid').props.style;
  return StyleSheet.flatten(style) ?? {};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('gridMetrics', () => {
  it('tightens margin and gap below the small breakpoint', () => {
    expect(gridMetrics(SMALL_WIDTH - 1)).toEqual({ margin: 12, gap: 8 });
    expect(gridMetrics(320)).toEqual({ margin: 12, gap: 8 });
  });

  it('uses the standard phone margin between the breakpoints', () => {
    expect(gridMetrics(SMALL_WIDTH)).toEqual({ margin: 16, gap: 12 });
    expect(gridMetrics(LARGE_WIDTH - 1)).toEqual({ margin: 16, gap: 12 });
  });

  it('caps and widens the margin from the large breakpoint', () => {
    expect(gridMetrics(LARGE_WIDTH)).toEqual({
      margin: 24,
      gap: 12,
      maxWidth: MAX_GRID_WIDTH + 48,
    });
  });
});

describe('TileGrid', () => {
  beforeEach(() => {
    mockWidth = 400;
  });

  describe('layout', () => {
    it('promotes the first entry to a hero tile when the count is odd', () => {
      render(
        <TileGrid entries={[entry('One'), entry('Two'), entry('Three')]} />,
      );
      expect(screen.getByTestId('tile-hero')).toBeTruthy();
      expect(screen.getByTestId('tile-0')).toBeTruthy();
      expect(screen.getByTestId('tile-1')).toBeTruthy();
      expect(screen.queryByTestId('tile-2')).toBeNull();
    });

    it('renders pairs with no hero tile when the count is even', () => {
      render(
        <TileGrid
          entries={[entry('One'), entry('Two'), entry('Three'), entry('Four')]}
        />,
      );
      expect(screen.queryByTestId('tile-hero')).toBeNull();
      expect(screen.getByTestId('tile-3')).toBeTruthy();
    });

    it('renders nothing but the container for an empty list', () => {
      render(<TileGrid entries={[]} />);
      expect(screen.getByTestId('tile-grid')).toBeTruthy();
      expect(screen.queryByTestId('tile-hero')).toBeNull();
      expect(screen.queryByTestId('tile-0')).toBeNull();
    });

    it('renders every label', () => {
      render(<TileGrid entries={[entry('One'), entry('Two')]} />);
      expect(screen.getByText('One')).toBeTruthy();
      expect(screen.getByText('Two')).toBeTruthy();
    });

    it('draws the entry icon on both tile variants', () => {
      render(
        <TileGrid entries={[entry('One'), entry('Two'), entry('Three')]} />,
      );

      // One hero plus two standard tiles, each with its own icon.
      const icons = screen.getAllByTestId('entry-icon');
      expect(icons).toHaveLength(3);
      expect(icons[0].props.width).toBe(32);
    });

    // The hero spans the full width, so it has to stand exactly one standard
    // row tall or the grid loses its rhythm.
    it('gives the hero tile the same minimum height as a standard tile', () => {
      render(
        <TileGrid entries={[entry('One'), entry('Two'), entry('Three')]} />,
      );
      const hero = StyleSheet.flatten(
        screen.getByTestId('tile-hero').props.style,
      );
      const standard = StyleSheet.flatten(
        screen.getByTestId('tile-0').props.style,
      );
      expect(hero.minHeight).toBe(112);
      expect(hero.minHeight).toBe(standard.minHeight);
    });
  });

  describe('detail line', () => {
    it('shows the detail on a hero tile', () => {
      render(<TileGrid entries={[entry('Only', jest.fn(), 'Some detail')]} />);
      expect(screen.getByText('Some detail')).toBeTruthy();
    });

    it('ignores the detail on a standard tile', () => {
      render(
        <TileGrid
          entries={[entry('One', jest.fn(), 'Hidden'), entry('Two')]}
        />,
      );
      expect(screen.queryByText('Hidden')).toBeNull();
    });

    it('reads the detail out with the label on a hero tile', () => {
      render(<TileGrid entries={[entry('Only', jest.fn(), 'Some detail')]} />);
      expect(screen.getByTestId('tile-hero').props.accessibilityLabel).toBe(
        'Only. Some detail',
      );
    });

    it('reads out only the label on a standard tile', () => {
      render(<TileGrid entries={[entry('One'), entry('Two')]} />);
      expect(screen.getByTestId('tile-0').props.accessibilityLabel).toBe('One');
    });
  });

  // An action that starts an NFC flow has to be marked in either layout, not
  // just in the list rows.
  describe('NFC badge', () => {
    it('marks a standard tile that starts an NFC flow', () => {
      render(<TileGrid entries={[nfcEntry('One'), entry('Two')]} />);
      expect(screen.getByTestId('tile-0-nfc')).toBeTruthy();
      expect(screen.queryByTestId('tile-1-nfc')).toBeNull();
    });

    it('marks a hero tile that starts an NFC flow', () => {
      render(<TileGrid entries={[nfcEntry('Only')]} />);
      expect(screen.getByTestId('tile-hero-nfc')).toBeTruthy();
    });

    it('leaves tiles unmarked when no NFC is involved', () => {
      render(<TileGrid entries={[entry('One'), entry('Two')]} />);
      expect(screen.queryByTestId('tile-0-nfc')).toBeNull();
      expect(screen.queryByTestId('tile-1-nfc')).toBeNull();
    });
  });

  describe('press handling', () => {
    it('calls the pressed tile handler only', () => {
      const first = jest.fn();
      const second = jest.fn();
      render(
        <TileGrid entries={[entry('One', first), entry('Two', second)]} />,
      );
      fireEvent.press(screen.getByTestId('tile-1'));
      expect(second).toHaveBeenCalledTimes(1);
      expect(first).not.toHaveBeenCalled();
    });

    it('calls the hero handler when the hero tile is pressed', () => {
      const hero = jest.fn();
      render(<TileGrid entries={[entry('Only', hero)]} />);
      fireEvent.press(screen.getByTestId('tile-hero'));
      expect(hero).toHaveBeenCalledTimes(1);
    });

    it('marks tiles as buttons', () => {
      render(<TileGrid entries={[entry('One'), entry('Two')]} />);
      expect(screen.getByTestId('tile-0').props.accessibilityRole).toBe(
        'button',
      );
    });
  });

  // Tile's iOS press-dim (`pressed && Platform.OS === 'ios'`) is not covered:
  // RNTL's pressIn event does not flip Pressable's internal pressed state, so
  // the style callback never re-resolves with pressed: true.
  describe('breakpoints', () => {
    it('applies the tight metrics on a narrow screen', () => {
      mockWidth = 320;
      render(<TileGrid entries={[entry('One'), entry('Two')]} />);
      const style = gridStyle();
      expect(style.paddingHorizontal).toBe(12);
      expect(style.gap).toBe(8);
      expect(style.maxWidth).toBeUndefined();
    });

    it('applies the standard phone metrics', () => {
      mockWidth = 400;
      render(<TileGrid entries={[entry('One'), entry('Two')]} />);
      const style = gridStyle();
      expect(style.paddingHorizontal).toBe(16);
      expect(style.gap).toBe(12);
      expect(style.maxWidth).toBeUndefined();
    });

    it('caps the width on a large screen', () => {
      mockWidth = 800;
      render(<TileGrid entries={[entry('One'), entry('Two')]} />);
      const style = gridStyle();
      expect(style.paddingHorizontal).toBe(24);
      expect(style.maxWidth).toBe(MAX_GRID_WIDTH + 48);
    });
  });
});
