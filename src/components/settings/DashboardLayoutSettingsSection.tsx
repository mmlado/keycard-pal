import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { IconComponent, Icons } from '../../assets/icons';
import theme from '../../theme';

import { setDashboardLayout } from '../../hooks/useDashboardLayout';

import {
  DashboardLayout,
  loadDashboardLayout,
} from '../../storage/preferencesStorage';

type Option = {
  value: DashboardLayout;
  icon: IconComponent;
  label: string;
};

const OPTIONS: Option[] = [
  { value: 'tiles', icon: Icons.layoutTiles, label: 'Tiles' },
  { value: 'list', icon: Icons.layoutList, label: 'List' },
];

/**
 * Picks how every menu screen renders. The two icons are the control: each
 * draws the layout it selects, so the row needs no extra wording.
 */
export default function DashboardLayoutSettingsSection() {
  const [layout, setLayout] = useState<DashboardLayout>('tiles');
  // Counts selections so a late arrival cannot undo a newer one: the stored
  // value is dropped if the user already chose, and only the most recent save
  // may roll back.
  const selectionRef = useRef(0);

  useEffect(() => {
    let active = true;
    loadDashboardLayout().then(value => {
      if (active && selectionRef.current === 0) setLayout(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSelect = (value: DashboardLayout) => {
    const selection = ++selectionRef.current;
    const previous = layout;
    setLayout(value);
    setDashboardLayout(value).catch(() => {
      if (selectionRef.current === selection) setLayout(previous);
    });
  };

  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={styles.label}>
        Layout
      </Text>

      <View style={styles.segments}>
        {OPTIONS.map(({ value, icon: Icon, label }) => {
          const selected = layout === value;
          return (
            <Pressable
              key={value}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => handleSelect(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label} layout`}
              testID={`dashboard-layout-${value}`}
            >
              <Icon
                width={20}
                height={20}
                color={
                  selected
                    ? theme.colors.onSurface
                    : theme.colors.onSurfaceDisabled
                }
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: theme.colors.onSurface,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 12,
    padding: 2,
    gap: 2,
  },
  segment: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentSelected: {
    backgroundColor: theme.colors.primary,
  },
});
