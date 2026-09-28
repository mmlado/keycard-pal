import React, {
  useCallback,
  useEffect,
  useRef,
  type ComponentRef,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
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
import {
  FieldFocusContext,
  type SettingsField,
} from '@/components/settings/fieldFocus';

import { useIdentifyCard } from '@/hooks/keycard/useIdentifyCard';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';
import { usePreferences } from '@/hooks/usePreferences';

import { resetLastTappedGeneration } from '@/utils/lastTappedGeneration';

export const dashboardEntry: DashboardAction = {
  label: 'Settings',
  icon: Icons.settings,
  navigate: nav => nav.navigate('Settings'),
};

/** Breathing room left between a focused field and the top of the keyboard. */
const FIELD_GAP = 16;

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
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

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const focusedField = useRef<SettingsField | null>(null);
  const scrollOffset = useRef(0);
  // Screen y of the keyboard's top edge, or the screen bottom while it is down.
  const keyboardTop = useRef(Number.POSITIVE_INFINITY);

  const scrollFieldIntoView = useCallback(() => {
    const field = focusedField.current;
    if (!field) return;
    field.measureInWindow((_x, y, _width, height) => {
      const hidden = y + height + FIELD_GAP - keyboardTop.current;
      if (hidden > 0) {
        scrollRef.current?.scrollTo({
          y: scrollOffset.current + hidden,
          animated: true,
        });
      }
    });
  }, []);

  useEffect(() => {
    const shown = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      event => {
        keyboardTop.current = event.endCoordinates.screenY;
      },
    );
    const hidden = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardTop.current = Number.POSITIVE_INFINITY;
      },
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const handleFieldFocus = useCallback(
    (field: SettingsField | null) => {
      focusedField.current = field;
      // Moving between fields with the keyboard already up: nothing else will
      // fire, so this is the only chance to bring the new one into view.
      scrollFieldIntoView();
    },
    [scrollFieldIntoView],
  );

  // The keyboard shrinks the ScrollView through the KeyboardAvoidingView, and
  // only once that has laid out is there a viewport to scroll the field into.
  const handleViewportLayout = useCallback(
    () => scrollFieldIntoView(),
    [scrollFieldIntoView],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  // No `done` navigation here: the user stays in Settings.
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
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        ref={scrollRef}
        onLayout={handleViewportLayout}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
          <FieldFocusContext.Provider value={handleFieldFocus}>
            <EnsSettingsSection />
            <WalletConnectSettingsSection />
            <TenderlySettingsSection />
          </FieldFocusContext.Provider>
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
