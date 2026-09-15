import { useCallback, useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UrlQRScreenProps } from '../navigation/types';
import theme from '../theme';

import { Icons } from '../assets/icons';
import PrimaryButton from '../components/PrimaryButton';

export default function UrlQRScreen({ route, navigation }: UrlQRScreenProps) {
  const { url, title, note } = route.params;
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
        <View style={styles.qrWrapper}>
          <QRCode
            value={url}
            size={280}
            color="#000000"
            backgroundColor="#ffffff"
          />
        </View>
        <Text selectable style={styles.url}>
          {url}
        </Text>
        {note ? (
          <Text style={styles.note} testID="url-qr-note">
            {note}
          </Text>
        ) : null}
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
  qrWrapper: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  url: {
    color: theme.colors.onSurface,
    fontFamily: 'monospace',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  note: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
