import { useCallback, useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AddressDetailScreenProps } from '../../navigation/types';
import theme from '../../theme';

import { Icons } from '../../assets/icons';
import EnsAddressLabel from '../../components/ens/EnsAddressLabel.online';
import PrimaryButton from '../../components/PrimaryButton';

export default function AddressDetailScreen({
  route,
  navigation,
}: AddressDetailScreenProps) {
  const { address, derivationPath, title } = route.params;
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({ title: title ?? 'Address' });
  }, [navigation, title]);

  const handleCopy = useCallback(() => {
    Clipboard.setString(address);
  }, [address]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.qrContainer}>
        <View style={styles.qrWrapper}>
          <QRCode
            value={address}
            size={280}
            color="#000000"
            backgroundColor="#ffffff"
          />
        </View>
        <EnsAddressLabel address={address} />
        {derivationPath ? (
          <Text style={styles.path}>{derivationPath}</Text>
        ) : null}
      </View>
      <PrimaryButton
        label="Copy Address"
        onPress={handleCopy}
        icon={Icons.copy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 24,
  },
  qrContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  path: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: 'monospace',
    fontSize: 12,
  },
});
