import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconComponent, Icons } from '../assets/icons';
import theme from '../theme';

export type Entry = {
  label: string;
  onPress: () => void;
  icon?: IconComponent;
  requiresNfc?: boolean;
  detail?: string;
};

type ListProps = {
  entries: Entry[];
  /**
   * Added to the testIDs of each row's icon and NFC indicator. A grouped
   * screen renders several lists, and without this their ids would restart at
   * 0 and collide. A row itself carries no testID; reach it by its label.
   */
  indexOffset?: number;
};

/** The rows themselves, with no scroll container of their own. */
export function MenuList({ entries, indexOffset = 0 }: ListProps) {
  return (
    <View style={styles.list}>
      {entries.map((action, i) => {
        const Icon = action.icon;
        const id = indexOffset + i;
        return (
          <Pressable
            style={[styles.item, i < entries.length - 1 && styles.itemBorder]}
            key={i}
            onPress={action.onPress}
          >
            <View style={styles.labelRow}>
              {Icon ? (
                <Icon
                  testID={`menu-icon-${id}`}
                  width={24}
                  height={24}
                  color={theme.colors.onSurfaceVariant}
                />
              ) : null}
              <Text
                style={styles.itemLabel}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {action.label}
              </Text>
              {action.detail ? (
                <Text
                  style={styles.itemDetail}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {action.detail}
                </Text>
              ) : null}
            </View>
            <View style={styles.trailingIcons}>
              {action.requiresNfc ? (
                <Icons.nfcActivate
                  testID={`menu-nfc-indicator-${id}`}
                  width={20}
                  height={20}
                  color={theme.colors.primary}
                  opacity={0.5}
                />
              ) : null}
              <Icons.chevronRight width={24} height={24} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A self-scrolling single list. Menu screens go through EntryList instead;
 * this remains for screens that are not navigation menus (PairingSlotsScreen).
 */
export default function Menu({ entries }: { entries: Entry[] }) {
  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      <MenuList entries={entries} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    marginHorizontal: '3%',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  list: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceList,
    width: '100%',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 12,
    paddingLeft: 16,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surface,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 12,
  },
  itemLabel: {
    fontFamily: 'Inter_18pt-Medium',
    fontWeight: '500',
    fontSize: 15,
    lineHeight: 15 * 1.45,
    letterSpacing: -0.135,
    color: theme.colors.onSurface,
    flexShrink: 1,
  },
  itemDetail: {
    fontFamily: 'Inter_18pt-Regular',
    fontSize: 13,
    lineHeight: 13 * 1.45,
    color: theme.colors.onSurfaceMuted,
    flexShrink: 1,
  },
  trailingIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
