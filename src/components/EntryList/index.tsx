import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { IconComponent } from '@/assets/icons';
import {
  GenerationBoundRoute,
  isRouteHidden,
} from '@/navigation/generationBoundRoutes';
import theme from '@/theme';

import { MenuList } from '@/components/Menu';
import TileGrid, { gridMetrics } from '@/components/TileGrid';

import { usePreferences } from '@/hooks/usePreferences';

import { Generation } from '@/utils/cardGeneration';

export type EntryListItem = {
  label: string;
  /** Second line; shown only by the hero tile and by list rows. */
  detail?: string;
  icon: IconComponent;
  /** Marks a row that starts an NFC flow, per the app's NFC icon rule. */
  requiresNfc?: boolean;
  /** Set on an entry only some cards have; dropped when no ticked generation has it. */
  generationBoundRoute?: GenerationBoundRoute;
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

/** Runs first: testIDs, the hero tile and the grouped flag are all derived from what is left. */
function visibleGroups(
  groups: EntryListSection[],
  generationsInUse: Generation[],
): EntryListSection[] {
  return groups
    .map(group => ({
      ...group,
      entries: group.entries.filter(
        entry =>
          !entry.generationBoundRoute ||
          !isRouteHidden(entry.generationBoundRoute, generationsInUse),
      ),
    }))
    .filter(
      (group, index) =>
        group.entries.length > 0 || groups[index].entries.length === 0,
    );
}

/** Every navigation menu renders through this, so the layout setting applies everywhere. Owns the scroll container. */
export default function EntryList({ entries, sections, footer }: Props) {
  const { preferences } = usePreferences();
  const { width } = useWindowDimensions();

  const groups = visibleGroups(
    sections ?? [{ entries: entries ?? [] }],
    preferences.generationsInUse,
  );
  const list = preferences.dashboardLayout === 'list';
  const grouped = groups.length > 1;

  // A tile group's heading lines up with the tiles, whose margin varies by width.
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
