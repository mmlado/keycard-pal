import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LicenseDetailScreenProps } from '../navigation/types';
import theme from '../theme';

import { LICENSE_TEXTS } from '../data/licenses';

export default function LicenseDetailScreen({
  route,
}: LicenseDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { packageName, licenseType } = route.params;
  const text = LICENSE_TEXTS[licenseType] ?? licenseType;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={styles.package}>{packageName}</Text>
      <Text style={styles.licenseType}>{licenseType}</Text>
      <Text style={styles.body}>{text}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
  },
  package: {
    fontFamily: 'Inter_18pt-SemiBold',
    fontSize: 18,
    color: theme.colors.onSurface,
  },
  licenseType: {
    fontSize: 13,
    color: theme.colors.onSurfaceMuted,
    marginBottom: 8,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.monospace,
  },
});
