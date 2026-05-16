import { Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import useTokenImagesEnabled from '@/hooks/useTokenImagesEnabled.online';
import { INTERNET_ENABLED } from '@/utils/buildConfig';
import type { TokenMetadata } from '@/utils/tokenMetadata';

function TokenLogo({
  uri,
  imagesEnabled,
}: {
  uri: string;
  imagesEnabled: boolean;
}) {
  if (!INTERNET_ENABLED && !uri.startsWith('asset:/')) return null;
  if (!imagesEnabled && !uri.startsWith('asset:/')) return null;
  return (
    <Image source={{ uri }} style={styles.tokenLogo} testID="token-logo" />
  );
}

export default function TokenSymbolRow({ token }: { token: TokenMetadata }) {
  const imagesEnabled = useTokenImagesEnabled();
  return (
    <View style={styles.tokenRow}>
      {token.logoURI && (
        <TokenLogo uri={token.logoURI} imagesEnabled={imagesEnabled} />
      )}
      <Text variant="labelMedium" style={styles.tokenSymbol}>
        {token.symbol}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  tokenSymbol: {
    color: theme.colors.onSurfaceVariant,
  },
  tokenLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
