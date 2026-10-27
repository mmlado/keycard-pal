import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Text } from 'react-native-paper';

import { APP_NAME } from '@/constants/app';
import { MnemonicScreenProps } from '@/navigation/types';
import theme from '@/theme';

import { Icons } from '@/assets/icons';
import BottomActionArea from '@/components/BottomActionArea';
import { type ReadCodeEvent } from '@/components/Camera';
import CameraView from '@/components/CameraView';
import MnemonicWordEntry from '@/components/MnemonicWordEntry';
import PreparingKeyCard from '@/components/PreparingKeyCard';
import PrimaryButton from '@/components/PrimaryButton';
import VerifyResult from '@/components/VerifyResult';

import { deriveMnemonicKeyPair, useLoadKey } from '@/hooks/keycard/useLoadKey';
import { useVerifyFingerprint } from '@/hooks/keycard/useVerifyFingerprint';
import { deriveMnemonicFingerprint } from '@/hooks/keycard/useVerifyMnemonic';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';

import {
  decodeCompactSeedQr,
  decodeSeedQr,
  isCompactSeedQrBytes,
  isSeedQrPayload,
  type SeedQrDecodeResult,
} from '@/utils/seedQr';
import { enteredWords } from '@/utils/wordEntry';

const SCAN_ERROR_LINGER_MS = 2000;

export default function MnemonicScreen({
  navigation,
  route,
}: MnemonicScreenProps) {
  const mode = route.params?.mode ?? 'import';
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [input, setInput] = useState('');
  const words = useMemo(() => enteredWords(input), [input]);
  const [passphrase, setPassphrase] = useState('');
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const scanErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScanError = useCallback(() => {
    if (scanErrorTimer.current) {
      clearTimeout(scanErrorTimer.current);
      scanErrorTimer.current = null;
    }
    setScanError(null);
  }, []);

  // The scanner re-reports a rejection every frame, so the notice expires on a timer.
  const rejectScan = useCallback((message: string) => {
    setScanError(message);
    if (scanErrorTimer.current) {
      clearTimeout(scanErrorTimer.current);
    }
    scanErrorTimer.current = setTimeout(
      () => setScanError(null),
      SCAN_ERROR_LINGER_MS,
    );
  }, []);

  useEffect(
    () => () => {
      if (scanErrorTimer.current) {
        clearTimeout(scanErrorTimer.current);
      }
    },
    [],
  );

  const loadKey = useLoadKey();
  const verifyFingerprint = useVerifyFingerprint();
  const keycard = mode === 'verify' ? verifyFingerprint : loadKey;
  const verifyResult =
    mode === 'verify' && verifyFingerprint.phase === 'done'
      ? verifyFingerprint.result
      : null;

  const handleTextChange = useCallback((text: string) => {
    setInput(text);
    setPhraseError(null);
  }, []);

  // The derivation blocks the JS thread, so the loading state is drawn first.
  const handleContinue = useCallback(() => {
    if (!validateMnemonic(words.join(' '), wordlist)) {
      setPhraseError('Invalid recovery phrase');
      return;
    }
    setPreparing(true);
    setTimeout(() => {
      try {
        if (mode === 'verify') {
          verifyFingerprint.start(
            deriveMnemonicFingerprint(words, passphrase || undefined),
          );
        } else {
          loadKey.start(deriveMnemonicKeyPair(words, passphrase || undefined));
        }
      } finally {
        setPreparing(false);
      }
    }, 0);
  }, [loadKey, mode, passphrase, verifyFingerprint, words]);

  const handleScanPress = useCallback(() => {
    // The word input keeps focus under the scanner overlay, so the keyboard would cover it.
    Keyboard.dismiss();
    clearScanError();
    setScanning(true);
  }, [clearScanError]);

  const { leave, sheet } = useKeycardScreen({
    keycard,
    navigation,
    title: scanning
      ? 'Scan SeedQR'
      : mode === 'verify'
      ? 'Verify recovery phrase'
      : 'Import recovery phrase',
    // A verify shows its own result, so nothing follows it on the Dashboard.
    done: mode === 'verify' ? undefined : {},
    hold: verifyResult !== null,
    stayOnCancel: true,
  });

  useEffect(() => {
    if (!scanning) return;
    return navigation.addListener('beforeRemove', e => {
      e.preventDefault();
      setScanning(false);
      clearScanError();
    });
  }, [clearScanError, navigation, scanning]);

  const handleCodeScanned = useCallback(
    (event: ReadCodeEvent) => {
      const { codeStringValue, codeBytesBase64 } = event.nativeEvent;
      const bytes = codeBytesBase64
        ? new Uint8Array(Buffer.from(codeBytesBase64, 'base64'))
        : null;
      if (!codeStringValue && !bytes) return;

      let decoded: SeedQrDecodeResult;
      if (bytes && isCompactSeedQrBytes(bytes)) {
        decoded = decodeCompactSeedQr(bytes);
      } else if (codeStringValue && isSeedQrPayload(codeStringValue)) {
        decoded = decodeSeedQr(codeStringValue);
      } else {
        rejectScan('Not a valid SeedQR. Scan a 12 or 24 word SeedQR.');
        return;
      }

      if (decoded.kind === 'error') {
        rejectScan(decoded.message);
        return;
      }

      setInput(decoded.words.join(' '));
      setWordCount(decoded.words.length === 24 ? 24 : 12);
      setScanning(false);
      clearScanError();
    },
    [clearScanError, rejectScan],
  );

  if (verifyResult) {
    return (
      <View style={styles.container}>
        <VerifyResult
          matches={verifyResult === 'match'}
          text={
            verifyResult === 'match'
              ? 'Recovery phrase matches'
              : 'Recovery phrase does not match'
          }
          onDone={leave}
        />
        {sheet}
      </View>
    );
  }

  const isComplete = words.length === wordCount;

  return (
    <View style={styles.container}>
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
          onScanPress={handleScanPress}
          scanTestID="scan-seedqr-button"
          // Keyboard.dismiss() leaves the input focused, and Android raises the keyboard again.
          editable={!scanning}
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

      <BottomActionArea style={styles.buttonContainer}>
        <PrimaryButton
          label={mode === 'verify' ? 'Verify' : 'Continue'}
          icon={Icons.nfcActivate}
          onPress={handleContinue}
          disabled={!isComplete || preparing}
        />
      </BottomActionArea>

      {preparing && (
        <View style={styles.preparing}>
          <PreparingKeyCard
            description={`${APP_NAME} is deriving the key before it asks you to tap the card.`}
          />
        </View>
      )}

      {sheet}

      {scanning && (
        <CameraView
          style={StyleSheet.absoluteFill}
          onReadCode={handleCodeScanned}
        >
          {scanError && (
            <View style={styles.scanErrorContainer}>
              <Text style={styles.scanErrorText}>{scanError}</Text>
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
  preparing: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
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
  },
  scanErrorText: {
    color: theme.colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
});
