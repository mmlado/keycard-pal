import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '@/assets/icons';
import theme from '@/theme';

import { usePreferences } from '@/hooks/usePreferences';

import { Generation, GENERATIONS } from '@/utils/cardGeneration';
import { resetLastTappedGeneration } from '@/utils/lastTappedGeneration';

export const KEYCARDS_IN_USE_EXPLAINER =
  'Tick the Keycards you use. Menu entries and extra taps that only other ' +
  'cards need are left out. Every supported Keycard keeps working whatever ' +
  'you tick. Or tap a card and let Keycard Pal tick it for you.';

type Props = {
  /** Starts the tap that reads a card; the screen owns the NFC session. */
  onSetFromCard: () => void;
  /** True while that tap is under way, so it cannot be started twice. */
  readingCard: boolean;
};

/**
 * The generations of the cards the user holds, one checkbox each. Checkboxes
 * rather than the switches the other rows use, because this is one choice of
 * several and not an on/off setting. The last one ticked cannot be unticked: an
 * empty selection says nothing about the user's cards.
 */
export default function KeycardsInUseSettingsSection({
  onSetFromCard,
  readingCard,
}: Props) {
  const { preferences, setPreference } = usePreferences();
  const inUse = preferences.generationsInUse;

  const toggle = (generation: Generation) => {
    const next = inUse.includes(generation)
      ? inUse.filter(ticked => ticked !== generation)
      : // Rebuilt from the table so the stored order never depends on the
        // order the boxes were ticked in.
        GENERATIONS.map(entry => entry.generation).filter(
          known => known === generation || inUse.includes(known),
        );
    if (next.length > 0) {
      setPreference('generationsInUse', next);
      // The user has just said which cards they use. A reminder about the
      // card they last tapped would now come from this edit, not from a tap.
      resetLastTappedGeneration();
    }
  };

  return (
    <View style={styles.section}>
      <Text variant="bodyMedium" style={styles.heading}>
        Keycards in use
      </Text>

      {GENERATIONS.map(({ generation, label }) => {
        const checked = inUse.includes(generation);
        const locked = checked && inUse.length === 1;
        const Icon = checked ? Icons.checkboxOn : Icons.checkboxOff;
        return (
          <Pressable
            key={generation}
            style={styles.row}
            onPress={() => toggle(generation)}
            disabled={locked}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: locked }}
            accessibilityLabel={`Applet ${label}`}
            testID={`keycards-in-use-${generation}`}
          >
            <Text variant="bodyMedium" style={styles.label}>
              Applet {label}
            </Text>
            <Icon
              width={24}
              height={24}
              color={
                locked
                  ? theme.colors.onSurfaceDisabled
                  : checked
                  ? theme.colors.primary
                  : theme.colors.onSurfaceMuted
              }
            />
          </Pressable>
        );
      })}

      <Pressable
        style={styles.row}
        onPress={onSetFromCard}
        disabled={readingCard}
        accessibilityRole="button"
        accessibilityState={{ disabled: readingCard }}
        accessibilityLabel="Set from my Keycard"
        testID="keycards-in-use-set-from-card"
      >
        <Text variant="bodyMedium" style={styles.label}>
          Set from my Keycard
        </Text>
        <Icons.nfcActivate
          width={20}
          height={20}
          color={theme.colors.primary}
          opacity={readingCard ? 0.25 : 0.5}
        />
      </Pressable>

      <Text style={styles.hint}>{KEYCARDS_IN_USE_EXPLAINER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  heading: {
    color: theme.colors.onSurfaceMuted,
  },
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
  hint: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 12,
  },
});
