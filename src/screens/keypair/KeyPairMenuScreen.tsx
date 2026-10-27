import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyPairMenuScreenProps } from '@/navigation/types';
import theme from '@/theme';

import { Icons } from '@/assets/icons';
import EntryList from '@/components/EntryList';

export default function KeyPairMenuScreen({
  navigation,
}: KeyPairMenuScreenProps) {
  const insets = useSafeAreaInsets();
  // The heading carries the seed format, so each label only says what the action does.
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
