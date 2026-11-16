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

// AnimatedURQRCode's padding, so the box is as large as a UR code's.
const UR_PADDING = 12;
// Four modules of the smallest SeedQR (21x21) a side, so every code has the quiet zone QR requires.
const QUIET_ZONE = 4 / (21 + 4 * 2);

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
  const box = size + UR_PADDING * 2;
  const quiet = box * QUIET_ZONE;

  return (
    <View style={[styles.container, { width: box }]}>
      <View
        style={[styles.qrWrapper, { padding: quiet }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label} SeedQR`}
      >
        <QRCode
          value={value}
          size={box - quiet * 2}
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
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
});
