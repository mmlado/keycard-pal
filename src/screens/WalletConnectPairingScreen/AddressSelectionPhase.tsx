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

import styles from './styles';

export default function AddressSelectionPhase({
  addresses,
  selectedAddress,
  loading,
  insets,
  onSelect,
  onLoadMore,
  onConnect,
  onCancel,
}: {
  addresses: string[];
  selectedAddress: string | null;
  loading: boolean;
  insets: EdgeInsets;
  onSelect: (address: string) => void;
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
        data={addresses}
        keyExtractor={item => item}
        style={styles.list}
        renderItem={({ item, index }) => (
          <Pressable style={styles.addrRow} onPress={() => onSelect(item)}>
            <RadioButton.Android
              value={item}
              status={selectedAddress === item ? 'checked' : 'unchecked'}
              onPress={() => onSelect(item)}
              color={theme.colors.primary}
            />
            <Text style={styles.addrIndex}>{index}</Text>
            <AddressText address={item} style={styles.addrText} />
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
          ) : null
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
          disabled={!selectedAddress}
        />
      </View>
    </View>
  );
}
