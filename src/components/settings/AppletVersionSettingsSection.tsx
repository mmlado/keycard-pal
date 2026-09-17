import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '@/assets/icons';
import theme from '@/theme';

import { usePreferences } from '@/hooks/usePreferences';

import { minGenerationLabel } from '@/utils/cardGeneration';

type Props = {
  /** Opens the screen that picks the value; this row only shows it. */
  onPress: () => void;
};

/**
 * Shows the oldest applet the user's Keycards run and opens the picker. The
 * choice needs words and grows with every generation, so it is a screen of its
 * own rather than an inline control like the layout picker.
 */
export default function AppletVersionSettingsSection({ onPress }: Props) {
  const { preferences } = usePreferences();
  const value = minGenerationLabel(preferences.minGeneration);

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Keycard applet version, ${value}`}
      testID="settings-applet-version"
    >
      <Text variant="bodyMedium" style={styles.label}>
        Keycard applet version
      </Text>
      <View style={styles.value}>
        <Text variant="bodyMedium" style={styles.valueText}>
          {value}
        </Text>
        <Icons.chevronRight
          width={20}
          height={20}
          color={theme.colors.onSurfaceMuted}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    // Matches the height of the Switch in SettingsToggleRow.
    minHeight: 31,
  },
  label: {
    color: theme.colors.onSurface,
  },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valueText: {
    color: theme.colors.onSurfaceMuted,
  },
});
