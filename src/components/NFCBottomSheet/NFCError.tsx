import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '../../assets/icons';
import theme from '../../theme';

type Props = {
  status: string;
  retry?: () => void;
  openNFCSettings?: () => void;
  onCancel: () => void;
  paddingBottom?: number;
};

export default function NFCError({
  status,
  retry,
  openNFCSettings,
  onCancel,
  paddingBottom = 24,
}: Props) {
  return (
    <View style={[styles.container, { paddingBottom }]}>
      <Icons.nfc.failure width={80} height={80} />
      <Text variant="titleMedium" style={styles.title}>
        Something went wrong
      </Text>
      <Text variant="bodyMedium" style={styles.status}>
        {status}
      </Text>
      {openNFCSettings && (
        <Pressable style={styles.retryButton} onPress={openNFCSettings}>
          <Text variant="labelLarge" style={styles.retryLabel}>
            Open NFC Settings
          </Text>
        </Pressable>
      )}
      {!openNFCSettings && retry && (
        <Pressable style={styles.retryButton} onPress={retry}>
          <Text variant="labelLarge" style={styles.retryLabel}>
            Try again
          </Text>
        </Pressable>
      )}
      <Pressable style={styles.cancelButton} onPress={onCancel}>
        <Text variant="labelLarge" style={styles.cancelLabel}>
          Cancel
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  title: {
    color: theme.colors.onSurface,
    fontWeight: '600',
  },
  status: {
    color: theme.colors.onSurfaceMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
  },
  retryLabel: {
    color: theme.colors.onSurface,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  cancelLabel: {
    color: theme.colors.onSurfaceMuted,
  },
});
