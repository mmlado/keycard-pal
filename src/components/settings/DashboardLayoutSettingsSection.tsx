import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { IconComponent, Icons } from '../../assets/icons';
import theme from '../../theme';

import { usePreferences } from '../../hooks/usePreferences';

import { DashboardLayout } from '../../storage/preferencesStorage';

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
  const { preferences, setPreference } = usePreferences();
  const layout = preferences.dashboardLayout;

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
              onPress={() => setPreference('dashboardLayout', value)}
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
