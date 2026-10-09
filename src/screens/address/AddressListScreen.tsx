import { memo, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddressListScreenProps } from '../../navigation/types';
import theme from '../../theme';

import { Icons } from '../../assets/icons';
import AddressText from '../../components/AddressText';
import NFCBottomSheet from '../../components/NFCBottomSheet';

import {
  useAddressEnumeration,
  type AddressRow as AddressRowData,
} from '../../hooks/keycard/useAddressEnumeration';
import { useKeycardScreen } from '../../hooks/useKeycardScreen';

import { pubKeyToBtcAddress } from '../../utils/bitcoinAddress';
import { pubKeyToEthAddress } from '../../utils/ethereumAddress';
import { ACCOUNT_PATHS } from '../../utils/hdAddress';

const ADDR_FN = { eth: pubKeyToEthAddress, btc: pubKeyToBtcAddress };

type RowProps = {
  row: AddressRowData;
  onNavigate: (address: string, path: string) => void;
};

const AddressRow = memo(({ row, onNavigate }: RowProps) => (
  <Pressable
    style={styles.row}
    onPress={() => onNavigate(row.address, row.path)}
  >
    <AddressText address={row.address} style={styles.address} />
    <View style={styles.metaRow}>
      <Text style={styles.path}>{row.path}</Text>
      <Icons.qr width={16} height={16} color={theme.colors.onSurfaceVariant} />
    </View>
  </Pressable>
));

export default function AddressListScreen({
  route,
  navigation,
}: AddressListScreenProps) {
  const { coin } = route.params;
  const { rows, loading, loadMore, nfc } = useAddressEnumeration(
    ACCOUNT_PATHS[coin],
    ADDR_FN[coin],
  );
  const { start } = nfc;
  const insets = useSafeAreaInsets();

  const { onCancel } = useKeycardScreen({
    keycard: nfc,
    navigation,
    title: `${coin === 'eth' ? 'Ethereum' : 'Bitcoin'} Addresses`,
  });

  useEffect(() => {
    start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const keyExtractor = useCallback((row: AddressRowData) => row.path, []);

  const handleRowPress = useCallback(
    (address: string, derivationPath: string) =>
      navigation.navigate('AddressDetail', { address, derivationPath }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: AddressRowData }) => (
      <AddressRow row={item} onNavigate={handleRowPress} />
    ),
    [handleRowPress],
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={rows}
        keyExtractor={keyExtractor}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator
              style={styles.footer}
              color={theme.colors.primary}
            />
          ) : undefined
        }
        renderItem={renderItem}
      />

      <NFCBottomSheet nfc={nfc} onCancel={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  row: {
    padding: 12,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.surfaceVariant,
  },
  address: {
    color: theme.colors.onSurface,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  path: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  footer: { paddingVertical: 16 },
});
