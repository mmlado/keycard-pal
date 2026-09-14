import { StyleSheet, View } from 'react-native';

import { Icons } from '../../assets/icons';
import {
  DashboardAction,
  SecretsMenuScreenProps,
} from '../../navigation/types';
import theme from '../../theme';

import EntryList from '../../components/EntryList';

export const dashboardEntry: DashboardAction = {
  label: 'Secrets',
  icon: Icons.secrets,
  navigate: nav => nav.navigate('SecretsMenu'),
};

export default function SecretsMenuScreen({
  navigation,
}: SecretsMenuScreenProps) {
  const entries = [
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
      onPress: () =>
        navigation.navigate('ChangeSecret', { secretType: 'pairing' }),
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
