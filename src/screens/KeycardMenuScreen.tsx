import { StyleSheet, View } from 'react-native';

import { Icons } from '@/assets/icons';
import { DashboardAction, KeycardMenuScreenProps } from '@/navigation/types';
import theme from '@/theme';

import EntryList, { EntryListItem } from '@/components/EntryList';

export const dashboardEntry: DashboardAction = {
  label: 'Keycard',
  icon: Icons.keycard,
  navigate: nav => nav.navigate('KeycardMenu'),
};

export default function KeycardMenuScreen({
  navigation,
}: KeycardMenuScreenProps) {
  const entries: EntryListItem[] = [
    {
      label: 'Initialize',
      icon: Icons.cardInit,
      requiresNfc: true,
      onPress: () => navigation.navigate('InitCard'),
    },
    {
      label: 'Key pair',
      icon: Icons.key,
      onPress: () => navigation.navigate('KeyPairMenu'),
    },
    {
      label: 'Set card name',
      icon: Icons.cardName,
      onPress: () => navigation.navigate('SetCardName'),
    },
    {
      label: 'Secrets',
      icon: Icons.secrets,
      onPress: () => navigation.navigate('SecretsMenu'),
    },
    {
      label: 'Manage pairing slots',
      icon: Icons.pairingSlots,
      requiresNfc: true,
      generationBoundRoute: 'PairingSlots',
      onPress: () => navigation.navigate('PairingSlots'),
    },
    {
      label: 'Factory reset',
      icon: Icons.factoryReset,
      onPress: () => navigation.navigate('FactoryReset'),
    },
  ];

  return (
    <View style={styles.container}>
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
