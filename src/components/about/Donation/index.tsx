import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import theme from '../../../theme';

import DonationList from './List';

type Props = {
  onShowQR: (label: string, address: string) => void;
};

export default function DonationSection({ onShowQR }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buy me a coffee</Text>
      <Text style={styles.description}>
        If GapSign keeps your funds safe, you can send a coffee my way. It helps
        keep the project maintained and open-source.
      </Text>
      <DonationList onShowQR={onShowQR} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  title: {
    fontFamily: 'Inter_18pt-SemiBold',
    fontSize: 18,
    color: theme.colors.onSurface,
    textAlign: 'center',
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
