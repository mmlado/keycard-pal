import { FlatList, Pressable, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  RadioButton,
  Text,
} from 'react-native-paper';
import { EdgeInsets } from 'react-native-safe-area-context';

import theme from '@/theme';
import AddressText from '@/components/AddressText';
import PrimaryButton from '@/components/PrimaryButton';
import type { AddressRow } from '@/hooks/keycard/useAddressEnumeration';

import styles from './styles';

export default function AddressSelectionPhase({
  rows,
  selectedRow,
  loading,
  insets,
  onSelect,
  onLoadMore,
  onConnect,
  onCancel,
}: {
  rows: AddressRow[];
  selectedRow: AddressRow | null;
  loading: boolean;
  insets: EdgeInsets;
  onSelect: (row: AddressRow) => void;
  onLoadMore: () => void;
  onConnect: () => void;
  onCancel: () => void;
}) {
  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Select address
      </Text>
      <FlatList
        data={rows}
        keyExtractor={item => item.path}
        style={styles.list}
        renderItem={({ item, index }) => (
          <Pressable style={styles.addrRow} onPress={() => onSelect(item)}>
            <RadioButton.Android
              value={item.address}
              status={selectedRow?.path === item.path ? 'checked' : 'unchecked'}
              onPress={() => onSelect(item)}
              color={theme.colors.primary}
            />
            <Text style={styles.addrIndex}>{index}</Text>
            <AddressText address={item.address} style={styles.addrText} />
          </Pressable>
        )}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
              style={styles.listFooter}
            />
          ) : undefined
        }
      />
      <View style={styles.proposalActions}>
        <Button
          mode="outlined"
          onPress={onCancel}
          textColor={theme.colors.error}
        >
          Cancel
        </Button>
        <PrimaryButton
          label="Connect"
          onPress={onConnect}
          disabled={!selectedRow}
        />
      </View>
    </View>
  );
}
