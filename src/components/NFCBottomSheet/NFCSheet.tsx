import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '../../assets/icons';
import theme from '../../theme';
import { displayKeycardName } from '../../utils/keycardName';
import type { NFCVariant } from './index';

type Props = {
  variant: NFCVariant;
  status: string;
  cardName?: string | null;
  onCancel: () => void;
  openNFCSettings?: () => void;
};

function PulseRing({ delay, size }: { delay: number; size: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const opacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.7, 0.35, 0],
  });

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

export default function NFCSheet({
  variant,
  status,
  cardName,
  onCancel,
  openNFCSettings,
}: Props) {
  const NfcIcon =
    variant === 'success'
      ? Icons.nfc.success
      : variant === 'error'
      ? Icons.nfc.failure
      : Icons.nfc.default;

  return (
    <>
      <View style={styles.iconArea}>
        {variant === 'scanning' && (
          <>
            <PulseRing delay={0} size={140} />
            <PulseRing delay={500} size={190} />
            <PulseRing delay={1000} size={240} />
          </>
        )}
        <NfcIcon width={96} height={96} />
      </View>

      <Text variant="titleLarge" style={styles.title}>
        {cardName === undefined || cardName === null
          ? 'Tap your Keycard'
          : displayKeycardName(cardName)}
      </Text>
      <Text variant="bodyMedium" style={styles.status}>
        {status}
      </Text>

      {variant === 'error' && !openNFCSettings && (
        <Text variant="bodyMedium" style={styles.retryHint}>
          Tap your card to try again
        </Text>
      )}

      {variant === 'error' && openNFCSettings && (
        <Pressable
          style={styles.settingsButton}
          android_ripple={{ color: theme.colors.secondaryRipple }}
          onPress={openNFCSettings}
        >
          <Text variant="labelLarge" style={styles.settingsText}>
            Open NFC Settings
          </Text>
        </Pressable>
      )}

      {variant !== 'success' && (
        <Pressable
          style={styles.cancelButton}
          android_ripple={{ color: theme.colors.secondaryRipple }}
          onPress={onCancel}
        >
          <Text variant="labelLarge" style={styles.cancelText}>
            Cancel
          </Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  iconArea: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: theme.colors.secondary,
  },
  title: {
    color: theme.colors.onSurface,
    fontWeight: '600',
    marginBottom: 8,
  },
  status: {
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 36,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  cancelText: {
    color: theme.colors.secondary,
  },
  retryHint: {
    color: theme.colors.onSurfaceMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  settingsButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    marginBottom: 8,
  },
  settingsText: {
    color: theme.colors.onSurface,
  },
});
