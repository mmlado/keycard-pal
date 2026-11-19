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
};

// AnimatedURQRCode's margin, so the box is as large as a UR code's.
const UR_MARGIN = 12;

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
  const box = size + UR_MARGIN * 2;

  return (
    <View style={[styles.container, { width: box }]}>
      <QrCodeImage
        value={value}
        size={box}
        ecl={SEED_QR_ERROR_CORRECTION}
        testID="seed-qr-code"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label} SeedQR`}
      />
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
});
