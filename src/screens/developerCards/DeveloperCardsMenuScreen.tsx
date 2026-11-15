import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '@/assets/icons';
import {
  LOCK_INSTALLS_TITLE,
  UNLOCK_INSTALLS_TITLE,
} from '@/constants/installLock';
import { DeveloperCardsMenuScreenProps } from '@/navigation/types';
import theme from '@/theme';

import EntryList, { EntryListItem } from '@/components/EntryList';

export default function DeveloperCardsMenuScreen({
  navigation,
}: DeveloperCardsMenuScreenProps) {
  const insets = useSafeAreaInsets();
  const entries: EntryListItem[] = [
    {
      label: LOCK_INSTALLS_TITLE,
      icon: Icons.lockInstalls,
      requiresNfc: true,
      generationBoundRoute: 'InstallLock',
      onPress: () => navigation.navigate('LockInstalls'),
    },
    {
      label: UNLOCK_INSTALLS_TITLE,
      icon: Icons.unlockInstalls,
      requiresNfc: true,
      generationBoundRoute: 'InstallLock',
      onPress: () => navigation.navigate('UnlockInstalls'),
    },
  ];

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <EntryList entries={entries} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
