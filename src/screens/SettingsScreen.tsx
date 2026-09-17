import React, { useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '@/assets/icons';
import type { DashboardAction, SettingsScreenProps } from '@/navigation/types';
import theme from '@/theme';

import NFCBottomSheet from '@/components/NFCBottomSheet';
import DashboardLayoutSettingsSection from '@/components/settings/DashboardLayoutSettingsSection';
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

  // "Set from my Keycard": the SELECT-only identify tap, for the user who
  // would rather tap a card than read applet versions.
  const identify = useIdentifyCard();
  const { phase: identifyPhase, generation, start: startIdentify } = identify;

  // Keyed on the tap finishing, not on the generation alone: reading a second
  // card of the same generation has to narrow the selection again, and the
  // generation would not have changed.
  useEffect(() => {
    if (identifyPhase === 'done' && generation !== null) {
      setPreference('generationsInUse', [generation]);
      // This tap was the user setting the selection, not a card turning up
      // outside it, so it leaves no question behind for the dashboard.
      resetLastTappedGeneration();
    }
  }, [identifyPhase, generation, setPreference]);

  // Owns the header title and the back guard. There is no `done` here, so a
  // finished tap leaves the user in Settings, looking at what it ticked.
  const { onCancel } = useKeycardScreen({
    keycard: identify,
    navigation,
    title: 'Settings',
    stayOnCancel: true,
  });

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
        </View>
      </ScrollView>

      {/* No shop link on this sheet: "Buy a Keycard" is the first row of this
          very screen, and the user stays here when the tap is cancelled. */}
      <NFCBottomSheet nfc={identify} onCancel={onCancel} hideNoCardExit />
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
