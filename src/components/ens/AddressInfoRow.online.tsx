import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import EnsAddressLabel from './EnsAddressLabel.online';
import InfoRow from '../InfoRow';

import { isDisplayAddress } from '../AddressText';
import theme from '../../theme';

export default function AddressInfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (isDisplayAddress(value)) {
    return (
      <View style={styles.infoRow}>
        <Text variant="bodySmall" style={styles.infoLabel}>
          {label}
        </Text>
        <EnsAddressLabel address={value} />
      </View>
    );
  }

  return <InfoRow label={label} value={value} />;
}

const styles = StyleSheet.create({
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    color: theme.colors.onSurfaceVariant,
  },
});
