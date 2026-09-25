import { useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MnemonicScreenProps } from '../../navigation/types';
import theme from '../../theme';

import { Icons } from '../../assets/icons';
import CameraView from '../../components/CameraView';
import { type ReadCodeEvent } from '../../components/Camera';
import MnemonicWordEntry from '../../components/MnemonicWordEntry';
import NFCBottomSheet from '../../components/NFCBottomSheet';
import PrimaryButton from '../../components/PrimaryButton';

import {
  deriveMnemonicKeyPair,
  useLoadKey,
} from '../../hooks/keycard/useLoadKey';
import { useVerifyFingerprint } from '../../hooks/keycard/useVerifyFingerprint';
import { deriveMnemonicFingerprint } from '../../hooks/keycard/useVerifyMnemonic';
import { useKeycardScreen } from '../../hooks/useKeycardScreen';
import { decodeSeedQr, isSeedQrPayload } from '../../utils/seedQr';

export default function MnemonicScreen({
  navigation,
  route,
}: MnemonicScreenProps) {
  const mode = route.params?.mode ?? 'import';
  const insets = useSafeAreaInsets();
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [input, setInput] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const loadKey = useLoadKey();
  const verifyFingerprint = useVerifyFingerprint();
  const keycard = mode === 'verify' ? verifyFingerprint : loadKey;

  const handleTextChange = useCallback((text: string) => {
    setInput(text);
    setPhraseError(null);
  }, []);

  const handleContinue = useCallback(() => {
    if (!validateMnemonic(words.join(' '), wordlist)) {
      setPhraseError('Invalid recovery phrase');
      return;
    }
    if (mode === 'verify') {
      verifyFingerprint.start(
        deriveMnemonicFingerprint(words, passphrase || undefined),
      );
      return;
    }
    loadKey.start(deriveMnemonicKeyPair(words, passphrase || undefined));
  }, [loadKey, mode, passphrase, verifyFingerprint, words]);

  const handleScanPress = useCallback(() => {
    // The scanner is an overlay on this screen, so the word input keeps focus
    // and the keyboard would otherwise stay up covering the viewfinder.
    Keyboard.dismiss();
    setScanError(null);
    setScanning(true);
  }, []);

  const { onCancel } = useKeycardScreen({
    keycard,
    navigation,
    title: scanning
      ? 'Scan SeedQR'
      : mode === 'verify'
      ? 'Verify recovery phrase'
      : 'Import recovery phrase',
    done: {
      toast: doneResult =>
        mode === 'verify'
          ? doneResult === 'match'
            ? 'Recovery phrase matches'
            : 'Recovery phrase does not match'
          : 'Key pair has been added to Keycard',
    },
    stayOnCancel: true,
  });

  useEffect(() => {
    if (!scanning) return;
    return navigation.addListener('beforeRemove', e => {
      e.preventDefault();
      setScanning(false);
      setScanError(null);
    });
  }, [navigation, scanning]);

  const handleCodeScanned = useCallback((event: ReadCodeEvent) => {
    const value = event.nativeEvent.codeStringValue;
    if (!value) return;

    const cleaned = value.trim().toLowerCase();
    if (!isSeedQrPayload(cleaned)) {
      setScanError('Not a valid SeedQR. Scan a hex-encoded BIP39 entropy QR.');
      return;
    }

    const decoded = decodeSeedQr(cleaned);
    if (decoded.kind === 'error') {
      setScanError(decoded.message);
      return;
    }

    setInput(decoded.words.join(' '));
    setWordCount(decoded.words.length === 24 ? 24 : 12);
    setScanning(false);
    setScanError(null);
  }, []);

  const isComplete = words.length === wordCount;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <MnemonicWordEntry
          value={input}
          onChangeText={handleTextChange}
          wordCount={wordCount}
          wordCountOptions={[12, 24]}
          onWordCountChange={count => setWordCount(count as 12 | 24)}
          wordList={wordlist}
          wordListName="BIP39"
          placeholder="Enter your recovery phrase"
          errors={[phraseError]}
          onWordsChange={setWords}
          onScanPress={handleScanPress}
          scanTestID="scan-seedqr-button"
        />

        <TextInput
          style={styles.passphraseInput}
          value={passphrase}
          onChangeText={setPassphrase}
          placeholder="Passphrase (optional)"
          placeholderTextColor={theme.colors.onSurfacePlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </ScrollView>

      <View
        style={[
          styles.buttonContainer,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight + 8 },
        ]}
      >
        <PrimaryButton
          label={mode === 'verify' ? 'Verify' : 'Continue'}
          icon={Icons.nfcActivate}
          onPress={handleContinue}
          disabled={!isComplete}
        />
      </View>

      <NFCBottomSheet nfc={keycard} onCancel={onCancel} />

      {scanning && (
        <CameraView
          style={StyleSheet.absoluteFill}
          onReadCode={handleCodeScanned}
        >
          {scanError && (
            <View style={styles.scanErrorContainer}>
              <Text style={styles.scanErrorText}>{scanError}</Text>
              <Pressable onPress={() => setScanError(null)}>
                <Text style={styles.scanRetryText}>Tap to retry</Text>
              </Pressable>
            </View>
          )}
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 20,
    padding: 16,
  },
  passphraseInput: {
    backgroundColor: theme.colors.surfaceVariant,
    borderBottomColor: theme.colors.onSurface,
    borderBottomWidth: 3,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    color: theme.colors.onSurface,
    fontSize: 16,
    height: 52,
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  buttonContainer: {
    paddingHorizontal: 16,
  },
  scanErrorContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    bottom: 100,
    left: 24,
    padding: 16,
    position: 'absolute',
    right: 24,
    borderRadius: 8,
    gap: 8,
  },
  scanErrorText: {
    color: theme.colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  scanRetryText: {
    color: theme.colors.primary,
    fontSize: 14,
  },
});
