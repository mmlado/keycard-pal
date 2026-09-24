import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import theme from '../../../theme';

import DonationList from './List';
import { DONATION_INTRO, DONATION_STANDING_LINE, DONATION_TITLE } from './copy';

type Props = {
  onShowQR: (label: string, address: string) => void;
};

export default function DonationSection({ onShowQR }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{DONATION_TITLE}</Text>
      <Text style={styles.description}>
        {`${DONATION_INTRO} ${DONATION_STANDING_LINE}`}
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
