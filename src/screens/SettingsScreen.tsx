import React, { useLayoutEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DashboardAction, SettingsScreenProps } from '../navigation/types';
import theme from '../theme';

import EnsSettingsSection from '../components/settings/ens/EnsSettingsSection.online';
import PinPadSettingsSection from '../components/settings/PinPadSettingsSection';
import TenderlySettingsSection from '../components/settings/tenderly/TenderlySettingsSection.online';
import TokenImagesSettingsSection from '../components/settings/TokenImagesSettingsSection.online';
import WalletConnectSettingsSection from '../components/settings/WalletConnectSettingsSection.online';

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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <PinPadSettingsSection />
          <TokenImagesSettingsSection />
          <EnsSettingsSection />
          <WalletConnectSettingsSection />
          <TenderlySettingsSection />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
