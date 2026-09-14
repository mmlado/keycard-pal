import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { IconComponent } from '@/assets/icons';
import theme from '@/theme';

import { MenuList } from '@/components/Menu';
import TileGrid, { gridMetrics } from '@/components/TileGrid';

import { useDashboardLayout } from '@/hooks/useDashboardLayout';

export type EntryListItem = {
  label: string;
  /** Second line; shown only by the hero tile and by list rows. */
  detail?: string;
  icon: IconComponent;
  /** Marks a row that starts an NFC flow, per the app's NFC icon rule. */
  requiresNfc?: boolean;
  onPress: () => void;
};

export type EntryListSection = {
  /** Heading above the group; omit for a single unlabelled group. */
  title?: string;
  entries: EntryListItem[];
};

type Props = {
  entries?: EntryListItem[];
  /** Use instead of `entries` to break the screen into labelled groups. */
  sections?: EntryListSection[];
  /** Rendered after the entries, inside the scroll area. */
  footer?: React.ReactNode;
};

/**
 * Renders a screen's destinations in whichever layout the user picked. Every
 * navigation menu goes through this rather than choosing a component itself,
 * so the setting cannot apply to some screens and not others.
 *
 * This owns the scroll container for both layouts, because a grouped screen
 * renders several lists or grids and they have to scroll as one.
 */
export default function EntryList({ entries, sections, footer }: Props) {
  const { layout, loaded } = useDashboardLayout();
  const { width } = useWindowDimensions();

  // Hold the space until the preference is in, so nothing flashes the wrong
  // layout and anything anchored below does not jump.
  if (!loaded) {
    return <View style={styles.fill} />;
  }

  const groups: EntryListSection[] = sections ?? [{ entries: entries ?? [] }];
  const list = layout === 'list';
  const grouped = groups.length > 1;

  // A tile group's heading has to line up with the tiles, whose margin varies
  // by screen width; a list group's card is already inset by the padding.
  const titleInset = list ? undefined : gridMetrics(width).margin;

  let offset = 0;

  return (
    <ScrollView
      style={list ? styles.listScroll : styles.fill}
      contentContainerStyle={list ? styles.listContent : styles.tileContent}
    >
      {groups.map((group, index) => {
        const indexOffset = offset;
        offset += group.entries.length;

        return (
          <View key={group.title ?? index} style={styles.group}>
            {group.title ? (
              <Text style={[styles.title, { paddingHorizontal: titleInset }]}>
                {group.title}
              </Text>
            ) : null}

            {list ? (
              <MenuList entries={group.entries} indexOffset={indexOffset} />
            ) : (
              <TileGrid
                entries={group.entries}
                testIDPrefix={grouped ? `tile-s${index}` : 'tile'}
              />
            )}
          </View>
        );
      })}

      {footer}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  listScroll: {
    flex: 1,
    marginHorizontal: '3%',
  },
  listContent: {
    padding: 16,
    gap: 20,
    alignItems: 'center',
  },
  tileContent: {
    paddingVertical: 16,
    gap: 20,
  },
  group: {
    width: '100%',
    gap: 8,
  },
  title: {
    fontFamily: 'Inter_18pt-SemiBold',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceMuted,
  },
});
