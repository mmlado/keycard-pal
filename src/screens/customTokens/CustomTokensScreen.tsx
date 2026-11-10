import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '@/assets/icons';
import { CUSTOM_TOKENS_EXPLAINER } from '@/constants/customTokens';
import type { CustomTokensScreenProps } from '@/navigation/types';
import theme from '@/theme';

import { ADD_TOKEN_LABEL } from '@/components/WithAddToken';
import AddressText from '@/components/AddressText';
import PrimaryButton from '@/components/PrimaryButton';

import { useCustomTokens } from '@/hooks/useCustomTokens';

import { getChainName } from '@/utils/chainMetadata';
import { shadowedText } from '@/utils/customTokenChecks';
import type { CustomToken } from '@/utils/customTokens';
import { checksumEthAddress } from '@/utils/ethereumAddress';
import { lookupBundledToken } from '@/utils/tokenMetadata';

type ChainGroup = { chainId: number; name: string; tokens: CustomToken[] };

function byChain(tokens: readonly CustomToken[]): ChainGroup[] {
  const groups = new Map<number, ChainGroup>();
  for (const token of tokens) {
    const group = groups.get(token.chainId) ?? {
      chainId: token.chainId,
      name: getChainName(token.chainId),
      tokens: [],
    };
    group.tokens.push(token);
    groups.set(token.chainId, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(group => ({
      ...group,
      tokens: [...group.tokens].sort((a, b) =>
        a.symbol.localeCompare(b.symbol),
      ),
    }));
}

function TokenLine({
  token,
  onPress,
}: {
  token: CustomToken;
  onPress: () => void;
}) {
  const bundled = lookupBundledToken(token.chainId, token.address);
  return (
    <Pressable
      style={styles.line}
      onPress={onPress}
      accessibilityRole="button"
      testID={`custom-token-${token.chainId}-${token.address}`}
    >
      <View style={styles.lineText}>
        <Text variant="bodyLarge" style={styles.symbol}>
          {token.symbol}
          <Text variant="bodySmall" style={styles.muted}>
            {`  ${token.decimals} decimals`}
          </Text>
        </Text>
        <AddressText
          address={checksumEthAddress(token.address)}
          style={styles.address}
        />
        {bundled && (
          <Text variant="bodySmall" style={styles.muted}>
            {shadowedText(bundled)}
          </Text>
        )}
      </View>
      <Icons.chevronRight
        width={24}
        height={24}
        color={theme.colors.onSurfaceMuted}
      />
    </Pressable>
  );
}

export default function CustomTokensScreen({
  navigation,
}: CustomTokensScreenProps) {
  const insets = useSafeAreaInsets();
  const tokens = useCustomTokens();
  const groups = useMemo(() => byChain(tokens), [tokens]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {groups.length === 0 ? (
          <Text variant="bodyMedium" style={styles.muted}>
            {CUSTOM_TOKENS_EXPLAINER}
          </Text>
        ) : (
          groups.map(group => (
            <View key={group.chainId} style={styles.group}>
              <Text variant="titleSmall" style={styles.chain}>
                {group.name}
              </Text>
              {group.tokens.map(token => (
                <TokenLine
                  key={token.address}
                  token={token}
                  onPress={() =>
                    navigation.navigate('CustomToken', {
                      mode: 'edit',
                      chainId: token.chainId,
                      address: token.address,
                    })
                  }
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton
          label={ADD_TOKEN_LABEL}
          icon={Icons.addToken}
          onPress={() => navigation.navigate('CustomToken', { mode: 'add' })}
          testID="custom-tokens-add"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 24,
  },
  group: {
    gap: 8,
  },
  chain: {
    color: theme.colors.onSurface,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceList,
  },
  lineText: {
    flex: 1,
    gap: 4,
  },
  symbol: {
    color: theme.colors.onSurface,
  },
  muted: {
    color: theme.colors.onSurfaceMuted,
  },
  address: {
    fontFamily: theme.monospace,
    fontSize: 14,
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
