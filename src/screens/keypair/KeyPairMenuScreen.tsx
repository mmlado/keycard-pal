import { StyleSheet, View } from 'react-native';

import { Icons } from '../../assets/icons';
import {
  DashboardAction,
  KeyPairMenuScreenProps,
} from '../../navigation/types';
import theme from '../../theme';

import EntryList from '../../components/EntryList';

export const dashboardEntry: DashboardAction = {
  label: 'Key pair',
  icon: Icons.key,
  navigate: nav => nav.navigate('KeyPairMenu'),
};

export default function KeyPairMenuScreen({
  navigation,
}: KeyPairMenuScreenProps) {
  // The two seed formats offer the same three actions, so the heading carries
  // the format and each label only has to say what the action does.
  const sections = [
    {
      title: 'BIP39',
      entries: [
        {
          label: 'Generate key pair',
          icon: Icons.keyGenerate,
          onPress: () => navigation.navigate('KeySize'),
        },
        {
          label: 'Import recovery phrase',
          icon: Icons.keyImport,
          onPress: () => navigation.navigate('Mnemonic'),
        },
        {
          label: 'Verify recovery phrase',
          icon: Icons.keyVerify,
          onPress: () => navigation.navigate('Mnemonic', { mode: 'verify' }),
        },
      ],
    },
    {
      title: 'SLIP39',
      entries: [
        {
          label: 'Generate shares',
          icon: Icons.sharesGenerate,
          onPress: () => navigation.navigate('Slip39', { mode: 'generate' }),
        },
        {
          label: 'Import shares',
          icon: Icons.sharesImport,
          onPress: () => navigation.navigate('Slip39', { mode: 'import' }),
        },
        {
          label: 'Verify shares',
          icon: Icons.sharesVerify,
          onPress: () => navigation.navigate('Slip39', { mode: 'verify' }),
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
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
