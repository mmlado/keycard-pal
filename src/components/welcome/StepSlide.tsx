import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons, type IconComponent } from '@/assets/icons';
import theme from '@/theme';

export type WelcomeStep = {
  icon: IconComponent;
  title: string;
  body: React.ReactNode;
};

// Entry names are written as the menus show them, so the user can find each one.
function Entry({ children }: { children: string }) {
  return <Text style={styles.entry}>{children}</Text>;
}

export const WELCOME_STEPS: WelcomeStep[] = [
  {
    icon: Icons.keycard,
    title: 'Set up your Keycard',
    body: (
      <>
        A new card starts empty. In <Entry>Keycard</Entry>,{' '}
        <Entry>Initialize</Entry> sets its PIN, and <Entry>Key pair</Entry>{' '}
        creates a key on the card or imports your recovery phrase.
      </>
    ),
  },
  {
    icon: Icons.connectWallet,
    title: 'Connect your wallet',
    body: (
      <>
        In <Entry>Connect software wallet</Entry>, pick your wallet, such as
        MetaMask or Sparrow, and let it scan the QR code. It gets your public
        key only: the private key stays on the card.
      </>
    ),
  },
  {
    icon: Icons.nfcActivate,
    title: 'Sign with a tap',
    body: (
      <>
        When your wallet shows a transaction as a QR code, press{' '}
        <Entry>Scan</Entry>. Check what you are signing, hold your Keycard to
        the phone, then let your wallet scan the signature.
      </>
    ),
  },
];

export function stepPosition(index: number) {
  return `Step ${index + 1} of ${WELCOME_STEPS.length}`;
}

export type StepSlideProps = {
  step: WelcomeStep;
  index: number;
};

export default function StepSlide({
  step: { icon: Icon, title, body },
  index,
}: StepSlideProps) {
  return (
    <View style={styles.card}>
      <Icon width={40} height={40} color={theme.colors.primary} />
      <Text style={styles.position}>{stepPosition(index)}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceList,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  position: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 16,
  },
  title: {
    color: theme.colors.onSurface,
    fontFamily: 'Inter_18pt-SemiBold',
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
    marginTop: 4,
  },
  body: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
  },
  entry: {
    color: theme.colors.onSurface,
    fontFamily: 'Inter_18pt-SemiBold',
  },
});
