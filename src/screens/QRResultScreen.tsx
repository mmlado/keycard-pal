import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import AnimatedURQRCode from 'react-native-animated-ur-qr';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MULTI_PART_TIP } from '@/constants/qrResult';
import type { QRResultScreenProps } from '@/navigation/types';
import theme from '@/theme';

import PrimaryButton from '@/components/PrimaryButton';
import SeedQrCode from '@/components/SeedQrCode';

import { useScanDisplay } from '@/hooks/useScanDisplay';

import { isMultiPartUr, UR_FRAGMENT_CAPACITY } from '@/utils/urParts';

const QR_PADDING = 24;
const QR_MARGIN_VERTICAL = 16;
// AnimatedURQRCode's box is its size plus this on each side.
const UR_BOX_MARGIN = 12;

export default function QRResultScreen({
  route,
  navigation,
}: QRResultScreenProps) {
  const insets = useSafeAreaInsets();
  const windowSize = useWindowDimensions();
  // Known only after layout; the window stands in until then.
  const [area, setArea] = useState<{ width: number; height: number } | null>(
    null,
  );
  const handleAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea({ width, height });
  }, []);
  const { title, description } = route.params;
  const urString = 'urString' in route.params ? route.params.urString : null;
  const seedWords = 'seedWords' in route.params ? route.params.seedWords : null;
  const multiPart = useMemo(
    () => urString !== null && isMultiPartUr(urString),
    [urString],
  );

  // A seed phrase is not made easier to read from a distance.
  useScanDisplay(navigation, urString !== null);

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const areaWidth = (area ?? windowSize).width - QR_PADDING * 2;
  // The area does not scroll, so the code must fit its height as well.
  const areaHeight = (area ?? windowSize).height - QR_MARGIN_VERTICAL * 2;
  const qrSize = Math.max(
    0,
    Math.min(areaWidth, areaHeight) - UR_BOX_MARGIN * 2,
  );

  const handleDone = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [navigation]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      <View style={styles.qrArea} onLayout={handleAreaLayout} testID="qr-area">
        {seedWords !== null ? (
          <SeedQrCode words={seedWords} size={qrSize} maxHeight={areaHeight} />
        ) : null}
        {urString !== null ? (
          <AnimatedURQRCode
            urString={urString}
            size={qrSize}
            capacity={UR_FRAGMENT_CAPACITY}
          />
        ) : null}
      </View>
      {multiPart ? <Text style={styles.tip}>{MULTI_PART_TIP}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton label="Done" onPress={handleDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  description: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 13,
    lineHeight: 13 * 1.45,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  tip: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 13,
    lineHeight: 13 * 1.45,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  qrArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
