import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import PrimaryButton from '@/components/PrimaryButton';

type Props = {
  puk: string;
  onDone: () => void;
  /** The tap ended before the card confirmed INIT, so the card may or may not hold this PUK. */
  uncertain?: boolean;
};

export const PUK_EXPLAINER =
  'Your Keycard is set up. This is its PUK: it unblocks the card after three ' +
  'wrong PIN entries. Write it down and keep it with your recovery phrase. ' +
  'Without it, a blocked card can only be factory reset, which erases its key.';

export const PUK_UNCERTAIN_EXPLAINER =
  'Setting up your Keycard was interrupted before the card confirmed it, so ' +
  'the card may or may not have been set up with this PUK. Write it down in ' +
  'case it was: it unblocks the card after three wrong PIN entries, and ' +
  'without it a blocked card can only be factory reset, which erases its key. ' +
  'If the card was not set up, initialize it again and write down the new PUK.';

/** In fours, the way it goes onto paper. */
export function formatPUK(puk: string): string {
  return puk.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Shown once the card is set up, or once it may be. */
export default function PukReview({ puk, onDone, uncertain }: Props) {
  const [revealed, setRevealed] = useState(false);

  const handleButton = useCallback(() => {
    if (!revealed) {
      setRevealed(true);
      return;
    }
    onDone();
  }, [revealed, onDone]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.description}>
          {uncertain ? PUK_UNCERTAIN_EXPLAINER : PUK_EXPLAINER}
        </Text>
        <View style={styles.pukWrapper}>
          <Text style={styles.puk} testID="puk-digits">
            {formatPUK(puk)}
          </Text>
          {!revealed && (
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType="dark"
              blurAmount={10}
            />
          )}
        </View>
      </ScrollView>

      <View style={styles.buttonArea}>
        <PrimaryButton
          testID="primary-button"
          label={revealed ? "I've written it down" : 'Reveal PUK'}
          onPress={handleButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 22,
  },
  pukWrapper: {
    marginTop: 32,
    paddingVertical: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  puk: {
    color: theme.colors.onSurface,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  buttonArea: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});
