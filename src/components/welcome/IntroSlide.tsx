import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons, type IconComponent } from '@/assets/icons';
import { APP_NAME } from '@/constants/app';
import theme from '@/theme';

type Feature = {
  icon: IconComponent;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: Icons.keycardPal,
    title: 'Keys stay in hardware',
    description: 'Private keys never leave your PIN-protected Keycard.',
  },
  {
    icon: Icons.qr,
    title: 'Air-gapped by design',
    description:
      'Talks to your software wallet with QR codes only. No internet needed.',
  },
  {
    icon: Icons.nfcActivate,
    title: 'Sign with a tap',
    description:
      'Review every transaction on-screen, then approve it by holding your Keycard to the phone.',
  },
];

export default function IntroSlide() {
  return (
    <View>
      <Image
        source={require('../../assets/images/keycard-card.png')}
        style={styles.hero}
        resizeMode="contain"
      />

      <Text style={styles.title}>Welcome to {APP_NAME}</Text>
      <Text style={styles.subtitle}>
        The air-gapped companion app for your Keycard hardware wallet.
      </Text>

      <View style={styles.features}>
        {features.map(({ icon: Icon, title, description }) => (
          <View key={title} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Icon width={26} height={26} color={theme.colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{title}</Text>
              <Text style={styles.featureDescription}>{description}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    height: undefined,
    aspectRatio: 900 / 567,
  },
  title: {
    color: theme.colors.onSurface,
    fontFamily: 'Inter_18pt-SemiBold',
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  features: {
    marginTop: 28,
    gap: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  featureIcon: {
    width: 26,
    alignItems: 'center',
    marginTop: 2,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    color: theme.colors.onSurface,
    fontFamily: 'Inter_18pt-SemiBold',
    fontSize: 16,
    lineHeight: 22,
  },
  featureDescription: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
});
