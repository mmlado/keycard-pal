import Clipboard from '@react-native-clipboard/clipboard';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import theme from '../../theme';

import { Icons } from '../../assets/icons';
import AddressText from '../AddressText';

const SUPPORT_ADDRESSES = [
  {
    label: 'Ethereum',
    address: '0xF665E3D58DABa87d741A347674DCc4C4b794cAc9',
  },
  {
    label: 'Bitcoin',
    address: 'bc1qpncfjnresszndse506zmvjya05xcs6493cm8xf',
  },
];

interface SupportListProps {
  onShowQR: (label: string, address: string) => void;
}

export default function SupportList({ onShowQR }: SupportListProps) {
  return (
    <View style={styles.list}>
      {SUPPORT_ADDRESSES.map(({ label, address }) => (
        <View key={label} style={styles.row}>
          <View style={styles.text}>
            <Text style={styles.label}>{label}</Text>
            <AddressText address={address} style={styles.address} selectable />
          </View>
          <View style={styles.actions}>
            <Pressable
              style={styles.iconButton}
              onPress={() => Clipboard.setString(address)}
              accessibilityRole="button"
              accessibilityLabel={`Copy ${label} address`}
            >
              <Icons.copy
                width={20}
                height={20}
                color={theme.colors.onSurface}
              />
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
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
