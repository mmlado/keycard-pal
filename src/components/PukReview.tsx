import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { Text } from 'react-native-paper';

import { PUK_REVIEW_SECONDS } from '@/constants/backup';
import theme from '@/theme';

import PrimaryButton from '@/components/PrimaryButton';

import { useSeedReviewTimer } from '@/hooks/useSeedReviewTimer';

type Props = {
  puk: string;
  /** The user says the PUK is written down. */
  onDone: () => void;
};

export const PUK_EXPLAINER =
  'Your PUK unblocks this Keycard after three wrong PIN entries. Write it ' +
  'down and keep it with your recovery phrase. Without it, a blocked card ' +
  'can only be factory reset, which erases its key.';

/** "1234 5678 9012": in fours, the way it is copied onto paper. */
export function formatPUK(puk: string): string {
  return puk.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** The recovery phrase's write-it-down step, for the PUK: reveal, wait, acknowledge. */
export default function PukReview({ puk, onDone }: Props) {
  const [revealed, setRevealed] = useState(false);
  const timer = useSeedReviewTimer(PUK_REVIEW_SECONDS);
  const { start: startTimer } = timer;

  useEffect(() => {
    if (revealed) {
      startTimer();
    }
  }, [revealed, startTimer]);

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
        <Text style={styles.description}>{PUK_EXPLAINER}</Text>
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
          label={
            !revealed
              ? 'Reveal PUK'
              : !timer.done
              ? `Write down your PUK (${timer.timeLeft}s)`
              : "I've written it down"
          }
          onPress={handleButton}
          disabled={revealed && !timer.done}
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
