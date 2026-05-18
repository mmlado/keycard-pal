import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
  Linking,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { URDecoder } from '@ngraveio/bc-ur';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Text, Button, ActivityIndicator, Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { QRScannerScreenProps } from '../navigation/types';
import theme from '../theme';

import CameraView from '../components/CameraView';
import { type ReadCodeEvent } from '../components/Camera';
import { handleUR } from '../utils/ur';
import { detectWcUri } from '../utils/walletConnect/qrDetector.online';

export default function QRScannerScreen({ navigation }: QRScannerScreenProps) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Scan' });
  }, [navigation]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const decoderRef = useRef<URDecoder | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        setHasPermission(true);
      }
    })();
  }, []);

  // Reset scanner state when screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      scannedRef.current = false;
      setProgress(0);
      decoderRef.current = null;
    }, []),
  );

  const onCodeScanned = useCallback(
    (event: ReadCodeEvent) => {
      if (scannedRef.current) {
        return;
      }

      const value = event.nativeEvent.codeStringValue;
      if (!value) {
        return;
      }

      if (detectWcUri(value, navigation)) {
        scannedRef.current = true;
        return;
      }

      const upperValue = value.toUpperCase();

      if (!upperValue.startsWith('UR:')) {
        return;
      }

      if (!decoderRef.current) {
        decoderRef.current = new URDecoder();
      }

      const decoder = decoderRef.current;
      decoder.receivePart(value);

      const pct = decoder.estimatedPercentComplete();
      setProgress(pct);

      if (decoder.isComplete()) {
        scannedRef.current = true;
        if (decoder.isSuccess()) {
          const ur = decoder.resultUR();
          const result = handleUR(ur.type, ur.cbor);
          navigation.navigate('TransactionDetail', { result });
        } else {
          navigation.navigate('TransactionDetail', {
            result: { kind: 'error', message: decoder.resultError() },
          });
        }
        decoderRef.current = null;
      }
    },
    [navigation],
  );

  if (hasPermission === null) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={styles.centeredText}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Icon
          source="camera-off"
          size={64}
          color={theme.colors.onSurfaceVariant}
        />
        <Text variant="headlineSmall" style={styles.centeredText}>
          Camera Permission Required
        </Text>
        <Text variant="bodyMedium" style={styles.centeredSubtext}>
          GapSign needs camera access to scan QR codes.
        </Text>
        <Button
          mode="contained"
          onPress={() => Linking.openSettings()}
          style={styles.permissionButton}
        >
          Open Settings
        </Button>
      </View>
    );
  }

  return (
    <CameraView onReadCode={isFocused ? onCodeScanned : () => {}}>
      {progress > 0 && (
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progress * 100}%` }]}
          />
        </View>
      )}
    </CameraView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 24,
    gap: 16,
  },
  centeredText: {
    color: theme.colors.onSurface,
    textAlign: 'center',
  },
  centeredSubtext: {
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 8,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 27,
    left: 20,
    width: 335,
    height: 16,
    borderRadius: 24,
    backgroundColor: theme.colors.progressTrack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 24,
    backgroundColor: theme.colors.success,
  },
});
