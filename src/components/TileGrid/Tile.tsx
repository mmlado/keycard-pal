import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconComponent, Icons } from '@/assets/icons';
import theme from '@/theme';

export type TileEntry = {
  label: string;
  /** One-line secondary text; rendered only by the hero variant. */
  detail?: string;
  icon: IconComponent;
  /** Marks a tile that starts an NFC flow; draws the NFC badge. */
  requiresNfc?: boolean;
  onPress: () => void;
};

export type TileVariant = 'standard' | 'hero';

type Props = {
  entry: TileEntry;
  variant: TileVariant;
  testID: string;
};

export const TILE_ICON_SIZE = 32;

/**
 * Both variants share this, so a hero tile is exactly as tall as the row of
 * standard tiles beneath it and the grid keeps one rhythm.
 */
const TILE_MIN_HEIGHT = 112;

/**
 * One dashboard tile. `standard` stacks a 32 px icon over a two-line label;
 * `hero` is a full-width row (icon, label plus detail, chevron) used for the
 * first entry when the grid has an odd count.
 */
export default function Tile({ entry, variant, testID }: Props) {
  const { label, detail, icon: Icon, requiresNfc, onPress } = entry;
  const hero = variant === 'hero';
  const showDetail = hero && !!detail;

  // Same marker the list rows use, so an NFC action is recognisable in either
  // layout. A standard tile has no trailing row, so it sits in the corner.
  const nfcBadge = requiresNfc ? (
    <Icons.nfcActivate
      testID={`${testID}-nfc`}
      width={20}
      height={20}
      color={theme.colors.primary}
      opacity={0.5}
    />
  ) : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.tile,
        hero ? styles.hero : styles.standard,
        pressed && Platform.OS === 'ios' && styles.pressed,
      ]}
      android_ripple={{ color: theme.colors.ripple }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={showDetail ? `${label}. ${detail}` : label}
      testID={testID}
    >
      <Icon
        width={TILE_ICON_SIZE}
        height={TILE_ICON_SIZE}
        color={theme.colors.primary}
      />
      <View style={hero ? styles.heroText : undefined}>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
        {showDetail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {hero ? nfcBadge : null}
      {hero ? <Icons.chevronRight width={24} height={24} /> : null}
      {!hero && nfcBadge ? <View style={styles.badge}>{nfcBadge}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: theme.colors.surfaceList,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
  },
  standard: {
    flex: 1,
    minHeight: TILE_MIN_HEIGHT,
    justifyContent: 'space-between',
    gap: 8,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: TILE_MIN_HEIGHT,
  },
  heroText: {
    flex: 1,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontFamily: 'Inter_18pt-Medium',
    fontWeight: '500',
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.135,
    color: theme.colors.onSurface,
  },
  detail: {
    fontFamily: 'Inter_18pt-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.onSurfaceMuted,
    marginTop: 2,
  },
});
