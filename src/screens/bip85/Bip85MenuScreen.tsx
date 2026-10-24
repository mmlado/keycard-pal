import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bip85MenuScreenProps } from '@/navigation/types';
import theme from '@/theme';

import EntryList, { EntryListSection } from '@/components/EntryList';

import { BIP85_FORMATS, bip85Format } from '@/utils/bip85';

export default function Bip85MenuScreen({ navigation }: Bip85MenuScreenProps) {
  const insets = useSafeAreaInsets();
  const sections: EntryListSection[] = [];
  for (const format of BIP85_FORMATS) {
    const { section, label, icon } = bip85Format(format);
    const entry = {
      label,
      icon,
      onPress: () => navigation.navigate('Bip85', { format }),
    };
    const last = sections[sections.length - 1];
    if (last?.title === section) {
      last.entries.push(entry);
    } else {
      sections.push({ title: section, entries: [entry] });
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <EntryList sections={sections} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
