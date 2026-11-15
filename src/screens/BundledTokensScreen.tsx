import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { SectionListRenderItem } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { Text } from 'react-native-paper';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BundledTokensScreenProps } from '@/navigation/types';
import theme from '@/theme';

import AddressText from '@/components/AddressText';

import {
  BUNDLED_TOKEN_CHAINS,
  bundledTokenSections,
} from '@/utils/bundledTokens';
import type { BundledToken, BundledTokenSection } from '@/utils/bundledTokens';
import { checksumEthAddress } from '@/utils/ethereumAddress';

export const ALL_CHAINS_LABEL = 'All chains';
export const FILTER_PLACEHOLDER = 'Symbol or 0x address';
export const NO_BUNDLED_TOKEN_MATCH =
  'No bundled token matches. A token the list does not have can be added under Custom tokens.';

// A keccak per row mount is too slow to repeat while an old phone scrolls.
const checksums = new Map<string, string>();
function checksummed(address: string): string {
  let value = checksums.get(address);
  if (value === undefined) {
    value = checksumEthAddress(address);
    checksums.set(address, value);
  }
  return value;
}

function ChainChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
    >
      <Text
        variant="labelLarge"
        style={selected ? styles.chipTextSelected : styles.chipText}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Memoized so a new filter does not re-render the rows it keeps.
const TokenLine = memo(function Line({ token }: { token: BundledToken }) {
  return (
    <View
      style={styles.line}
      testID={`bundled-token-${token.chainId}-${token.address}`}
    >
      <Text variant="bodyLarge" style={styles.symbol}>
        {token.symbol}
        <Text variant="bodySmall" style={styles.muted}>
          {`  ${token.decimals} decimals`}
        </Text>
      </Text>
      <AddressText
        address={checksummed(token.address)}
        style={styles.address}
      />
    </View>
  );
});

const renderToken: SectionListRenderItem<BundledToken, BundledTokenSection> = ({
  item,
}) => <TokenLine token={item} />;

export default function BundledTokensScreen(_props: BundledTokensScreenProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [chainId, setChainId] = useState<number | null>(null);
  const sections = useMemo(
    () => bundledTokenSections(query, chainId),
    [query, chainId],
  );

  // A new filter shows its first match, not the old scroll offset.
  const listRef = useRef<SectionList<BundledToken, BundledTokenSection>>(null);
  const toTop = () =>
    listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  const filterBy = (text: string) => {
    setQuery(text);
    toTop();
  };
  const showChain = (id: number | null) => {
    setChainId(id);
    toTop();
  };

  // Negative while the keyboard is up; the list ends above it.
  const { height } = useReanimatedKeyboardAnimation();
  const keyboardSpace = useAnimatedStyle(() => ({
    height: Math.max(0, -height.value - insets.bottom),
  }));

  const renderHeader = useCallback(
    ({ section }: { section: BundledTokenSection }) => (
      <Text variant="titleSmall" style={styles.chain}>
        {section.name}
      </Text>
    ),
    [],
  );

  return (
    <View style={styles.root}>
      <View style={styles.filters}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={filterBy}
          placeholder={FILTER_PLACEHOLDER}
          placeholderTextColor={theme.colors.onSurfacePlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel={FILTER_PLACEHOLDER}
          testID="bundled-tokens-filter"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
        >
          <ChainChip
            label={ALL_CHAINS_LABEL}
            selected={chainId === null}
            onPress={() => showChain(null)}
            testID="bundled-tokens-chain-all"
          />
          {BUNDLED_TOKEN_CHAINS.map(chain => (
            <ChainChip
              key={chain.chainId}
              label={chain.name}
              selected={chainId === chain.chainId}
              onPress={() => showChain(chain.chainId)}
              testID={`bundled-tokens-chain-${chain.chainId}`}
            />
          ))}
        </ScrollView>
      </View>
      <SectionList
        ref={listRef}
        style={styles.list}
        sections={sections}
        keyExtractor={token => token.address}
        renderItem={renderToken}
        renderSectionHeader={renderHeader}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 16 },
        ]}
        ListEmptyComponent={
          <Text variant="bodyMedium" style={styles.muted}>
            {NO_BUNDLED_TOKEN_MATCH}
          </Text>
        }
        testID="bundled-tokens-list"
      />
      <Animated.View style={keyboardSpace} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  filters: {
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  input: {
    marginHorizontal: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.onSurface,
    fontSize: 16,
  },
  chips: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.surfaceVariant,
  },
  chipSelected: {
    backgroundColor: theme.colors.surfaceSelected,
  },
  chipText: {
    color: theme.colors.onSurfaceVariant,
  },
  chipTextSelected: {
    color: theme.colors.primary,
  },
  list: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chain: {
    color: theme.colors.onSurface,
    backgroundColor: theme.colors.background,
    paddingTop: 16,
    paddingBottom: 8,
  },
  line: {
    gap: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceList,
  },
  symbol: {
    color: theme.colors.onSurface,
  },
  muted: {
    color: theme.colors.onSurfaceMuted,
  },
  // Fits one line on a 360 dp screen, so AddressText needs no second pass to shrink it.
  address: {
    fontFamily: theme.monospace,
    fontSize: 12,
  },
});
