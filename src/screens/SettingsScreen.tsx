import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DashboardAction, SettingsScreenProps } from '@/navigation/types';
import theme from '@/theme';

import { Icons } from '@/assets/icons';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import DashboardLayoutSettingsSection from '@/components/settings/DashboardLayoutSettingsSection';
import Eip7730SettingsSection from '@/components/settings/eip7730/Eip7730SettingsSection.online';
import EnsSettingsSection from '@/components/settings/ens/EnsSettingsSection.online';
import KeycardSettingsSection from '@/components/settings/KeycardSettingsSection';
import KeycardsInUseSettingsSection from '@/components/settings/KeycardsInUseSettingsSection';
import PinPadSettingsSection from '@/components/settings/PinPadSettingsSection';
import TenderlySettingsSection from '@/components/settings/tenderly/TenderlySettingsSection.online';
import TokenImagesSettingsSection from '@/components/settings/TokenImagesSettingsSection.online';
import WalletConnectSettingsSection from '@/components/settings/WalletConnectSettingsSection.online';

import { useIdentifyCard } from '@/hooks/keycard/useIdentifyCard';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';
import { usePreferences } from '@/hooks/usePreferences';

import { resetLastTappedGeneration } from '@/utils/lastTappedGeneration';

export const dashboardEntry: DashboardAction = {
  label: 'Settings',
  icon: Icons.settings,
  navigate: nav => nav.navigate('Settings'),
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { setPreference } = usePreferences();

  // "Set from my Keycard": a SELECT-only tap.
  const identify = useIdentifyCard();
  const { phase: identifyPhase, generation, start: startIdentify } = identify;

  // Keyed on the tap finishing: a second card of the same generation narrows the selection again.
  useEffect(() => {
    if (identifyPhase === 'done' && generation !== null) {
      setPreference('generationsInUse', [generation]);
      // The reminder must follow a tap outside the selection, never this one.
      resetLastTappedGeneration();
    }
  }, [identifyPhase, generation, setPreference]);

  // No `done` navigation here: the user stays in Settings.
  const { sheet } = useKeycardScreen({
    keycard: identify,
    navigation,
    title: 'Settings',
    stayOnCancel: true,
    hideNoCardExit: true,
  });

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.section}>
          <KeycardSettingsSection />
          <DashboardLayoutSettingsSection />
          <KeycardsInUseSettingsSection
            onSetFromCard={startIdentify}
            readingCard={identifyPhase === 'nfc'}
          />
          <PinPadSettingsSection />
          <TokenImagesSettingsSection />
          <EnsSettingsSection />
          <WalletConnectSettingsSection />
          <TenderlySettingsSection />
          <Eip7730SettingsSection />
        </View>
      </KeyboardAwareScrollView>

      {/* No shop link on this sheet: "Buy a Keycard" is the first row of this
          very screen, and the user stays here when the tap is cancelled. */}
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
