import { StyleSheet, Text, View } from 'react-native';

import AddressText from '../AddressText';
import EnsErrorRow from './EnsErrorRow';

import { useEnsName } from '../../hooks/ens/useEnsName.online';
import theme from '../../theme';

export default function EnsAddressLabel({ address }: { address: string }) {
  const { name, error, retry } = useEnsName(address);

  if (name) {
    return (
      <View style={styles.container}>
        <Text style={styles.ensName}>{name}</Text>
        <AddressText address={address} style={styles.address} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <AddressText address={address} style={styles.address} />
        <EnsErrorRow onRetry={retry} />
      </View>
    );
  }

  if (name === '') {
    return (
      <View style={styles.container}>
        <AddressText address={address} style={styles.address} />
        <Text style={styles.noEns}>no ens</Text>
      </View>
    );
  }

  return <AddressText address={address} style={styles.address} />;
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  ensName: {
    fontFamily: 'Inter_18pt-Medium',
    fontSize: 15,
    color: theme.colors.onSurface,
  },
  address: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: theme.colors.onSurface,
  },
  noEns: {
    fontFamily: 'Inter_18pt-Regular',
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
});
