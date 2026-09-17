import { StyleSheet, Text, View } from 'react-native';

import { Icons } from '@/assets/icons';
import { MinAppletVersionScreenProps } from '@/navigation/types';
import theme from '@/theme';

import EntryList, { EntryListItem } from '@/components/EntryList';

import { usePreferences } from '@/hooks/usePreferences';

import {
  effectiveMinGeneration,
  GENERATIONS,
  minGenerationLabel,
} from '@/utils/cardGeneration';

export const MIN_APPLET_VERSION_EXPLAINER =
  'Pick the oldest applet your Keycards run. Menu entries that only older ' +
  'cards have are hidden. Every supported Keycard keeps working whichever ' +
  'you pick.';

/**
 * Lets the user say how old their oldest Keycard is, so menus can drop what
 * only older cards have. One option per generation, not per applet release.
 */
export default function MinAppletVersionScreen({
  navigation,
}: MinAppletVersionScreenProps) {
  const { preferences, setPreference } = usePreferences();
  const current = effectiveMinGeneration(preferences.minGeneration);

  const entries: EntryListItem[] = GENERATIONS.map(({ generation }, index) => {
    const selected = generation === current;
    return {
      label: minGenerationLabel(generation),
      detail: index === 0 ? 'Shows every menu entry' : undefined,
      icon: selected ? Icons.optionSelected : Icons.optionUnselected,
      selected,
      onPress: () => {
        // The floor is stored as 'any', so it keeps meaning "hide nothing" if
        // the list of generations ever grows at the bottom.
        setPreference('minGeneration', index === 0 ? 'any' : generation);
        navigation.goBack();
      },
    };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.description}>{MIN_APPLET_VERSION_EXPLAINER}</Text>
      <EntryList entries={entries} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  description: {
    paddingHorizontal: 24,
    paddingTop: 16,
    color: theme.colors.onSurfaceMuted,
    fontSize: 13,
    lineHeight: 13 * 1.45,
  },
});
