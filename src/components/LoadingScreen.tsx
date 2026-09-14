import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text } from 'react-native';

import { APP_NAME, APP_VERSION } from '@/constants/app';
import theme from '@/theme';

/** Long enough to read as a crossfade, short enough not to feel like a wait. */
export const LOADING_FADE_MS = 300;

type Props = {
  /**
   * False once the app behind it is ready. The screen then fades out over
   * the first frame of the app and reports `onHidden` so the owner can
   * unmount it.
   */
  visible: boolean;
  onHidden: () => void;
};

/**
 * Shown while startup resolves the stored preferences: the Keycard, the app
 * name and the version on the app background. It sits above the navigator
 * as an overlay so the fade out reveals the first screen already painted
 * underneath.
 */
export default function LoadingScreen({ visible, onHidden }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  // Read at fade end, not captured at fade start, so a re-render during the
  // fade cannot restart it or call a stale callback.
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  useEffect(() => {
    if (visible) {
      return;
    }
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: LOADING_FADE_MS,
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished) {
        onHiddenRef.current();
      }
    });
    return () => fade.stop();
  }, [visible, opacity]);

  return (
    <Animated.View
      style={[styles.container, { opacity }]}
      // Once the fade starts the screen underneath owns the touches.
      pointerEvents={visible ? 'auto' : 'none'}
      testID="loading-screen"
    >
      <Image
        source={require('../assets/images/keycard-card.png')}
        style={styles.card}
        resizeMode="contain"
        accessibilityLabel="Keycard"
      />
      <Text style={styles.name}>{APP_NAME}</Text>
      <Text style={styles.version}>v{APP_VERSION}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    backgroundColor: theme.colors.background,
  },
  card: {
    width: '100%',
    height: undefined,
    aspectRatio: 900 / 567,
  },
  name: {
    marginTop: 24,
    color: theme.colors.onSurface,
    fontFamily: 'Inter_18pt-SemiBold',
    fontSize: 28,
    lineHeight: 34,
  },
  version: {
    marginTop: 4,
    color: theme.colors.onSurfaceMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
