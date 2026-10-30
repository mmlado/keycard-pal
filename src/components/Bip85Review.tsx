import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import BlurredSecret from '@/components/BlurredSecret';
import BottomActionArea from '@/components/BottomActionArea';
import PrimaryButton from '@/components/PrimaryButton';

import { bip85Format, bip85Path, type Bip85Format } from '@/utils/bip85';

type Props = {
  format: Bip85Format;
  index: number;
  entropy: Uint8Array;
  onDone: () => void;
};

export const BIP85_RESULT_EXPLAINER =
  'Derived from the key on this Keycard, including any passphrase it was ' +
  'loaded with. Anyone who sees it can use it.';

export const BIP85_INVALID_KEY =
  'This index gives an invalid key. Use the next index.';

export default function Bip85Review({ format, index, entropy, onDone }: Props) {
  const { title, layout, encode } = bip85Format(format);
  const [revealed, setRevealed] = useState(false);
  const secret = useMemo(() => encode(entropy), [encode, entropy]);

  const handleButton = useCallback(() => {
    if (!revealed && secret !== null) {
      setRevealed(true);
      return;
    }
    onDone();
  }, [revealed, secret, onDone]);

  const words = layout === 'words' && secret ? secret.split(' ') : [];
  const half = words.length / 2;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.description}>
          {secret === null ? BIP85_INVALID_KEY : BIP85_RESULT_EXPLAINER}
        </Text>
        {secret !== null && (
          <BlurredSecret
            revealed={revealed}
            hiddenLabel={`${title} hidden. Reveal shows it.`}
            style={
              layout === 'words' ? styles.wordGridWrapper : styles.textWrapper
            }
          >
            {layout === 'words' ? (
              <View style={styles.wordGrid}>
                <View style={styles.column}>
                  {words.slice(0, half).map((word, i) => (
                    <View key={i} style={styles.wordCell}>
                      <Text style={styles.wordIndex} numberOfLines={1}>
                        {i + 1}.
                      </Text>
                      <Text style={styles.wordText}>{word}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.column}>
                  {words.slice(half).map((word, i) => (
                    <View key={i} style={styles.wordCell}>
                      <Text style={styles.wordIndex} numberOfLines={1}>
                        {half + i + 1}.
                      </Text>
                      <Text style={styles.wordText}>{word}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={styles.secretText} testID="bip85-secret">
                {secret}
              </Text>
            )}
          </BlurredSecret>
        )}
        <Text style={styles.path}>{bip85Path(format, index)}</Text>
      </ScrollView>

      <BottomActionArea style={styles.buttonArea}>
        <PrimaryButton
          testID="primary-button"
          label={revealed || secret === null ? 'Done' : 'Reveal'}
          onPress={handleButton}
        />
      </BottomActionArea>
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
  wordGridWrapper: {
    marginVertical: 24,
  },
  wordGrid: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
  },
  wordCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  wordIndex: {
    color: theme.colors.onSurfaceDisabled,
    fontSize: 13,
    minWidth: 22,
    flexShrink: 0,
    textAlign: 'right',
  },
  wordText: {
    color: theme.colors.onSurface,
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  textWrapper: {
    marginVertical: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  secretText: {
    color: theme.colors.onSurface,
    fontFamily: theme.monospace,
    fontSize: 16,
    lineHeight: 24,
  },
  path: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.monospace,
    fontSize: 12,
  },
  buttonArea: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});
