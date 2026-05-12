import Clipboard from '@react-native-clipboard/clipboard';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icons } from '../../../assets/icons';
import AddressText from '../../AddressText';
import theme from '../../../theme';

interface Props {
  label: string;
  address: string;
  onShowQR: (label: string, address: string) => void;
}

export default function DonationRow({ label, address, onShowQR }: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleCopy = useCallback(() => {
    Clipboard.setString(address);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <AddressText address={address} style={styles.address} selectable />
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.iconButton}
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${label} address`}
        >
          {copied ? (
            <Icons.checkmark width={20} height={20} />
          ) : (
            <Icons.copy width={20} height={20} color={theme.colors.onSurface} />
          )}
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => onShowQR(label, address)}
          accessibilityRole="button"
          accessibilityLabel={`Show ${label} QR code`}
        >
          <Icons.qr width={20} height={20} color={theme.colors.onSurface} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.outline,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 40,
  },
  label: {
    color: theme.colors.onSurface,
    fontFamily: 'Inter_18pt-Medium',
    fontSize: 14,
  },
  address: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 18,
  },
});
