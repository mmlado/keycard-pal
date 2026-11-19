import { useCallback, useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UrlQRScreenProps } from '@/navigation/types';
import theme from '@/theme';

import { Icons } from '@/assets/icons';
import PrimaryButton from '@/components/PrimaryButton';
import QrCodeImage from '@/components/QrCodeImage';

export default function UrlQRScreen({ route, navigation }: UrlQRScreenProps) {
  const { url, title } = route.params;
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    if (title) {
      navigation.setOptions({ title });
    }
  }, [navigation, title]);

  const handleCopy = useCallback(() => {
    Clipboard.setString(url);
  }, [url]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.qrContainer}>
        <QrCodeImage value={url} size={312} />
        <Text selectable style={styles.url}>
          {url}
        </Text>
      </View>
      <PrimaryButton label="Copy URL" onPress={handleCopy} icon={Icons.copy} />
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
  url: {
    color: theme.colors.onSurface,
    fontFamily: theme.monospace,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
