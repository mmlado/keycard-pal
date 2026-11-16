import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

import {
  SEED_QR_ERROR_CORRECTION,
  seedQrSegments,
  type SeedQrFormat,
} from '@/utils/seedQr';

type Props = {
  words: string[];
  size: number;
};

// As AnimatedURQRCode pads its code, so both QR results come out the same size.
const PADDING = 12;

const FORMATS: { value: SeedQrFormat; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'compact', label: 'Compact' },
];

export default function SeedQrCode({ words, size }: Props) {
  const [format, setFormat] = useState<SeedQrFormat>('standard');

  // The typings take only a string, which qrcode would write as UTF-8; segments keep the mode and the bytes.
  const value = useMemo(
    () => seedQrSegments(words, format) as unknown as string,
    [format, words],
  );

  const label = FORMATS.find(f => f.value === format)!.label;

  return (
    <View style={[styles.container, { width: size + PADDING * 2 }]}>
      <View
        style={styles.qrWrapper}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label} SeedQR`}
      >
        <QRCode
          value={value}
          size={size}
          ecl={SEED_QR_ERROR_CORRECTION}
          color="#000000"
          backgroundColor="#ffffff"
          testID="seed-qr-code"
        />
      </View>
      <SegmentedButtons
        value={format}
        onValueChange={v => setFormat(v as SeedQrFormat)}
        buttons={FORMATS}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  qrWrapper: {
    padding: PADDING,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
});
