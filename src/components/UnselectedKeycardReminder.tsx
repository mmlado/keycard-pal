import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icons } from '@/assets/icons';
import theme from '@/theme';

import { usePreferences } from '@/hooks/usePreferences';

import { GENERATIONS, generationLabel } from '@/utils/cardGeneration';
import {
  getLastTappedGeneration,
  resetLastTappedGeneration,
  subscribeLastTappedGeneration,
} from '@/utils/lastTappedGeneration';

/** Shown after a tap of an unticked generation, never after an app update. Offers to tick it, or to stay quiet. */
export default function UnselectedKeycardReminder() {
  const { preferences, setPreference } = usePreferences();
  const tapped = useSyncExternalStore(
    subscribeLastTappedGeneration,
    getLastTappedGeneration,
  );

  const inUse = preferences.generationsInUse;
  const dismissed = preferences.generationRemindersDismissed;
  if (tapped === null || inUse.includes(tapped) || dismissed.includes(tapped)) {
    return null;
  }

  const label = generationLabel(tapped);
  // Rebuilt from the table, so the stored order is always table order.
  const inTableOrder = (wanted: readonly string[]) =>
    GENERATIONS.map(entry => entry.generation).filter(
      known => known === tapped || wanted.includes(known),
    );

  return (
    <View style={styles.card} testID="unselected-keycard-reminder">
      <View style={styles.header}>
        <Text style={styles.message}>
          You tapped a Keycard with applet {label}, which is turned off in
          Settings. Keycard Pal is set up for your other Keycards, so its menus
          and taps may not fit this one.
        </Text>
        <Pressable
          style={styles.close}
          onPress={() =>
            setPreference(
              'generationRemindersDismissed',
              inTableOrder(dismissed),
            )
          }
          hitSlop={8}
          testID="unselected-keycard-reminder-close"
          accessibilityRole="button"
          accessibilityLabel={`Do not remind me about applet ${label} Keycards`}
        >
          <Icons.close
            width={18}
            height={18}
            color={theme.colors.onSurfaceMuted}
          />
        </Pressable>
      </View>

      <Pressable
        style={styles.action}
        onPress={() => {
          setPreference('generationsInUse', inTableOrder(inUse));
          resetLastTappedGeneration();
        }}
        android_ripple={{ color: theme.colors.ripple }}
        accessibilityRole="button"
        testID="unselected-keycard-reminder-use"
      >
        <Text style={styles.actionLabel}>Use {label} Keycards</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceList,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  message: {
    flex: 1,
    color: theme.colors.onSurface,
    fontSize: 14,
    lineHeight: 20,
  },
  close: {
    paddingTop: 2,
  },
  action: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surfaceVariant,
  },
  actionLabel: {
    color: theme.colors.primary,
    fontFamily: 'Inter_18pt-Medium',
    fontWeight: '500',
    fontSize: 14,
  },
});
