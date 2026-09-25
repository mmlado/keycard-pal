import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '@/assets/icons';
import { DashboardAction, SecretsMenuScreenProps } from '@/navigation/types';
import theme from '@/theme';

import EntryList, { EntryListItem } from '@/components/EntryList';

export const dashboardEntry: DashboardAction = {
  label: 'Secrets',
  icon: Icons.secrets,
  navigate: nav => nav.navigate('SecretsMenu'),
};

export default function SecretsMenuScreen({
  navigation,
}: SecretsMenuScreenProps) {
  const insets = useSafeAreaInsets();
  const entries: EntryListItem[] = [
    {
      label: 'Change PIN',
      icon: Icons.pin,
      onPress: () => navigation.navigate('ChangeSecret', { secretType: 'pin' }),
    },
    {
      label: 'Change PUK',
      icon: Icons.puk,
      onPress: () => navigation.navigate('ChangeSecret', { secretType: 'puk' }),
    },
    {
      label: 'Change Pairing Secret',
      icon: Icons.pairingSecret,
      // Unlike PIN and PUK, this one reads the card as soon as it opens.
      requiresNfc: true,
      generationBoundRoute: 'ChangePairingSecret',
      onPress: () =>
        navigation.navigate('ChangeSecret', { secretType: 'pairing' }),
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
