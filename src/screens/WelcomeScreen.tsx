import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { WelcomeScreenProps } from '@/navigation/types';
import theme from '@/theme';

import SlidePager from '@/components/SlidePager';
import WelcomeActions from '@/components/WelcomeActions';
import { WELCOME_SLIDES } from '@/components/welcome/slides';

import { usePreferences } from '@/hooks/usePreferences';

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();

  const { setPreference } = usePreferences();

  const handleGetStarted = useCallback(() => {
    setPreference('welcomeSeen', true);
    navigation.replace('Dashboard');
  }, [navigation, setPreference]);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <SlidePager slides={WELCOME_SLIDES} />

      <WelcomeActions onGetStarted={handleGetStarted} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
