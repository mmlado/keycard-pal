import React, { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DashboardAction, SettingsScreenProps } from '../navigation/types';
import theme from '../theme';

import EnsSettingsSection from '../components/settings/ens/EnsSettingsSection.online';
import PinPadSettingsSection from '../components/settings/PinPadSettingsSection';
import TokenImagesSettingsSection from '../components/settings/TokenImagesSettingsSection.online';

export const dashboardEntry: DashboardAction = {
  label: 'Settings',
  navigate: nav => nav.navigate('Settings'),
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Settings' });
  }, [navigation]);

  return (
    <ScrollView
      style={[styles.container, { paddingBottom: insets.bottom + 16 }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.section}>
        <PinPadSettingsSection />
        <TokenImagesSettingsSection />
        <EnsSettingsSection />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 24,
  },
  section: {
    gap: 16,
  },
});
