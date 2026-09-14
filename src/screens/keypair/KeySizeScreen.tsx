import { StyleSheet, View } from 'react-native';

import { Icons } from '../../assets/icons';
import { KeySizeScreenProps } from '../../navigation/types';
import theme from '../../theme';

import EntryList from '../../components/EntryList';

export default function KeySizeScreen({ navigation }: KeySizeScreenProps) {
  // Icon marks the phrase length; the label carries the passphrase variant.
  const entries = [
    {
      label: '12 word',
      icon: Icons.phraseShort,
      onPress: () =>
        navigation.navigate('GenerateKey', {
          size: 12,
        }),
    },
    {
      label: '12 word + passphrase',
      icon: Icons.phraseShort,
      onPress: () =>
        navigation.navigate('GenerateKey', {
          size: 12,
          passphrase: true,
        }),
    },
    {
      label: '24 word',
      icon: Icons.phraseLong,
      onPress: () =>
        navigation.navigate('GenerateKey', {
          size: 24,
        }),
    },
    {
      label: '24 word + passphrase',
      icon: Icons.phraseLong,
      onPress: () =>
        navigation.navigate('GenerateKey', {
          size: 24,
          passphrase: true,
        }),
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
