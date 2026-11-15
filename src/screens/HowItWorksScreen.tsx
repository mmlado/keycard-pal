import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import theme from '@/theme';

import SlidePager from '@/components/SlidePager';
import { WELCOME_SLIDES } from '@/components/welcome/slides';

export default function HowItWorksScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <SlidePager slides={WELCOME_SLIDES} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
