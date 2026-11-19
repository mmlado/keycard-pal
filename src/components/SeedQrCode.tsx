import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import QrCodeImage from '@/components/QrCodeImage';

import {
  SEED_QR_ERROR_CORRECTION,
  seedQrSegments,
  type SeedQrFormat,
} from '@/utils/seedQr';

type Props = {
  words: string[];
  size: number;
  /** The height the code and the switch under it must fit in. */
  maxHeight?: number;
};

// AnimatedURQRCode's margin, so the box is as large as a UR code's.
const UR_MARGIN = 12;
const GAP = 24;
// A box sized by a short window would cut the format names to "Stan…".
const SWITCH_MIN_WIDTH = 240;

const FORMATS: { value: SeedQrFormat; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'compact', label: 'Compact' },
];

export default function SeedQrCode({ words, size, maxHeight }: Props) {
  const [format, setFormat] = useState<SeedQrFormat>('standard');
  // Measured, since a larger system font makes the switch taller.
  const [switchHeight, setSwitchHeight] = useState(0);

  // The typings take only a string, which qrcode would write as UTF-8; segments keep the mode and the bytes.
  const value = useMemo(
    () => seedQrSegments(words, format) as unknown as string,
    [format, words],
  );

  const label = FORMATS.find(f => f.value === format)!.label;
  const box = Math.max(
    0,
    Math.min(
      size + UR_MARGIN * 2,
      (maxHeight ?? Infinity) - GAP - switchHeight,
    ),
  );

  return (
    <View
      testID="seed-qr"
      style={[styles.container, { width: Math.max(box, SWITCH_MIN_WIDTH) }]}
    >
      <QrCodeImage
        value={value}
        size={box}
        ecl={SEED_QR_ERROR_CORRECTION}
        testID="seed-qr-code"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label} SeedQR`}
      />
      <View
        testID="seed-qr-switch"
        style={styles.switch}
        onLayout={event => setSwitchHeight(event.nativeEvent.layout.height)}
      >
        <SegmentedButtons
          value={format}
          onValueChange={v => setFormat(v as SeedQrFormat)}
          buttons={FORMATS}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: GAP,
  },
  switch: {
    alignSelf: 'stretch',
  },
});
