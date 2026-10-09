import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import Tile, { TileEntry } from './Tile';

export type { TileEntry } from './Tile';

type Props = {
  entries: TileEntry[];
  /**
   * Prefix for every testID this grid emits. A grouped screen renders several
   * grids, and without this their ids would collide.
   */
  testIDPrefix?: string;
};

/** Below this width the grid tightens margin and gap to Material's 8 dp unit. */
export const SMALL_WIDTH = 360;
/** From this width (Material 3 medium window class) the grid is capped and centred. */
export const LARGE_WIDTH = 600;
/** Content width the grid never exceeds on wide screens. */
export const MAX_GRID_WIDTH = 480;

export type GridMetrics = {
  margin: number;
  gap: number;
  maxWidth?: number;
};

export function gridMetrics(width: number): GridMetrics {
  if (width < SMALL_WIDTH) {
    return { margin: 12, gap: 8 };
  }
  if (width >= LARGE_WIDTH) {
    const margin = 24;
    return { margin, gap: 12, maxWidth: MAX_GRID_WIDTH + 2 * margin };
  }
  return { margin: 16, gap: 12 };
}

/**
 * Two-column tile grid. An odd entry count would leave a dangling tile, so the
 * first entry is promoted to a full-width hero tile and the rest pair up.
 */
export default function TileGrid({ entries, testIDPrefix = 'tile' }: Props) {
  const { width } = useWindowDimensions();
  const { margin, gap, maxWidth } = gridMetrics(width);

  const hero = entries.length % 2 === 1 ? entries[0] : null;
  const rest = hero ? entries.slice(1) : entries;
  const rows: TileEntry[][] = [];
  for (let i = 0; i < rest.length; i += 2) {
    rows.push(rest.slice(i, i + 2));
  }

  return (
    <View
      style={[styles.grid, { paddingHorizontal: margin, gap, maxWidth }]}
      testID={`${testIDPrefix}-grid`}
    >
      {hero ? (
        <Tile entry={hero} variant="hero" testID={`${testIDPrefix}-hero`} />
      ) : null}
      {rows.map((row, r) => (
        <View key={r} style={[styles.row, { gap }]}>
          {row.map((entry, c) => (
            <Tile
              key={`${r}-${c}`}
              entry={entry}
              variant="standard"
              testID={`${testIDPrefix}-${r * 2 + c}`}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
  },
});
