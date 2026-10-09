import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '../../assets/icons';
import {
  AddressMenuScreenProps,
  DashboardAction,
} from '../../navigation/types';
import theme from '../../theme';

import EntryList from '../../components/EntryList';

export const dashboardEntry: DashboardAction = {
  label: 'Addresses',
  icon: Icons.addresses,
  navigate: nav => nav.navigate('AddressMenu'),
};

export default function AddressesMenuScreen({
  navigation,
}: AddressMenuScreenProps) {
  const insets = useSafeAreaInsets();

  const entries = [
    {
      label: 'Ethereum',
      icon: Icons.ethereum,
      requiresNfc: true,
      onPress: () => navigation.navigate('AddressList', { coin: 'eth' }),
    },
    {
      label: 'Bitcoin',
      icon: Icons.bitcoin,
      requiresNfc: true,
      onPress: () => navigation.navigate('AddressList', { coin: 'btc' }),
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
