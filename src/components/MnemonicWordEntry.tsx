import { useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import { Icons } from '@/assets/icons';

import { enteredWords, invalidWordError } from '@/utils/wordEntry';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  wordCount: number;
  wordList: readonly string[];
  wordListName: string;
  placeholder: string;
  errors?: Array<string | null | undefined>;
  wordCountOptions?: readonly number[];
  onWordCountChange?: (wordCount: number) => void;
  onScanPress?: () => void;
  scanTestID?: string;
  editable?: boolean;
  inputStyle?: StyleProp<TextStyle>;
  wrapperStyle?: StyleProp<ViewStyle>;
};

export default function MnemonicWordEntry({
  value,
  onChangeText,
  wordCount,
  wordList,
  wordListName,
  placeholder,
  errors = [],
  wordCountOptions,
  onWordCountChange,
  onScanPress,
  scanTestID,
  editable = true,
  inputStyle,
  wrapperStyle,
}: Props) {
  const words = useMemo(() => enteredWords(value), [value]);
  const wordError = useMemo(
    () => invalidWordError(value, wordCount, wordList, wordListName),
    [value, wordCount, wordList, wordListName],
  );

  return (
    <View style={[styles.wrapper, wrapperStyle]}>
      {wordCountOptions && wordCountOptions.length > 1 && (
        <View style={styles.segmented}>
          {wordCountOptions.map((option, index) => (
            <View key={option} style={styles.segmentWrapper}>
              {index > 0 && <View style={styles.segmentDivider} />}
              <Pressable
                style={[
                  styles.segment,
                  wordCount === option && styles.segmentActive,
                ]}
                onPress={() => onWordCountChange?.(option)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    wordCount === option && styles.segmentActiveText,
                  ]}
                >
                  {`${option} words`}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.inputWrapper}>
        <View>
          <TextInput
            style={[
              styles.wordInput,
              onScanPress && styles.wordInputWithScan,
              inputStyle,
            ]}
            value={value}
            onChangeText={onChangeText}
            editable={editable}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.onSurfacePlaceholder}
          />
          {onScanPress && (
            <Pressable
              style={styles.scanIcon}
              onPress={onScanPress}
              hitSlop={12}
              testID={scanTestID}
              accessibilityRole="button"
              accessibilityLabel="Scan SeedQR"
            >
              <Icons.qr width={24} height={24} color={theme.colors.onSurface} />
            </Pressable>
          )}
        </View>
        {wordError && <Text style={styles.errorText}>{wordError}</Text>}
        {errors
          .filter((error): error is string => Boolean(error))
          .map(error => (
            <Text key={error} style={styles.errorText}>
              {error}
            </Text>
          ))}
        <Text style={styles.wordCountText}>
          {`${words.length}/${wordCount} words`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 20,
  },
  segmented: {
    borderColor: theme.colors.outline,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segmentWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  segment: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    paddingVertical: 12,
  },
  segmentActive: {
    backgroundColor: theme.colors.surfaceSelected,
  },
  segmentDivider: {
    backgroundColor: theme.colors.outline,
    width: 1,
  },
  segmentText: {
    color: theme.colors.onSurfaceSubtle,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentActiveText: {
    color: theme.colors.onSurface,
  },
  inputWrapper: {
    gap: 6,
  },
  wordInput: {
    backgroundColor: theme.colors.surfaceVariant,
    borderBottomColor: theme.colors.onSurface,
    borderBottomWidth: 3,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    color: theme.colors.onSurface,
    fontSize: 16,
    minHeight: 128,
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 4,
    textAlignVertical: 'top',
  },
  wordInputWithScan: {
    paddingRight: 48,
  },
  // The whole strip `wordInputWithScan` reserves, so a tap low in it opens the scanner, not the keyboard.
  scanIcon: {
    alignItems: 'center',
    bottom: 0,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 48,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
  },
  wordCountText: {
    color: theme.colors.onSurfaceDisabled,
    fontSize: 12,
    textAlign: 'right',
  },
});
