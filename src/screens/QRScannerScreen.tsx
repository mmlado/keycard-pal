import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { URDecoder } from '@ngraveio/bc-ur';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { QRScannerScreenProps } from '../navigation/types';
import theme from '../theme';

import CameraView from '../components/CameraView';
import { type ReadCodeEvent } from '../components/Camera';
import { handleUR } from '../utils/ur';
import {
  detectWcUri,
  refreshWcDetection,
} from '../utils/walletConnect/qrDetector.online';

export default function QRScannerScreen({ navigation }: QRScannerScreenProps) {
  const isFocused = useIsFocused();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Scan' });
  }, [navigation]);
  const [progress, setProgress] = useState(0);
  const decoderRef = useRef<URDecoder | null>(null);
  const scannedRef = useRef(false);

  // Reset scanner state when screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      scannedRef.current = false;
      setProgress(0);
      decoderRef.current = null;
      refreshWcDetection();
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
